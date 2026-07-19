// ══════════════════════════════════════════════════════
// VIBES API — NovaX geeft een vibe, speler ziet hem op scherm
// Opgeslagen in Vercel Blob: vibes/pending.json
// { "spelerNaam": { emoji, naam, wanneer }, ... }
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const PAD = "vibes/pending.json";

async function laad() {
  const { blobs } = await list({ prefix: "vibes/", limit: 1 });
  if (!blobs.length) return {};
  try { return await (await fetch(blobs[0].url, { cache: "no-store" })).json(); } catch { return {}; }
}

async function sla(data) {
  await put(PAD, JSON.stringify(data), {
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
      const naam = String(req.query.naam || "").trim();
      if (!naam) return res.status(400).json({ fout: "geen naam" });
      const data = await laad();
      return res.status(200).json(data[naam] || null);
    }
    if (req.method === "POST") {
      const { speler, vibe } = req.body || {};
      if (!speler || !vibe?.naam) return res.status(400).json({ fout: "missende velden" });
      const data = await laad();
      data[String(speler).trim().slice(0, 16)] = {
        emoji: String(vibe.emoji || "✨").slice(0, 8),
        naam: String(vibe.naam).slice(0, 30),
        wanneer: new Date().toISOString(),
      };
      await sla(data);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const naam = String(req.query.naam || "").trim();
      if (!naam) return res.status(400).json({ fout: "geen naam" });
      const data = await laad();
      delete data[naam];
      await sla(data);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
