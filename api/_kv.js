// ══════════════════════════════════════════════════════
// _kv.js — de opslag-helper van deluxeedition.nl
// Vervangt Vercel Blob (gratis tegoed was op, zie commit
// 19 jul "Supabase ipv Vercel Blob"). Alles staat nu in
// één Supabase-tabel: deluxe_kv (sleutel → data-JSON).
// Zelfde aanpak als api/arena.js: REST via fetch, geen
// npm-pakket nodig.
// ══════════════════════════════════════════════════════
const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_ANON_KEY;
const KOPPEN = { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` };

export async function kvLees(sleutel, anders = null) {
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/deluxe_kv?sleutel=eq.${encodeURIComponent(sleutel)}&select=data`,
      { headers: KOPPEN, cache: "no-store" }
    );
    if (!r.ok) return anders;
    const rijen = await r.json();
    return rijen.length ? rijen[0].data : anders;
  } catch { return anders; }
}

export async function kvSchrijf(sleutel, data) {
  const r = await fetch(`${SUPA_URL}/rest/v1/deluxe_kv`, {
    method: "POST",
    headers: { ...KOPPEN, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ sleutel, data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error("opslaan mislukt (" + r.status + ")");
}

export async function kvWis(sleutel) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/deluxe_kv?sleutel=eq.${encodeURIComponent(sleutel)}`, {
      method: "DELETE", headers: KOPPEN,
    });
  } catch {}
}

// alle sleutels die met een voorvoegsel beginnen, bijv. "spel:" of "race:g123:"
export async function kvLijst(prefix, limiet = 100) {
  try {
    const r = await fetch(
      `${SUPA_URL}/rest/v1/deluxe_kv?sleutel=like.${encodeURIComponent(prefix + "*")}&select=sleutel,data&limit=${limiet}`,
      { headers: KOPPEN, cache: "no-store" }
    );
    if (!r.ok) return [];
    return await r.json();
  } catch { return []; }
}
