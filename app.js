// Browser-side script. Reads ?sub= from the URL, asks our serverless
// function (/api/track) for the data, and renders the result.

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function checkmarkSvg() {
  return '<svg class="checkmark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
}

function renderResult(data) {
  const TOTAL = data.steps.length;
  // Show the step the order is currently ON (the in-progress step), not just
  // the number completed. If everything is done, it's on the final step.
  const currentStepNum = (data.currentIdx >= 0) ? (data.currentIdx + 1) : TOTAL;
  const pct = Math.round((currentStepNum / TOTAL) * 100);
  let html = "";

  html += '<div class="result-card">';

  // Repeat check: show that it was already checked, plus the wait + patience note.
  if (data.alreadyChecked) {
    let whenTxt = "recently";
    if (data.fetchedAt) {
      const w = new Date(data.fetchedAt), now = new Date();
      whenTxt = (w.toDateString() === now.toDateString())
        ? ("today at " + w.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
        : ("on " + w.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " at " + w.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
    }
    const days = data.daysRemaining || 5;
    html += '<div class="error-msg" style="margin-bottom:16px;line-height:1.5">' +
      '⛔ You already checked this submission <strong>' + whenTxt + '</strong> — here&#39;s the latest update below.<br />' +
      'You can&#39;t check this number again for another <strong>' + days + ' day' + (days === 1 ? '' : 's') + '</strong>.<br />' +
      '🧘 Patience is the key to happiness.</div>';
  } else if (data.fetchedAt) {
    html += '<div class="muted-note" style="background:#f4f8fb;border:1px solid #dbe6ef;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:13px">' +
      '✅ Status checked just now. You can check this submission again in <strong>5 days</strong> — 🧘 patience is the key to happiness.</div>';
  }

  // Header
  html += '<div class="result-header">';
  html += '<div>';
  html += '<div class="label">Submission #</div>';
  html += '<div class="value">' + esc(data.submissionNumber) + '</div>';
  if (data.orderNumber) {
    html += '<div class="card-count">PSA Order #<strong>' + esc(data.orderNumber) + '</strong></div>';
  }
  if (data.cardCount !== null && data.cardCount > 0) {
    html += '<div class="card-count"><strong>' + esc(data.cardCount) + '</strong> cards in submission</div>';
  }
  html += '</div>';
  html += '<div class="progress-summary">';
  html += '<div class="label">Progress</div>';
  html += '<div class="count">' + currentStepNum + ' / ' + TOTAL + '</div>';
  html += '</div>';
  html += '</div>'; // result-header

  // Progress bar
  html += '<div class="progress-bar"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div>';

  // Steps
  html += '<div class="steps">';
  for (let i = 0; i < data.steps.length; i++) {
    const step = data.steps[i];
    const isDone = step.done;
    const isCurrent = (i === data.currentIdx); // first not-completed step = in progress

    let statusLabel, statusClass;
    if (isDone) {
      statusLabel = "Completed"; statusClass = "done";
    } else if (isCurrent) {
      statusLabel = "In Progress"; statusClass = "inprogress";
    } else {
      statusLabel = "Pending"; statusClass = "pending";
    }

    const rowClass = "step" + (isDone ? " done" : "") + (isCurrent ? " current" : "");
    const stepNumContent = isDone ? checkmarkSvg() : String(i + 1);

    html += '<div class="' + rowClass + '">';
    html += '<div class="step-num">' + stepNumContent + '</div>';
    html += '<div class="step-body">';
    html += '<div class="step-name">' + esc(step.name) + '</div>';
    html += '<div class="step-desc">' + esc(step.desc) + '</div>';
    html += '</div>';
    html += '<div class="step-status ' + statusClass + '">' + statusLabel + '</div>';
    html += '</div>';
  }
  html += '</div>'; // steps

  // Cards (only when shipped)
  if (data.isShipped && data.certs && data.certs.length > 0) {
    html += '<div class="cards-section">';
    html += '<h2>Cards in this submission <span class="badge">Shipped</span></h2>';
    for (let c = 0; c < data.certs.length; c++) {
      const card = data.certs[c];
      const titleParts = [];
      if (card.year) titleParts.push(card.year);
      if (card.brand) titleParts.push(card.brand);
      if (card.subject) titleParts.push(card.subject);
      if (card.cardNumber) titleParts.push(card.cardNumber);
      const title = titleParts.join(" ") || "—";
      const gradeClass = (card.grade && card.grade !== "—" && card.grade !== "Error") ? "" : "ungraded";

      html += '<div class="card-row">';
      html += '<div class="card-info">';
      html += '<div class="card-title">' + esc(title) + '</div>';
      html += '<div class="card-meta">Cert # ' + esc(card.certNumber) + '</div>';
      html += '</div>';
      html += '<div class="card-grade ' + gradeClass + '">PSA ' + esc(card.grade) + '</div>';
      html += '</div>';
    }
    html += '</div>'; // cards-section
  }

  // Email-this-update section (opens the sender's own email app, pre-filled)
  html += '<div class="cards-section">';
  html += '<h2>Send this update by email</h2>';
  html += '<div class="share-row">';
  html += '<input type="email" id="shareEmail" placeholder="recipient@example.com" />';
  html += '<button type="button" id="shareBtn">Compose email</button>';
  html += '</div>';
  html += '<div id="shareMsg" class="muted-note" style="margin-top:10px">Opens your email app with the submission # and progress filled in — just hit send.</div>';
  html += '</div>';

  html += '</div>'; // result-card
  return html;
}

// Build the email subject + body from the current progress data.
function buildEmail(data) {
  const total = data.steps.length;
  const stepNum = (data.currentIdx >= 0) ? (data.currentIdx + 1) : total;
  const currentName = (data.currentIdx >= 0) ? data.steps[data.currentIdx].name : "Complete";

  const subject = data.isShipped
    ? ("PSA submission #" + data.submissionNumber + " is ready!")
    : ("PSA submission #" + data.submissionNumber + " — step " + stepNum + " of " + total);

  const lines = [];
  lines.push("PSA Submission #: " + data.submissionNumber);
  if (data.orderNumber) lines.push("PSA Order #: " + data.orderNumber);
  lines.push("");
  if (data.isShipped) {
    lines.push("Good news - your cards have been graded and are ready!");
  } else if (data.currentIdx < 0) {
    lines.push("All " + total + " steps are complete!");
  } else {
    lines.push("Current step: " + stepNum + " of " + total + " (" + currentName + ")");
  }
  lines.push("");
  lines.push("Progress:");
  for (let i = 0; i < data.steps.length; i++) {
    const s = data.steps[i];
    const mark = s.done ? "[x]" : (i === data.currentIdx ? "[ ] (in progress)" : "[ ]");
    lines.push("  " + mark + " " + s.name);
  }
  lines.push("");
  lines.push("Track it live: " + window.location.origin + "/?sub=" + data.submissionNumber);

  return { subject: subject, body: lines.join("\n") };
}

function wireShareButton(data) {
  const btn = document.getElementById("shareBtn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    const emailInput = document.getElementById("shareEmail");
    const msg = document.getElementById("shareMsg");
    const to = (emailInput.value || "").trim();
    if (to && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
      msg.textContent = "Please enter a valid email address (or leave it blank).";
      return;
    }
    const em = buildEmail(data);
    const mailto = "mailto:" + to +
      "?subject=" + encodeURIComponent(em.subject) +
      "&body=" + encodeURIComponent(em.body);
    window.location.href = mailto;
    msg.textContent = "Opening your email app…";
  });
}

// Lookups are only open 12:00 PM–7:00 PM Eastern (handles EST/EDT automatically).
function etHour() {
  try {
    return parseInt(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false }).format(new Date()), 10) % 24;
  } catch (e) { return -1; }
}
function lookupsOpen() { const h = etHour(); return h >= 12 && h < 19; }

(async function () {
  const params = new URLSearchParams(window.location.search);
  const sub = params.get("sub");
  const input = document.getElementById("subInput");
  const result = document.getElementById("result");
  const btn = document.getElementById("lookupBtn");
  const note = document.getElementById("availNote");

  if (sub && input) input.value = sub;

  if (!lookupsOpen()) {
    if (input) { input.disabled = true; input.placeholder = "Available 12–7 PM ET"; }
    if (btn) btn.style.display = "none";   // hide the button outside the window
    if (note) note.innerHTML = "🕛 Submission lookups are only available from <strong>12:00&nbsp;PM to 7:00&nbsp;PM ET</strong>. Please check back during those hours.";
    return;
  }
  // Open: show + enable the form.
  if (input) input.disabled = false;
  if (btn) btn.style.display = "";        // reveal the button during the window
  if (note) note.innerHTML = "🟢 Lookups are open now — available <strong>12:00&nbsp;PM to 7:00&nbsp;PM ET</strong> daily.";

  if (!sub) return; // nothing to look up yet

  if (!/^[0-9]+$/.test(sub)) {
    result.innerHTML = '<div class="error-msg">Please enter a valid numeric submission number.</div>';
    return;
  }

  result.innerHTML = '<div class="result-card"><p class="muted-note">Loading submission ' + esc(sub) + '…</p></div>';

  let data;
  try {
    const resp = await fetch("/api/track?sub=" + encodeURIComponent(sub));
    data = await resp.json();
  } catch (e) {
    result.innerHTML = '<div class="error-msg">Network error: ' + esc(String(e)) + '</div>';
    return;
  }

  if (!data || !data.ok) {
    result.innerHTML = '<div class="error-msg">Lookup failed: ' + esc((data && data.error) || "Unknown error") + '</div>';
    return;
  }

  result.innerHTML = renderResult(data);
  wireShareButton(data);
})();
