// ══════════════════════════════════════════════════════
// ADMIN API — bans opslaan in Vercel Blob
// Werkt op alle apparaten, niet alleen op het apparaat
// van NovaX.
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const PAD = "admin/bans.json";

async function laadBans() {
  const { blobs } = await list({ prefix: "admin/", limit: 1 });
  if (!blobs.length) return [];
  try {
    const r = await fetch(blobs[0].url, { cache: "no-store" });
    return await r.json();
  } catch { return []; }
}

async function slaBans(bans) {
  await put(PAD, JSON.stringify(bans), {
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
      return res.status(200).json(await laadBans());
    }
    if (req.method === "POST") {
      const { naam } = req.body || {};
      if (!naam || typeof naam !== "string" || naam.trim() === "NovaX") {
        return res.status(400).json({ fout: "ongeldige naam" });
      }
      const bans = await laadBans();
      const schoon = naam.trim().slice(0, 16);
      if (!bans.includes(schoon)) { bans.push(schoon); await slaBans(bans); }
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const naam = String(req.query.naam || "").trim().slice(0, 16);
      if (!naam) return res.status(400).json({ fout: "geen naam" });
      const bans = (await laadBans()).filter(n => n !== naam);
      await slaBans(bans);
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
