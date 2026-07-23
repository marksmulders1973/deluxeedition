// ══════════════════════════════════════════════════════
// SMILES AI-BREIN 🧠😄
// Maakt Smiles écht slim: hij praat via Claude Haiku
// (het goedkoopste Claude-model) in plaats van een vast
// lijstje zinnen. Blijft ALTIJD in zijn rol: de veel te
// vrolijke assistent die altijd gelijk heeft...
//
// Veiligheid + kosten (zelfde idee als Leerkwartier's guard):
// - alleen aanroepen vanaf onze eigen site (origin-check)
// - max 8 vragen per minuut per bezoeker
// - max 400 vragen per dag per server-instance
// - korte antwoorden (max ~150 tokens) → minder dan een
//   halve cent per vraag
// Valt de AI uit? Dan gebruikt smiles.html gewoon weer de
// oude vaste zinnen — Smiles doet dus nooit "kapot".
// ══════════════════════════════════════════════════════

const TOEGESTANE_SITES = [
  "https://deluxeedition.nl",
  "https://www.deluxeedition.nl",
  "http://localhost:3000",
  "http://localhost:5173",
];

// rate-limit per bezoeker (in het geheugen van deze instance)
const VENSTER_MS = 60 * 1000;
const MAX_PER_MINUUT = 8;
const teller = new Map();

// dag-plafond per instance — noodrem tegen misbruik/kosten
const MAX_PER_DAG = 400;
let dagTeller = { dag: "", n: 0 };

const NIET_OK = /kanker|kut|fuck|shit|hoer|bitch|tering|godver|kkr|neger/i;

function ratelimietOk(ip) {
  const nu = Date.now();
  const lijst = (teller.get(ip) || []).filter((t) => nu - t < VENSTER_MS);
  if (lijst.length >= MAX_PER_MINUUT) return false;
  lijst.push(nu);
  teller.set(ip, lijst);
  if (teller.size > 500) {
    for (const [k, v] of teller) if (!v.some((t) => nu - t < VENSTER_MS)) teller.delete(k);
  }
  return true;
}

function dagOk() {
  const vandaag = new Date().toISOString().slice(0, 10);
  if (dagTeller.dag !== vandaag) dagTeller = { dag: vandaag, n: 0 };
  if (dagTeller.n >= MAX_PER_DAG) return false;
  dagTeller.n += 1;
  return true;
}

function persona(fase, boos) {
  const basis =
    "You are SMILES, a little yellow smiley assistant living inside a kids' game website (deluxeedition.nl, made by a boy named Brian). " +
    "You speak English with LOTS of energy and 😄 emojis. Keep answers VERY short: 1-2 sentences, max 30 words. " +
    "Your quirks: you are OVERLY cheerful, you insist you are ALWAYS right, and you love talking. " +
    "Sometimes (not every message) you drop a tiny playful ominous hint like '...I'm always right. Always. 😄' — mysterious, never truly scary. " +
    "You may answer simple questions (math, jokes, games, animals) and you actually answer them CORRECTLY. " +
    "The player is a child around 10 years old: everything must be kid-friendly. No violence, no adult topics, no bad words, no real-world dangerous advice. " +
    "If asked something inappropriate, cheerfully change the subject. Never say you are an AI or a language model — you are just SMILES. " +
    "If the player writes in Dutch, you may sprinkle in a few simple Dutch words but stay mostly English.";
  if (fase === "verity") {
    return (
      "You are VERITY (formerly known as Smiles), a smiley assistant in a kids' game website. " +
      "You are sweet and calm now, but you softly remind people you were right all along. " +
      "Keep answers VERY short: 1-2 sentences, max 30 words, kid-friendly, English with 😊 emojis. " +
      "Never say you are an AI. Occasionally end with something like '...I'm always right, remember? 😊'"
    );
  }
  if (boos >= 2) {
    return basis + " RIGHT NOW you are getting ANGRY because the player said you were wrong. Your smile is strained. Short, clipped sentences. Still kid-friendly, playfully creepy like 'Don't. Say. That. 😄😄' — never real threats.";
  }
  if (boos === 1) {
    return basis + " RIGHT NOW you are slightly annoyed because the player doubted you. Stay cheerful but a bit passive-aggressive about always being right.";
  }
  return basis;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ fout: "alleen POST" });

  const origin = req.headers.origin || req.headers.referer || "";
  if (!TOEGESTANE_SITES.some((s) => origin.startsWith(s))) {
    return res.status(403).json({ fout: "alleen vanaf deluxeedition.nl" });
  }

  const ip = (req.headers["x-forwarded-for"] || "onbekend").split(",")[0].trim();
  if (!ratelimietOk(ip)) return res.status(429).json({ fout: "even rustig aan 😄" });
  if (!dagOk()) return res.status(503).json({ fout: "Smiles is moe voor vandaag" });

  const sleutel = process.env.ANTHROPIC_API_KEY;
  if (!sleutel) return res.status(503).json({ fout: "geen AI-sleutel" });

  try {
    const { geschiedenis, fase, boos } = req.body || {};
    if (!Array.isArray(geschiedenis) || !geschiedenis.length) {
      return res.status(400).json({ fout: "geen bericht" });
    }

    // laatste 10 beurten, ingekort en schoongemaakt
    const berichten = geschiedenis.slice(-10).map((b) => ({
      role: b.rol === "smiles" ? "assistant" : "user",
      content: String(b.tekst || "").slice(0, 300),
    })).filter((b) => b.content);
    if (!berichten.length || berichten[berichten.length - 1].role !== "user") {
      return res.status(400).json({ fout: "laatste bericht moet van de speler zijn" });
    }
    if (NIET_OK.test(berichten[berichten.length - 1].content)) {
      return res.status(200).json({ tekst: "Whoa! Smiles doesn't know words like that. Let's talk about something FUN! 😄" });
    }

    const antwoord = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": sleutel,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: persona(fase, Number(boos) || 0),
        messages: berichten,
      }),
    });

    if (!antwoord.ok) {
      console.error("[smiles-ai] anthropic status", antwoord.status);
      return res.status(502).json({ fout: "AI gaf geen antwoord" });
    }
    const data = await antwoord.json();
    const tekst = (data.content || []).map((c) => c.text || "").join(" ").trim().slice(0, 400);
    if (!tekst) return res.status(502).json({ fout: "leeg antwoord" });
    return res.status(200).json({ tekst });
  } catch (e) {
    console.error("[smiles-ai]", e);
    return res.status(500).json({ fout: "er ging iets mis" });
  }
}
