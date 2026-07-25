// ══════════════════════════════════════════════════════
// ADMIN API — bans opslaan in Vercel Blob
// Werkt op alle apparaten, niet alleen op het apparaat
// van NovaX.
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

const SLEUTEL = "admin-bans";
const laadBans = () => kvLees(SLEUTEL, []);
const slaBans = (bans) => kvSchrijf(SLEUTEL, bans);

// 📣 OMROEPER — admin typt een bericht, iedereen op de site ziet het ~90 sec
const OMROEP_SLEUTEL = "admin-omroep";
const OMROEP_DUUR_MS = 90 * 1000;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const omroepModus = String(req.query.bericht || "") === "1" || !!(req.body && req.body.bericht);
    if (req.method === "GET" && omroepModus) {
      const b = await kvLees(OMROEP_SLEUTEL, null);
      if (!b || !b.tot || Date.now() > b.tot) return res.status(200).json(null);
      return res.status(200).json(b);
    }
    if (req.method === "POST" && omroepModus) {
      const { bericht } = req.body || {};
      const tekst = String(bericht?.tekst || "").replace(/[<>]/g, "").trim().slice(0, 120);
      if (!tekst) return res.status(400).json({ fout: "geen tekst" });
      const b = {
        tekst,
        van: String(bericht?.van || "Admin").trim().slice(0, 16),
        tot: Date.now() + OMROEP_DUUR_MS,
      };
      await kvSchrijf(OMROEP_SLEUTEL, b);
      return res.status(200).json({ ok: true });
    }
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
