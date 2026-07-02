// Vercel Serverless Function — runs on Vercel's servers, NOT in the browser.
// Calls the PSA public API and returns clean JSON for the browser UI.
// The PSA token is read from process.env.PSA_TOKEN, so it is never exposed
// to visitors or committed to the repo.

const { cmd, configured } = require("../lib/store.js");

const PSA_BASE = "https://api.psacard.com/publicapi";

// Log a submission lookup: bump its per-submission counter and record when it
// was last seen. Best-effort — never blocks or breaks the lookup.
async function logSubmission(sub) {
  if (!configured()) return;
  try {
    await cmd(["HINCRBY", "palmetto:subcounts", sub, 1]);
    await cmd(["HSET", "palmetto:sublast", sub, new Date().toISOString()]);
  } catch (e) { /* logging is non-critical */ }
}

// Friendly display names + descriptions for each PSA progress step.
// Keys match the "step" values returned by /order/GetProgress.
const STEP_META = {
  Arrived:       { name: "Arrived",             desc: "Submission has arrived at PSA" },
  OrderPrep:     { name: "Order Prep",          desc: "Reviewed, verified, and logged into the system" },
  ResearchAndID: { name: "Research & ID",       desc: "Cards researched for accurate labeling" },
  Grading:       { name: "Grading",             desc: "Authentication and grading complete" },
  Assembly:      { name: "Assembly",            desc: "Labels printed and cards sealed in slabs" },
  QACheck1:      { name: "Quality Assurance 1", desc: "First quality-assurance review" },
  QACheck2:      { name: "Quality Assurance 2", desc: "Final QA review before shipping" },
  Shipped:       { name: "Shipped",             desc: "Order has shipped back to the customer" }
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

// US daylight-saving rule (Central follows it): 2nd Sun Mar → 1st Sun Nov.
function secondSundayMarch(y) { const f = new Date(Date.UTC(y, 2, 1)).getUTCDay(); return ((7 - f) % 7) + 1 + 7; }
function firstSundayNov(y) { const f = new Date(Date.UTC(y, 10, 1)).getUTCDay(); return ((7 - f) % 7) + 1; }
function usDST(y, m0, d) { if (m0 > 2 && m0 < 10) return true; if (m0 < 2 || m0 > 10) return false; if (m0 === 2) return d >= secondSundayMarch(y); return d < firstSundayNov(y); }

// The current "lookup day" = a noon-Central-to-noon-Central window, labeled by
// the date it started. Resets every day at 12:00 PM Central (CST/CDT aware).
function centralPeriod() {
  const now = new Date();
  const off = usDST(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) ? 5 : 6; // CDT=-5, CST=-6
  const c = new Date(now.getTime() - off * 3600 * 1000);  // Central wall clock in UTC fields
  let y = c.getUTCFullYear(), m = c.getUTCMonth(), d = c.getUTCDate();
  if (c.getUTCHours() < 12) {                              // before noon → previous window
    const p = new Date(Date.UTC(y, m, d) - 86400000);
    y = p.getUTCFullYear(); m = p.getUTCMonth(); d = p.getUTCDate();
  }
  return y + "-" + ("0" + (m + 1)).slice(-2) + "-" + ("0" + d).slice(-2);
}

// Lookups are only open 12:00 PM–7:00 PM Eastern (EST/EDT-aware). Server-side
// backstop so no PSA call happens off-hours even via a direct request.
function lookupsOpen() {
  try {
    const h = parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
    return h >= 12 && h < 19;
  } catch (e) { return true; }  // if the timezone lookup fails, don't lock out
}

module.exports = async function handler(req, res) {
  const sub = (req.query && req.query.sub) ? String(req.query.sub) : "";

  if (!/^[0-9]+$/.test(sub)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid numeric submission number." });
  }
  if (!lookupsOpen()) {
    return res.status(200).json({ ok: false, error: "Submission lookups are only available from 12:00 PM to 7:00 PM ET. Please check back during those hours." });
  }
  // Record that this submission was sent (counts every lookup, even if blocked
  // or PSA is rate-limited) so we can see which submissions are being hit.
  await logSubmission(sub);

  // One PSA call per submission per day (window resets at 12:00 PM Central).
  // If we already fetched it this window, serve that saved result — no new PSA
  // call. The cache key includes the period, so it naturally refreshes at noon.
  const cacheKey = "palmetto:cache:" + centralPeriod() + ":" + sub;
  if (configured()) {
    try {
      const cached = await cmd(["GET", cacheKey]);
      if (cached) {
        const obj = JSON.parse(cached);
        obj.cached = true;   // flag so the page can note it's today's saved status
        return res.status(200).json(obj);
      }
    } catch (e) {}
  }

  if (!process.env.PSA_TOKEN) {
    return res.status(500).json({ ok: false, error: "Server is not configured with a PSA token." });
  }

  // NOTE: PSA has two endpoints — GetProgress expects an ORDER number, while
  // GetSubmissionProgress expects a SUBMISSION number (what users type here).
  const orderRes = await psaGet("/order/GetSubmissionProgress/" + encodeURIComponent(sub));
  if (!orderRes.ok) {
    let msg;
    if (orderRes.status === 404) {
      msg = "Submission #" + sub + " was not found. Double-check the number.";
    } else if (orderRes.status) {
      msg = "PSA API returned " + orderRes.status;
    } else {
      msg = orderRes.error || "Unknown error";
    }
    return res.status(200).json({ ok: false, error: msg });
  }

  const d = orderRes.data || {};
  // The PSA "Shipped" step is hidden from the public — we present a 7-step
  // process (Arrived through QA2). isShipped still comes from PSA's flag so the
  // email notification can use it, it's just not shown as a visible step.
  const isShipped = !!d.shipped;
  const rawSteps = (Array.isArray(d.orderProgressSteps) ? d.orderProgressSteps.slice() : [])
    .sort((a, b) => (a.index || 0) - (b.index || 0))
    .filter(s => s.step !== "Shipped");

  const steps = rawSteps.map(s => {
    const meta = STEP_META[s.step] || { name: s.step, desc: "" };
    return { name: meta.name, desc: meta.desc, done: !!s.completed };
  });

  const doneCount = steps.filter(s => s.done).length;
  // The "In Progress" step = the first step that is not yet completed.
  // (-1 means all visible steps are done.)
  const currentIdx = steps.findIndex(s => !s.done);

  const result = {
    ok: true,
    submissionNumber: sub,
    orderNumber: d.orderNumber || "",
    cardCount: null,        // PSA's progress endpoint does not return a card count
    doneCount: doneCount,
    currentIdx: currentIdx,
    isShipped: isShipped,
    gradesReady: !!d.gradesReady,
    problemOrder: !!d.problemOrder,
    steps: steps,
    certs: [],              // no cert list is available from the progress endpoint
    fetchedAt: new Date().toISOString()
  };

  // Save this result for the rest of today's window so repeat checks serve it
  // without another PSA call (only cached after a real success, never a 429/404).
  if (configured()) {
    try { await cmd(["SET", cacheKey, JSON.stringify(result), "EX", 26 * 3600]); } catch (e) {}
  }

  return res.status(200).json(result);
};
