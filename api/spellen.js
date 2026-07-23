// ══════════════════════════════════════════════════════
// DE ONLINE SPELLENLIJST van Deluxe Edition 🌍
// Iedereen die op de site een spel maakt, zet het hiermee
// online — en iedereen kan elkaars spellen zien en spelen.
// Elk spel is een eigen bestandje in Vercel Blob
// (spellen/<id>.json), zodat twee makers elkaar nooit
// per ongeluk overschrijven.
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

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
      const rijen = await kvLijst("spel:", 200);
      return res.status(200).json(rijen.map((r) => r.data).filter(Boolean));
    }

    if (req.method === "POST") {
      const s = req.body;
      const fout = keurGoed(s);
      if (fout) return res.status(400).json({ fout });
      // Bestaat dit spel al online? Dan mag alleen de maker zelf
      // het aanpassen (✏️-knop) — anders kan iemand anders jouw
      // spel stiekem veranderen.
      const oud = await kvLees("spel:" + s.id);
      if (oud && oud.maker && oud.maker !== s.maker.trim().slice(0, 20)) {
        return res.status(403).json({ fout: "alleen de maker mag dit spel aanpassen" });
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
      await kvSchrijf("spel:" + schoon.id, schoon);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = String(req.query.id || "");
      const maker = String(req.query.maker || "");
      if (!/^g\d{8,16}$/.test(id)) return res.status(400).json({ fout: "gek id" });
      // Alleen de maker zelf (of NovaX, de baas van de site) mag verwijderen.
      const spel = await kvLees("spel:" + id);
      if (!spel) return res.status(404).json({ fout: "spel niet gevonden" });
      if (spel.maker !== maker && maker !== "NovaX") {
        return res.status(403).json({ fout: "alleen de maker mag dit spel verwijderen" });
      }
      await kvWis("spel:" + id);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ fout: "die actie ken ik niet" });
  } catch (e) {
    return res.status(500).json({ fout: "er ging iets mis op de server", detail: String(e.message || e).slice(0, 200) });
  }
}
