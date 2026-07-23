// ══════════════════════════════════════════════════════
// DE CHAT van Deluxe Edition 💬
// Eén gedeeld praatvenster voor iedereen op de site.
// Alle berichten staan samen in één bestandje in Vercel
// Blob (chat/berichten.json); we bewaren de laatste 60.
// De bots praten NIET via deze server — die antwoorden
// razendsnel in je eigen browser (zie chat.html).
// ══════════════════════════════════════════════════════
import { kvLees, kvSchrijf, kvWis, kvLijst } from "./_kv.js";

const MAX_BERICHTEN = 60;

// Woorden die we niet in de chat willen (site voor kinderen!).
const NIET_OK = /kanker|kut|fuck|shit|hoer|bitch|tering|godver|kkr|neger|homo\b/i;

function schoonBericht(b) {
  if (!b || typeof b !== "object") return null;
  const naam = String(b.naam || "").trim().slice(0, 20);
  const tekst = String(b.tekst || "").trim().slice(0, 200);
  if (!naam || !tekst) return null;
  if (NIET_OK.test(naam) || NIET_OK.test(tekst)) return "vies";
  // avatar-plaatje mag mee, maar alleen als het echt een klein SVG'tje is
  let avatar = "";
  if (typeof b.avatar === "string" && b.avatar.startsWith("<svg") && b.avatar.length <= 6000 && !/script|onerror|onload|javascript:/i.test(b.avatar)) {
    avatar = b.avatar;
  }
  return { naam, tekst, avatar, tijd: Date.now() };
}

async function leesBerichten() {
  const lijst = await kvLees("chat-berichten", []);
  return Array.isArray(lijst) ? lijst : [];
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      return res.status(200).json(await leesBerichten());
    }

    if (req.method === "POST") {
      const nieuw = schoonBericht(req.body);
      if (nieuw === "vies") return res.status(400).json({ fout: "dat soort woorden horen niet in onze chat 🙅" });
      if (!nieuw) return res.status(400).json({ fout: "leeg bericht" });
      const lijst = await leesBerichten();
      lijst.push(nieuw);
      const bewaren = lijst.slice(-MAX_BERICHTEN);
      await kvSchrijf("chat-berichten", bewaren);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ fout: "die actie ken ik niet" });
  } catch (e) {
    return res.status(500).json({ fout: "er ging iets mis op de server", detail: String(e.message || e).slice(0, 200) });
  }
}
