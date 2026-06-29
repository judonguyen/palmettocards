// Renders the per-submission lookup counts from /api/subcounts.

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function whenLabel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function load() {
  const card = document.getElementById("card");
  let data;
  try {
    data = await (await fetch("/api/subcounts?cb=" + Date.now())).json();
  } catch (e) {
    card.innerHTML = '<div class="state">⚠️ Could not load the counter.</div>';
    return;
  }
  if (!data || !data.ok) {
    card.innerHTML = '<div class="state">⚠️ ' + esc((data && data.error) || "Counter unavailable.") + '</div>';
    return;
  }

  document.getElementById("total").textContent = Number(data.totalLookups || 0).toLocaleString("en-US");
  document.getElementById("unique").textContent = Number(data.unique || 0).toLocaleString("en-US");

  const rows = data.submissions || [];
  if (!rows.length) {
    card.innerHTML = '<div class="state">No lookups recorded yet. Once someone searches a submission, it shows up here.</div>';
    return;
  }
  let h = '<table><tr><th>Submission #</th><th class="num">Times looked up</th><th>Last looked up</th></tr>';
  rows.forEach(function (r) {
    h += '<tr><td class="sub">' + esc(r.submission) + '</td>' +
      '<td class="num"><span class="count-pill">' + r.count + '</span></td>' +
      '<td class="when">' + esc(whenLabel(r.lastSeen)) + '</td></tr>';
  });
  h += '</table>';
  card.innerHTML = h;
}

document.getElementById("refreshBtn").addEventListener("click", load);
load();
setInterval(load, 30000);
