// Palmetto Price Check — front-end.
// NOTE: This is the page UI. Live price data is not connected yet — once a
// data source is chosen, this will call an /api/prices endpoint and render
// the real results in place of the preview below.

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderPreview(query, category) {
  const catLabel = category === "pokemon" ? "Pokémon" : (category === "sports" ? "Sports" : "All categories");
  const q = query || "your product";

  let html = "";
  html += '<div class="result-card">';
  html += '<span class="preview-badge">Preview — not live data yet</span>';
  html += '<div class="notice" style="margin-bottom:18px">';
  html += 'This is how results will look. Live pricing isn\'t connected yet — ';
  html += 'once a price source is set up, searching <strong>' + esc(q) + '</strong> (' + esc(catLabel) + ') ';
  html += 'will show current market prices here.';
  html += '</div>';

  // Example rows so the layout is visible (clearly marked as examples)
  const examples = [
    { title: "Pokémon 151 Elite Trainer Box", meta: "Sealed · Pokémon", price: "$59.99", src: "example" },
    { title: "Pokémon Surging Sparks Booster Box", meta: "Sealed · Pokémon", price: "$129.00", src: "example" },
    { title: "2024 Topps Series 1 Baseball Hobby Box", meta: "Sealed · Sports", price: "$89.95", src: "example" }
  ];
  for (let i = 0; i < examples.length; i++) {
    const e = examples[i];
    html += '<div class="price-row">';
    html += '<div class="price-info">';
    html += '<div class="price-title">' + esc(e.title) + '</div>';
    html += '<div class="price-meta">' + esc(e.meta) + '</div>';
    html += '</div>';
    html += '<div class="price-value">' + esc(e.price) + '<span class="src">' + esc(e.src) + '</span></div>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

(function () {
  const form = document.getElementById("priceForm");
  const results = document.getElementById("results");
  if (!form) return;

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    const query = (document.getElementById("queryInput").value || "").trim();
    const category = document.getElementById("categorySelect").value;
    results.innerHTML = renderPreview(query, category);
  });
})();
