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
  const pct = Math.round((data.doneCount / TOTAL) * 100);
  let html = "";

  html += '<div class="result-card">';

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
  html += '<div class="count">' + data.doneCount + ' / ' + TOTAL + '</div>';
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

  html += '</div>'; // result-card
  return html;
}

(async function () {
  const params = new URLSearchParams(window.location.search);
  const sub = params.get("sub");
  const input = document.getElementById("subInput");
  const result = document.getElementById("result");

  if (sub && input) input.value = sub;

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
})();
