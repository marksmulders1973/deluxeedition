// ══════════════════════════════════════════════════════
// DE KAMER — samen spelen 🤝
// Iedereen die dezelfde samen-link opent, zit in dezelfde
// kamer. Elke speler stuurt een paar keer per seconde zijn
// plek (x/z/y/yaw/ooghoogte) — en krijgt de anderen terug.
// Eén kv-rijtje per speler (kamer:<code>:<sessie>), dus
// niemand overschrijft elkaar (zelfde trucje als de race).
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

const VERS = 8 * 1000;            // even stil = niet meer te zien
const OPRUIMEN = 10 * 60 * 1000;  // oude rijtjes gooien we weg

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ fout: "alleen POST" });
    }
    const b = req.body || {};
    const code = String(b.kamer || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10);
    const sessie = String(b.sessie || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30);
    const naam = String(b.naam || "").trim().slice(0, 20) || "gast";
    if (code.length < 4 || !sessie) return res.status(400).json({ fout: "klopt niet" });
    const sleutel = `kamer:${code}:${sessie}`;
    const nu = Date.now();

    const staat = {
      sessie, naam,
      x: +(+b.x || 0).toFixed(2),
      z: +(+b.z || 0).toFixed(2),
      y: +(+b.y || 0).toFixed(2),                       // voeten-hoogte (springen!)
      yaw: +(+b.yaw || 0).toFixed(2),
      oog: Math.max(0.4, Math.min(2, +b.oog || 1.6)),   // laag = bukken/sliden
      tijd: nu,
    };
    // avatar-plaatje mag mee, maar alleen als het echt een klein SVG'tje is
    if (typeof b.avatar === "string" && b.avatar.startsWith("<svg") && b.avatar.length <= 6000 && !/script|onerror|onload|javascript:/i.test(b.avatar)) {
      staat.avatar = b.avatar;
    } else {
      const oud = await kvLees(sleutel);
      if (oud && oud.avatar) staat.avatar = oud.avatar;
    }
    await kvSchrijf(sleutel, staat);

    // de anderen in deze kamer teruggeven
    const rijen = await kvLijst(`kamer:${code}:`, 20);
    const spelers = [];
    for (const rij of rijen) {
      const p = rij.data;
      if (!p || typeof p.tijd !== "number") continue;
      if (nu - p.tijd > OPRUIMEN) { kvWis(rij.sleutel); continue; }
      if (p.sessie === sessie) continue;
      if (nu - p.tijd > VERS) continue;
      spelers.push(p);
    }
    return res.status(200).json({ spelers });
  } catch (e) {
    return res.status(500).json({ fout: "er ging iets mis op de server", detail: String(e.message || e).slice(0, 200) });
  }
}
