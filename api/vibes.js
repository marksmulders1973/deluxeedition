// ══════════════════════════════════════════════════════
// VIBES API — NovaX geeft een vibe, speler ziet hem op scherm
// Opgeslagen in Vercel Blob: vibes/pending.json
// { "spelerNaam": { emoji, naam, wanneer }, ... }
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

const SLEUTEL = "vibes";
const laad = () => kvLees(SLEUTEL, {});
const sla = (data) => kvSchrijf(SLEUTEL, data);

// 🎁 CADEAU-KANAAL — NovaX stuurt gericht een sprite/level/reset naar 1 speler;
// de OBLITERATOR-game pollt dit elke 10s (?cadeau=1), ook middenin een potje.
const CADEAU_SLEUTEL = "cadeaus";
const laadCadeaus = () => kvLees(CADEAU_SLEUTEL, {});
const slaCadeaus = (data) => kvSchrijf(CADEAU_SLEUTEL, data);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const cadeauModus = String(req.query.cadeau || "") === "1" || !!(req.body && req.body.cadeau);
    if (req.method === "GET") {
      const naam = String(req.query.naam || "").trim();
      if (!naam) return res.status(400).json({ fout: "geen naam" });
      if (cadeauModus) {
        const data = await laadCadeaus();
        return res.status(200).json(data[naam] || []);
      }
      const data = await laad();
      return res.status(200).json(data[naam] || null);
    }
    if (req.method === "POST" && cadeauModus) {
      const { speler, cadeau } = req.body || {};
      const soort = String(cadeau?.soort || "");
      if (!speler || !["sprite", "level", "reset"].includes(soort)) return res.status(400).json({ fout: "missende velden" });
      const item = { soort, wanneer: new Date().toISOString() };
      if (soort === "sprite") item.sprite = String(cadeau.sprite || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 30);
      if (soort === "level") item.level = Math.max(1, Math.min(500, Math.floor(Number(cadeau.level) || 0)));
      const data = await laadCadeaus();
      const naam = String(speler).trim().slice(0, 16);
      data[naam] = [...(data[naam] || []), item].slice(-10);
      await slaCadeaus(data);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "POST") {
      const { speler, vibe } = req.body || {};
      if (!speler || !vibe?.naam) return res.status(400).json({ fout: "missende velden" });
      const data = await laad();
      const item = {
        emoji: String(vibe.emoji || "✨").slice(0, 8),
        naam: String(vibe.naam).slice(0, 30),
        wanneer: new Date().toISOString(),
      };
      // 🎁 GEEF ALLES — NovaX stuurt een hele lijst vibes in één keer
      if (Array.isArray(vibe.meerdere)) {
        item.meerdere = vibe.meerdere
          .slice(0, 60)
          .map((v) => ({
            emoji: String(v?.emoji || "✨").slice(0, 8),
            naam: String(v?.naam || "").slice(0, 30),
          }))
          .filter((v) => v.naam);
      }
      data[String(speler).trim().slice(0, 16)] = item;
      await sla(data);
      return res.status(200).json({ ok: true });
    }
    if (req.method === "DELETE") {
      const naam = String(req.query.naam || "").trim();
      if (!naam) return res.status(400).json({ fout: "geen naam" });
      if (cadeauModus) {
        const data = await laadCadeaus();
        delete data[naam];
        await slaCadeaus(data);
        return res.status(200).json({ ok: true });
      }
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
