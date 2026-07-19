// ══════════════════════════════════════════════════════
// STATS API — bezoeken + meest gespeelde spellen
// Één JSON-bestand in Vercel Blob: stats/data.json
// NovaX telt nooit mee.
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const BLOB_PAD = "stats/data.json";

async function laadStats() {
  const { blobs } = await list({ prefix: "stats/", limit: 1 });
  if (!blobs.length) return { bezoeken: 0, spellen: {} };
  try {
    const r = await fetch(blobs[0].url, { cache: "no-store" });
    return await r.json();
  } catch { return { bezoeken: 0, spellen: {} }; }
}

async function slaStats(data) {
  await put(BLOB_PAD, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      return res.status(200).json(await laadStats());
    }

    if (req.method === "POST") {
      const { type, spel, naam } = req.body || {};
      // NovaX telt nooit mee
      if (!naam || String(naam).trim() === "NovaX") {
        return res.status(200).json({ ok: true, overgeslagen: true });
      }

      const stats = await laadStats();

      if (type === "bezoek") {
        stats.bezoeken = (stats.bezoeken || 0) + 1;
      } else if (type === "klik" && spel) {
        if (!stats.spellen) stats.spellen = {};
        const s = String(spel).trim().slice(0, 40);
        stats.spellen[s] = (stats.spellen[s] || 0) + 1;
      } else {
        return res.status(400).json({ fout: "onbekend type" });
      }

      await slaStats(stats);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ fout: "die actie ken ik niet" });
  } catch (e) {
    return res.status(500).json({ fout: "serverfout", detail: String(e.message || e).slice(0, 200) });
  }
}
