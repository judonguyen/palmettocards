// Tiny Upstash Redis (REST) helper. Used to log how many times each PSA
// submission is looked up (and, later, to cache results).

function clean(s) {
  s = s || "";
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0xFEFF || c === 0x200B) continue; // BOM, zero-width space
    out += s[i];
  }
  return out.trim();
}
const URL = clean(process.env.UPSTASH_REDIS_REST_URL);
const TOKEN = clean(process.env.UPSTASH_REDIS_REST_TOKEN);

function configured() { return !!(URL && TOKEN); }

async function cmd(args) {
  if (!configured()) throw new Error("Storage not configured.");
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error("Upstash " + r.status);
  return (await r.json()).result;
}

module.exports = { cmd, configured };
