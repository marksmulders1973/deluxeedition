// ══════════════════════════════════════════════════════
// SPELERS API — lijst van iedereen die ooit langs is geweest
// Zodat NovaX in het AP-paneel namen kan aanklikken.
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const PAD = "spelers/lijst.json";

async function laad() {
  const { blobs } = await list({ prefix: "spelers/", limit: 1 });
  if (!blobs.length) return [];
  try { return await (await fetch(blobs[0].url, { cache: "no-store" })).json(); } catch { return []; }
}

async function sla(data) {
  await put(PAD, JSON.stringify(data), {
    access: "public", addRandomSuffix: false,
    allowOverwrite: true, contentType: "application/json",
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") return res.status(200).json(await laad());
    if (req.method === "POST") {
      const { naam } = req.body || {};
      if (!naam || naam === "NovaX") return res.status(200).json({ ok: true });
      const lijst = await laad();
      const s = String(naam).trim().slice(0, 16);
      if (!lijst.includes(s)) { lijst.push(s); await sla(lijst); }
      return res.status(200).json({ ok: true });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
