// ══════════════════════════════════════════════════════
// DE ONLINE SPELLENLIJST van Deluxe Edition 🌍
// Iedereen die op de site een spel maakt, zet het hiermee
// online — en iedereen kan elkaars spellen zien en spelen.
// Elk spel is een eigen bestandje in Vercel Blob
// (spellen/<id>.json), zodat twee makers elkaar nooit
// per ongeluk overschrijven.
// ══════════════════════════════════════════════════════
import { put, list, del } from "@vercel/blob";

const TYPES = ["vangen", "springen", "klikken"];

// Regels zodat er geen rare/kapotte spellen in de lijst komen.
function keurGoed(s) {
  if (!s || typeof s !== "object") return "geen spel ontvangen";
  if (!/^g\d{8,16}$/.test(String(s.id || ""))) return "gek id";
  if (typeof s.naam !== "string" || !s.naam.trim() || s.naam.length > 18) return "naam klopt niet";
  if (!TYPES.includes(s.type)) return "onbekend speltype";
  if (typeof s.emoji !== "string" || !s.emoji || s.emoji.length > 8) return "emoji klopt niet";
  if (!/^#[0-9a-fA-F]{6}$/.test(String(s.kleur || ""))) return "kleur klopt niet";
  if (typeof s.maker !== "string" || !s.maker.trim() || s.maker.length > 20) return "makernaam klopt niet";
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: "spellen/", limit: 200 });
      const spellen = await Promise.all(
        blobs.map(async (b) => {
          try {
            const r = await fetch(b.url, { cache: "no-store" });
            return await r.json();
          } catch { return null; }
        })
      );
      return res.status(200).json(spellen.filter(Boolean));
    }

    if (req.method === "POST") {
      const s = req.body;
      const fout = keurGoed(s);
      if (fout) return res.status(400).json({ fout });
      // Bestaat dit spel al online? Dan mag alleen de maker zelf
      // het aanpassen (✏️-knop) — anders kan iemand anders jouw
      // spel stiekem veranderen.
      const { blobs: bestaand } = await list({ prefix: `spellen/${s.id}.json`, limit: 1 });
      if (bestaand.length) {
        try {
          const oud = await (await fetch(bestaand[0].url, { cache: "no-store" })).json();
          if (oud.maker && oud.maker !== s.maker.trim().slice(0, 20)) {
            return res.status(403).json({ fout: "alleen de maker mag dit spel aanpassen" });
          }
        } catch { /* oud spel onleesbaar → overschrijven mag */ }
      }
      const schoon = {
        id: s.id,
        naam: s.naam.trim().slice(0, 18).toUpperCase(),
        type: s.type,
        emoji: s.emoji.slice(0, 8),
        kleur: s.kleur,
        maker: s.maker.trim().slice(0, 20),
        gemaakt: s.gemaakt || null,
      };
      await put(`spellen/${schoon.id}.json`, JSON.stringify(schoon), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      const maker = String(req.query.maker || "");
      if (!/^g\d{8,16}$/.test(id)) return res.status(400).json({ fout: "gek id" });
      // Alleen de maker zelf (of NovaX, de baas van de site) mag verwijderen.
      const { blobs } = await list({ prefix: `spellen/${id}.json`, limit: 1 });
      if (!blobs.length) return res.status(404).json({ fout: "spel niet gevonden" });
      const spel = await (await fetch(blobs[0].url, { cache: "no-store" })).json();
      if (spel.maker !== maker && maker !== "NovaX") {
        return res.status(403).json({ fout: "alleen de maker mag dit spel verwijderen" });
      }
      await del(blobs[0].url);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ fout: "die actie ken ik niet" });
  } catch (e) {
    return res.status(500).json({ fout: "er ging iets mis op de server", detail: String(e.message || e).slice(0, 200) });
  }
}
