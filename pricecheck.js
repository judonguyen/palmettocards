// Palmetto Price Check — WaxStat-style sealed-product price dashboard.
//
// ⚠️ SAMPLE DATA ONLY. Prices are placeholders so the layout is visible.
// When a real data source is connected, replace SAMPLE_PRODUCTS with live data
// (e.g. const products = await (await fetch("/api/prices")).json();) keeping the
// same field names — group ("Sports"|"TCG"), category, name, brand, year,
// boxType, avg, low30, high30, trend7 — and the table renders unchanged.

const SAMPLE_PRODUCTS = [
  // ── SPORTS ──
  { group: "Sports", category: "Baseball",   name: "Topps Series 1 Baseball",   brand: "Topps",      year: 2024, boxType: "Hobby Box", avg: 92,  low30: 84,  high30: 105, trend7: 1.1 },
  { group: "Sports", category: "Baseball",   name: "Bowman Chrome Baseball",    brand: "Bowman",     year: 2024, boxType: "Hobby Box", avg: 265, low30: 240, high30: 300, trend7: -2.3 },
  { group: "Sports", category: "Baseball",   name: "Topps Chrome Baseball",     brand: "Topps",      year: 2024, boxType: "Hobby Box", avg: 175, low30: 160, high30: 195, trend7: 0.8 },
  { group: "Sports", category: "Basketball", name: "Panini Prizm Basketball",   brand: "Panini",     year: 2024, boxType: "Hobby Box", avg: 540, low30: 500, high30: 620, trend7: 4.7 },
  { group: "Sports", category: "Basketball", name: "Donruss Basketball",        brand: "Panini",     year: 2024, boxType: "Hobby Box", avg: 95,  low30: 88,  high30: 110, trend7: -1.2 },
  { group: "Sports", category: "Football",   name: "Panini Prizm Football",     brand: "Panini",     year: 2024, boxType: "Hobby Box", avg: 410, low30: 380, high30: 460, trend7: 2.0 },
  { group: "Sports", category: "Football",   name: "Donruss Football",          brand: "Panini",     year: 2024, boxType: "Hobby Box", avg: 130, low30: 120, high30: 145, trend7: -0.7 },
  { group: "Sports", category: "Hockey",     name: "Upper Deck Series 1 Hockey", brand: "Upper Deck", year: 2024, boxType: "Hobby Box", avg: 78,  low30: 70,  high30: 90,  trend7: 0.3 },
  { group: "Sports", category: "Soccer",     name: "Panini Prizm Premier League", brand: "Panini",   year: 2024, boxType: "Hobby Box", avg: 320, low30: 290, high30: 360, trend7: 1.5 },

  // ── TCG ──
  { group: "TCG", category: "Pokémon",   name: "Pokémon 151 Booster Box",            brand: "Pokémon TCG",  year: 2023, boxType: "Booster Box",       avg: 159, low30: 145, high30: 178, trend7: 3.2 },
  { group: "TCG", category: "Pokémon",   name: "Surging Sparks Booster Box",         brand: "Pokémon TCG",  year: 2024, boxType: "Booster Box",       avg: 119, low30: 109, high30: 135, trend7: -1.8 },
  { group: "TCG", category: "Pokémon",   name: "Prismatic Evolutions Elite Trainer", brand: "Pokémon TCG",  year: 2025, boxType: "Elite Trainer Box", avg: 89,  low30: 75,  high30: 120, trend7: 6.4 },
  { group: "TCG", category: "Pokémon",   name: "Paldean Fates Booster Bundle",       brand: "Pokémon TCG",  year: 2024, boxType: "Booster Bundle",    avg: 44,  low30: 39,  high30: 52,  trend7: -0.5 },
  { group: "TCG", category: "One Piece", name: "OP-09 Emperors Booster Box",         brand: "Bandai",       year: 2024, boxType: "Booster Box",       avg: 105, low30: 95,  high30: 125, trend7: 2.6 },
  { group: "TCG", category: "One Piece", name: "Romance Dawn (OP-01) Booster Box",   brand: "Bandai",       year: 2022, boxType: "Booster Box",       avg: 410, low30: 370, high30: 470, trend7: 5.1 },
  { group: "TCG", category: "Magic",     name: "Foundations Play Booster Box",       brand: "Wizards",      year: 2024, boxType: "Play Booster Box",  avg: 119, low30: 110, high30: 135, trend7: -0.9 },
  { group: "TCG", category: "Yu-Gi-Oh!", name: "25th Anniversary Rarity Collection", brand: "Konami",       year: 2023, boxType: "Booster Box",       avg: 135, low30: 120, high30: 150, trend7: 0.4 },
  { group: "TCG", category: "Lorcana",   name: "Shimmering Skies Booster Box",       brand: "Ravensburger", year: 2024, boxType: "Booster Box",       avg: 140, low30: 125, high30: 160, trend7: 1.9 }
];

let currentGroup = "Sports";

function esc(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n) { return "$" + Number(n).toLocaleString("en-US"); }

function trendCell(pct) {
  let cls = "flat", arrow = "—", txt = "0.0%";
  if (pct > 0) { cls = "up"; arrow = "▲"; txt = "+" + pct.toFixed(1) + "%"; }
  else if (pct < 0) { cls = "down"; arrow = "▼"; txt = pct.toFixed(1) + "%"; }
  return '<span class="trend ' + cls + '">' + arrow + " " + txt + "</span>";
}

function rowHtml(p) {
  let h = "<tr>";
  h += '<td><div class="prod-title">' + esc(p.year + " " + p.name) + '</div>' +
       '<div class="prod-meta">' + esc(p.brand) + '</div></td>';
  h += '<td><span class="pill">' + esc(p.category) + "</span></td>";
  h += '<td><span class="pill">' + esc(p.boxType) + "</span></td>";
  h += '<td class="num"><span class="price">' + money(p.avg) + "</span></td>";
  h += '<td class="num"><span class="range">' + money(p.low30) + " – " + money(p.high30) + "</span></td>";
  h += '<td class="num">' + trendCell(p.trend7) + "</td>";
  h += "</tr>";
  return h;
}

function groupProducts() {
  return SAMPLE_PRODUCTS.filter(function (p) { return p.group === currentGroup; });
}

function populateCategoryDropdown() {
  const cats = [];
  groupProducts().forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });
  cats.sort();
  const sel = document.getElementById("categoryFilter");
  sel.innerHTML = '<option value="all">All ' + esc(currentGroup) + " categories</option>";
  cats.forEach(function (c) {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  // Update stats for this group
  document.getElementById("statCount").textContent = groupProducts().length;
  document.getElementById("statCats").textContent = cats.length;
}

function applyFilters() {
  const q = (document.getElementById("searchInput").value || "").trim().toLowerCase();
  const cat = document.getElementById("categoryFilter").value;
  const sort = document.getElementById("sortSelect").value;

  let list = groupProducts().filter(function (p) {
    const matchesCat = (cat === "all") || (p.category === cat);
    const hay = (p.year + " " + p.name + " " + p.brand + " " + p.category + " " + p.boxType).toLowerCase();
    const matchesQ = !q || hay.indexOf(q) !== -1;
    return matchesCat && matchesQ;
  });

  list.sort(function (a, b) {
    switch (sort) {
      case "priceDesc": return b.avg - a.avg;
      case "priceAsc": return a.avg - b.avg;
      case "trendDesc": return b.trend7 - a.trend7;
      case "trendAsc": return a.trend7 - b.trend7;
      default: return (a.year + " " + a.name).localeCompare(b.year + " " + b.name);
    }
  });

  const body = document.getElementById("productBody");
  if (!list.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No products match your search.</td></tr>';
  } else {
    body.innerHTML = list.map(rowHtml).join("");
  }
}

(function init() {
  // Group tabs (Sports / TCG)
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      currentGroup = tab.getAttribute("data-group");
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("searchInput").value = "";
      populateCategoryDropdown();
      applyFilters();
    });
  });

  // Filter/sort controls
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("categoryFilter").addEventListener("change", applyFilters);
  document.getElementById("sortSelect").addEventListener("change", applyFilters);

  populateCategoryDropdown();
  applyFilters();
})();
