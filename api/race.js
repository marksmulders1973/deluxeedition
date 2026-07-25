// ══════════════════════════════════════════════════════
// DE LIVE RACE-SERVER van Deluxe Edition 🌍🏁
// Iedereen die hetzelfde spel speelt in de "MET ECHTE
// MENSEN"-stand, stuurt hier elke paar seconden zijn
// score heen — en krijgt de scores van de anderen terug.
// Elke speler heeft zijn eigen bestandje in Vercel Blob
// (race/<spelId>/<sessie>.json), dus niemand overschrijft
// elkaar. Spelers die 25 sec niks laten horen, zijn weg.
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

const VERS = 25 * 1000;        // zo lang telt een speler als "aanwezig"
const OPRUIMEN = 10 * 60 * 1000; // oudere bestandjes gooien we weg

function schoon(b) {
  if (!b || typeof b !== "object") return null;
  const spelId = String(b.spel || "");
  if (!/^g\d{8,16}$/.test(spelId)) return null;
  const sessie = String(b.sessie || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30);
  const naam = String(b.naam || "").trim().slice(0, 20);
  if (!sessie || !naam) return null;
  const score = Math.max(0, Math.min(999999, parseInt(b.score, 10) || 0));
  return { spelId, sessie, naam, score, klaar: !!b.klaar, tijd: Date.now() };
}

// ══════════════════════════════════════════════════════
// DE KAMER — samen spelen 🤝
// Iedereen met dezelfde samen-link zit in dezelfde kamer.
// Elke speler stuurt een paar keer per seconde zijn plek
// (x/z/y/yaw/ooghoogte) — en krijgt de anderen terug.
// Eén kv-rijtje per speler: kamer:<code>:<sessie>.
// ══════════════════════════════════════════════════════
const KAMER_VERS = 8 * 1000;             // even stil = niet meer te zien
const KAMER_OPRUIMEN = 10 * 60 * 1000;   // oude rijtjes weggooien

async function kamerTik(b, res) {
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
    if (nu - p.tijd > KAMER_OPRUIMEN) { kvWis(rij.sleutel); continue; }
    if (p.sessie === sessie) continue;
    if (nu - p.tijd > KAMER_VERS) continue;
    spelers.push(p);
  }
  return res.status(200).json({ spelers });
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const spelId = String(req.query.spel || "");
      if (!/^g\d{8,16}$/.test(spelId)) return res.status(400).json({ fout: "gek spel-id" });
      const rijen = await kvLijst(`race:${spelId}:`, 30);
      const nu = Date.now();
      const spelers = rijen.map((rij) => {
        const p = rij.data;
        if (!p || typeof p.tijd !== "number") return null;
        if (nu - p.tijd > OPRUIMEN) { kvWis(rij.sleutel); return null; } // oude rommel opruimen
        if (nu - p.tijd > VERS) return null; // even stil = niet meer in de race
        return { sessie: p.sessie, naam: p.naam, score: p.score, klaar: p.klaar };
      });
      return res.status(200).json(spelers.filter(Boolean));
    }

    if (req.method === "POST") {
      // ── DE KAMER 🤝: samen-spelen-heartbeat (zit hier ingebouwd
      //    omdat Vercel Hobby maar 12 losse api-functies toestaat) ──
      if (req.body && req.body.kamer) return kamerTik(req.body, res);

      const p = schoon(req.body);
      if (!p) return res.status(400).json({ fout: "klopt niet" });
      await kvSchrijf(`race:${p.spelId}:${p.sessie}`, p);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ fout: "die actie ken ik niet" });
  } catch (e) {
    return res.status(500).json({ fout: "er ging iets mis op de server", detail: String(e.message || e).slice(0, 200) });
  }
}
