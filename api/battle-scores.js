// ══════════════════════════════════════════════════════
// DELUXE BATTLE — all-time scorebord via Supabase
// GET            → top 20 spelers gesorteerd op kills
// POST { actie:'update', naam, wins, kills, bot_kills, games }
// ══════════════════════════════════════════════════════

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_ANON_KEY;

function schoon(n) { return String(n || "").trim().replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 20); }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {

    /* ── GET: top 20 ── */
    if (req.method === "GET") {
      const r = await fetch(
        `${SUPA_URL}/rest/v1/scores?select=naam,wins,kills,bot_kills,games&order=kills.desc,wins.desc&limit=20`,
        { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, cache: "no-store" }
      );
      if (!r.ok) return res.status(500).json({ fout: "db fout" });
      return res.status(200).json(await r.json());
    }

    /* ── POST: score ophogen ── */
    if (req.method === "POST") {
      const b = req.body;
      if (b.actie !== "update") return res.status(400).json({ fout: "onbekende actie" });
      const naam = schoon(b.naam);
      if (!naam) return res.status(400).json({ fout: "naam ontbreekt" });

      const wins     = Math.max(0, Math.min(1,  parseInt(b.wins)      || 0));
      const kills    = Math.max(0, Math.min(20, parseInt(b.kills)     || 0));
      const botKills = Math.max(0, Math.min(1,  parseInt(b.bot_kills) || 0));
      const games    = Math.max(0, Math.min(1,  parseInt(b.games)     || 0));

      // Huidige waarden ophalen
      const r = await fetch(
        `${SUPA_URL}/rest/v1/scores?naam=eq.${encodeURIComponent(naam)}&select=wins,kills,bot_kills,games`,
        { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, cache: "no-store" }
      );
      const rijen = await r.json();
      const oud = rijen[0] || { wins: 0, kills: 0, bot_kills: 0, games: 0 };

      await fetch(`${SUPA_URL}/rest/v1/scores`, {
        method: "POST",
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          naam,
          wins:      (oud.wins      || 0) + wins,
          kills:     (oud.kills     || 0) + kills,
          bot_kills: (oud.bot_kills || 0) + botKills,
          games:     (oud.games     || 0) + games,
          updated_at: new Date().toISOString(),
        }),
      });

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ fout: "methode niet toegestaan" });
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
