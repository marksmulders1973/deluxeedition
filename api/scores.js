// ══════════════════════════════════════════════════════
// SCORES API — OBLITERATOR highscores via Vercel Blob
// GET ?periode=vandaag|week|alltime&limit=25
// POST { naam, score, level }
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const PAD = "scores/obliterator.json";
const MAX_BEWAARD = 500; // bewaar maximaal 500 runs

async function laad() {
  const { blobs } = await list({ prefix: "scores/", limit: 1 });
  if (!blobs.length) return [];
  try { return await (await fetch(blobs[0].url, { cache: "no-store" })).json(); } catch { return []; }
}

async function sla(scores) {
  await put(PAD, JSON.stringify(scores), {
    access: "public", addRandomSuffix: false,
    allowOverwrite: true, contentType: "application/json",
  });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const periode = String(req.query.periode || "alltime");
      const limit   = Math.min(parseInt(req.query.limit, 10) || 25, 100);
      let scores = await laad();

      if (periode === "vandaag") {
        const nu = new Date();
        const start = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate()).getTime();
        scores = scores.filter(s => s.ts >= start);
      } else if (periode === "week") {
        const nu = new Date();
        const dag = (nu.getDay() + 6) % 7; // ma=0
        const maandag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate() - dag).getTime();
        scores = scores.filter(s => s.ts >= maandag);
      }

      scores.sort((a, b) => b.score - a.score || a.ts - b.ts);
      return res.status(200).json(
        scores.slice(0, limit).map(s => ({
          naam: s.naam,
          score: s.score,
          level: s.level || null,
          datum: new Date(s.ts).toISOString().slice(0, 10),
        }))
      );
    }

    if (req.method === "POST") {
      const { naam, score, level } = req.body || {};
      if (!score || Number(score) <= 0) return res.status(400).json({ fout: "geen score" });
      const scores = await laad();
      scores.push({
        naam: String(naam || "Speler").trim().slice(0, 30),
        score: Math.floor(Number(score)),
        level: level ? Math.floor(Number(level)) : null,
        ts: Date.now(),
      });
      scores.sort((a, b) => b.score - a.score);
      await sla(scores.slice(0, MAX_BEWAARD));
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ fout: String(e.message || e).slice(0, 200) });
  }
}
