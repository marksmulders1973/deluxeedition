// ══════════════════════════════════════════════════════
// ONLINE AANWEZIGHEID — wie is er nu op de site?
// Elke speler stuurt elke 30 sec een ping.
// Spelers die de afgelopen 2 minuten pingden = online.
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const PAD = "online/aanwezig.json";
const TIMEOUT_MS = 2 * 60 * 1000; // 2 minuten

async function laad() {
  const { blobs } = await list({ prefix: "online/", limit: 1 });
  if (!blobs.length) return {};
  try { return await (await fetch(blobs[0].url, { cache: "no-store" })).json(); } catch { return {}; }
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
    if (req.method === "POST") {
      const { naam } = req.body || {};
      if (!naam || naam === "NovaX") return res.status(200).json({ ok: true });
      const data = await laad();
      data[String(naam).trim().slice(0, 16)] = Date.now();
      // Oude vermeldingen opruimen (> 5 min weg)
      const nu = Date.now();
      Object.keys(data).forEach(k => { if (nu - data[k] > 5 * 60 * 1000) delete data[k]; });
      await sla(data);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "GET") {
      const data = await laad();
      const nu = Date.now();
      const online = Object.entries(data)
        .filter(([, t]) => nu - t < TIMEOUT_MS)
        .map(([naam]) => naam);
      return res.status(200).json({ aantal: online.length, namen: online });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
