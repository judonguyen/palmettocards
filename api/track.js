// Vercel Serverless Function — runs on Vercel's servers, NOT in the browser.
// This is the secure, Vercel-native replacement for the Salesforce SSJS.
// The PSA token is read from an environment variable (process.env.PSA_TOKEN),
// so it is NEVER exposed to visitors or committed to the repo.

const PSA_BASE = "https://api.psacard.com/publicapi";

// The 8 PSA grading steps
const STEPS = [
  { key: "arrived",          name: "Arrived",           desc: "Submission has arrived at PSA" },
  { key: "orderPrep",        name: "Order Prep",        desc: "Reviewed, verified, and logged into the system" },
  { key: "researchId",       name: "Research & ID",     desc: "Cards researched for accurate labeling" },
  { key: "grading",          name: "Grading",           desc: "Authentication and grading complete" },
  { key: "assembly",         name: "Assembly",          desc: "Labels printed and cards sealed in slabs" },
  { key: "qualityAssurance", name: "Quality Assurance", desc: "Final QA review before shipping" },
  { key: "imaging",          name: "Imaging",           desc: "Cards scanned and imaged for records" },
  { key: "shipped",          name: "Shipped",           desc: "Order has shipped back to the customer" }
];

// Alternate field names PSA might use for each step
const STEP_ALIASES = {
  arrived: ["Arrived", "arrivedAtPSA"],
  orderPrep: ["OrderPrep", "order_prep", "prep"],
  researchId: ["ResearchID", "research_id", "researchAndID", "Research"],
  grading: ["Grading", "graded"],
  assembly: ["Assembly", "assembled"],
  qualityAssurance: ["QA", "qa", "QualityAssurance", "quality_assurance"],
  imaging: ["Imaging", "imaged"],
  shipped: ["Shipped", "shipped_out"]
};

async function psaGet(path) {
  const url = PSA_BASE + path;
  try {
    const token = (process.env.PSA_TOKEN || "").trim();
    const resp = await fetch(url, {
      headers: {
        Authorization: "bearer " + token,
        Accept: "application/json"
      }
    });
    const text = await resp.text();
    if (resp.ok) {
      let data = null;
      try { data = JSON.parse(text); } catch (e) { /* non-JSON body */ }
      return { ok: true, data: data };
    }
    return { ok: false, status: resp.status, body: text };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function extractStepValue(data, stepKey) {
  const candidates = [data];
  if (data.steps) candidates.push(data.steps);
  if (data.OrderProcess) candidates.push(data.OrderProcess);
  if (data.orderProcess) candidates.push(data.orderProcess);
  if (data.result) candidates.push(data.result);
  if (data.data) candidates.push(data.data);

  const keys = [stepKey].concat(STEP_ALIASES[stepKey] || []);
  for (const obj of candidates) {
    if (!obj) continue;
    for (const k of keys) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const v = obj[k];
        if (typeof v === "boolean") return v;
        if (typeof v === "string") {
          const lv = v.toLowerCase();
          return lv === "true" || lv === "completed" || lv === "complete";
        }
        if (typeof v === "number") return v > 0;
        if (v && typeof v === "object" && "completed" in v) return !!v.completed;
      }
    }
  }
  return false;
}

function extractCardCount(data) {
  const candidates = [data, data.OrderProcess, data.orderProcess, data.result, data.data, data.submission, data.order];
  const keys = ["cardCount", "CardCount", "card_count", "itemCount", "ItemCount", "item_count",
                "numberOfCards", "NumberOfCards", "totalCards", "totalItems", "count", "quantity"];
  const arrKeys = ["cards", "items", "certs", "Cards", "Items", "Certs"];
  for (const obj of candidates) {
    if (!obj) continue;
    for (const k of keys) {
      if (typeof obj[k] === "number") return obj[k];
    }
    for (const ak of arrKeys) {
      if (obj[ak] && obj[ak].length !== undefined) return obj[ak].length;
    }
  }
  return null;
}

function extractCertNumbers(data) {
  const candidates = [data, data.OrderProcess, data.orderProcess, data.result, data.data, data.submission, data.order];
  const arrKeys = ["certs", "Certs", "certNumbers", "CertNumbers", "cards", "Cards", "items", "Items"];
  for (const obj of candidates) {
    if (!obj) continue;
    for (const ak of arrKeys) {
      const arr = obj[ak];
      if (arr && arr.length) {
        const result = [];
        for (const it of arr) {
          if (typeof it === "string" || typeof it === "number") {
            result.push(String(it));
          } else if (it) {
            const cn = it.certNumber || it.CertNumber || it.cert || it.Cert || it.id || it.ID;
            if (cn) result.push(String(cn));
          }
        }
        return result;
      }
    }
  }
  return [];
}

module.exports = async function handler(req, res) {
  const sub = (req.query && req.query.sub) ? String(req.query.sub) : "";

  if (!/^[0-9]+$/.test(sub)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid numeric submission number." });
  }
  if (!process.env.PSA_TOKEN) {
    return res.status(500).json({ ok: false, error: "Server is not configured with a PSA token." });
  }

  const orderRes = await psaGet("/orderprocess/GetOrderProcess/" + encodeURIComponent(sub));
  if (!orderRes.ok) {
    const msg = orderRes.status ? ("PSA API returned " + orderRes.status) : (orderRes.error || "Unknown error");
    return res.status(200).json({ ok: false, error: msg });
  }

  const orderData = orderRes.data || {};
  const cardCount = extractCardCount(orderData);
  const stepValues = STEPS.map(s => extractStepValue(orderData, s.key));
  const doneCount = stepValues.filter(Boolean).length;
  let currentIdx = stepValues.findIndex(v => !v); // -1 if all done
  const isShipped = stepValues[stepValues.length - 1] === true;
  const steps = STEPS.map((s, i) => ({ name: s.name, desc: s.desc, done: stepValues[i] }));

  const certs = [];
  if (isShipped) {
    const certNums = extractCertNumbers(orderData);
    for (const cnum of certNums) {
      const certRes = await psaGet("/cert/GetByCertNumber/" + encodeURIComponent(cnum));
      if (certRes.ok && certRes.data) {
        const c = certRes.data.PSACert || certRes.data.psaCert || certRes.data.cert || certRes.data;
        certs.push({
          certNumber: c.CertNumber || c.certNumber || cnum,
          grade: c.CardGrade || c.cardGrade || c.GradeDescription || c.gradeDescription || "—",
          subject: c.Subject || c.subject || "—",
          year: c.Year || c.year || "",
          brand: c.Brand || c.brand || "",
          cardNumber: c.CardNumber || c.cardNumber || ""
        });
      } else {
        certs.push({ certNumber: cnum, grade: "Error", subject: "Lookup failed", year: "", brand: "", cardNumber: "" });
      }
    }
  }

  return res.status(200).json({
    ok: true,
    submissionNumber: sub,
    cardCount: cardCount,
    doneCount: doneCount,
    currentIdx: currentIdx,
    isShipped: isShipped,
    steps: steps,
    certs: certs
  });
};
