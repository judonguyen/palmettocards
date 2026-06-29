// Shows how many times each PSA submission has been looked up (most-hit first).
const { cmd, configured } = require("../lib/store.js");

module.exports = async function handler(req, res) {
  if (!configured()) {
    return res.status(200).json({ ok: false, error: "Storage not configured." });
  }
  try {
    // HGETALL returns a flat [field, value, field, value, ...] array.
    const counts = await cmd(["HGETALL", "palmetto:subcounts"]);
    const last = await cmd(["HGETALL", "palmetto:sublast"]);

    const lastMap = {};
    for (let i = 0; last && i < last.length; i += 2) lastMap[last[i]] = last[i + 1];

    const rows = [];
    let total = 0;
    for (let i = 0; counts && i < counts.length; i += 2) {
      const sub = counts[i], n = parseInt(counts[i + 1], 10) || 0;
      total += n;
      rows.push({ submission: sub, count: n, lastSeen: lastMap[sub] || null });
    }
    rows.sort(function (a, b) { return b.count - a.count; });

    return res.status(200).json({ ok: true, totalLookups: total, unique: rows.length, submissions: rows });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e.message || e) });
  }
};
