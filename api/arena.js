// ══════════════════════════════════════════════════════
// DELUXE BATTLE 🚀 — twee fases
//   Fase 1: iedereen samen vs de bot (co-op)
//   Fase 2: de bot is dood → ieder voor zich (battle)
// ══════════════════════════════════════════════════════
import { put, list } from "@vercel/blob";

const LETTERS = "BCDFGHJKLMNPRSTVWXZ";
const KLEUREN = ["#ff3b3b","#3b82ff","#22c55e","#f59e0b","#a855f7","#ec4899","#06b6d4","#f97316","#84cc16","#6366f1"];

function maakCode() {
  return Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join("");
}
function schoonNaam(n) { return String(n || "").trim().replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 20); }
function schoonCode(c) { return String(c || "").toUpperCase().replace(/[^BCDFGHJKLMNPRSTVWXZ]/g, "").slice(0, 4); }

async function leesKamer(code) {
  try {
    const { blobs } = await list({ prefix: `arena/${code}.json`, limit: 1 });
    if (!blobs.length) return null;
    return await (await fetch(blobs[0].url + "?t=" + Date.now(), { cache: "no-store" })).json();
  } catch { return null; }
}

async function schrijfKamer(k) {
  await put(`arena/${k.code}.json`, JSON.stringify(k), {
    access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
  });
}

function spawnPositie(idx, totaal) {
  const hoek = (idx / Math.max(totaal, 1)) * Math.PI * 2;
  return {
    x: 400 + Math.cos(hoek) * 220,
    y: 300 + Math.sin(hoek) * 180,
    hoek: hoek + Math.PI,
  };
}

function maakBot(aantalSpelers) {
  return {
    x: 400, y: 300, hoek: 0, vx: 0, vy: 0,
    hp: 8 + aantalSpelers * 2,
    maxHp: 8 + aantalSpelers * 2,
    alive: true, bullets: [],
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {

    /* ── GET: kamer ophalen ── */
    if (req.method === "GET") {
      const code = schoonCode(req.query.code);
      if (code.length !== 4) return res.status(400).json({ fout: "ongeldige code" });
      const kamer = await leesKamer(code);
      if (!kamer) return res.status(404).json({ fout: "kamer niet gevonden" });
      return res.status(200).json(kamer);
    }

    /* ── POST: acties ── */
    if (req.method === "POST") {
      const b = req.body;
      const actie = String(b.actie || "");

      /* KAMER AANMAKEN */
      if (actie === "maak") {
        const naam = schoonNaam(b.naam);
        if (!naam) return res.status(400).json({ fout: "naam ontbreekt" });
        let code, poging = 0;
        do { code = maakCode(); poging++; } while ((await leesKamer(code)) && poging < 8);
        const pos = spawnPositie(0, 1);
        const kamer = {
          code, host: naam, state: "lobby",
          fase: "coop",           // fase 1: samen vs bot
          botKiller: null,        // wie versloeg de bot
          kills: {},              // kills per speler in de battle fase
          startTijd: 0, winnaar: null,
          bot: null,
          spelers: [{ naam, kleur: KLEUREN[0], ...pos, vx: 0, vy: 0, hp: 3, alive: true, lastUpdate: Date.now(), spawnTijd: 0 }],
          updated: Date.now(),
        };
        await schrijfKamer(kamer);
        return res.status(200).json({ code });
      }

      /* JOINEN — ook tijdens lopend spel */
      if (actie === "join") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        if (code.length !== 4 || !naam) return res.status(400).json({ fout: "ongeldige gegevens" });
        const kamer = await leesKamer(code);
        if (!kamer) return res.status(404).json({ fout: "kamer niet gevonden" });
        if (kamer.state === "klaar") return res.status(400).json({ fout: "dit spel is al afgelopen" });
        if (kamer.spelers.length >= 10) return res.status(400).json({ fout: "kamer is vol (max 10)" });
        if (kamer.spelers.find(s => s.naam === naam)) return res.status(400).json({ fout: "naam al in gebruik — kies een andere" });
        const idx = kamer.spelers.length;
        const pos = kamer.state === "lobby"
          ? spawnPositie(idx, idx + 1)
          : { x: 80 + Math.random() * 640, y: 80 + Math.random() * 440, hoek: Math.random() * Math.PI * 2 };
        const spawnTijd = kamer.state !== "lobby" ? Date.now() + 4000 : 0;
        kamer.spelers.push({ naam, kleur: KLEUREN[idx % KLEUREN.length], ...pos, vx: 0, vy: 0, hp: 3, alive: true, lastUpdate: Date.now(), spawnTijd });
        kamer.updated = Date.now();
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* STARTEN — 1 speler genoeg */
      if (actie === "start") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        const kamer = await leesKamer(code);
        if (!kamer || kamer.host !== naam) return res.status(403).json({ fout: "alleen de host kan starten" });
        if (kamer.state !== "lobby") return res.status(400).json({ fout: "al gestart" });
        const totaal = kamer.spelers.length;
        const nu = Date.now();
        kamer.spelers = kamer.spelers.map((sp, i) => {
          const pos = spawnPositie(i, totaal);
          return { ...sp, ...pos, vx: 0, vy: 0, hp: 3, alive: true, spawnTijd: nu + 4000 };
        });
        kamer.state = "aftellen";
        kamer.startTijd = nu + 4000;
        kamer.winnaar = null;
        kamer.fase = "coop";
        kamer.botKiller = null;
        kamer.kills = {};
        // Altijd bot toevoegen — het spel begint altijd in coop-fase
        kamer.bot = maakBot(totaal);
        kamer.updated = nu;
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* POSITIE UPDATEN */
      if (actie === "beweeg") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        const kamer = await leesKamer(code);
        if (!kamer || kamer.state === "lobby") return res.status(400).json({ fout: "spel is niet actief" });
        const sp = kamer.spelers.find(s => s.naam === naam);
        if (!sp) return res.status(404).json({ fout: "speler niet gevonden" });
        sp.x = Math.max(0, Math.min(800, Number(b.x) || sp.x));
        sp.y = Math.max(0, Math.min(600, Number(b.y) || sp.y));
        sp.hoek = Number(b.hoek) || sp.hoek;
        sp.vx = Number(b.vx) || 0;
        sp.vy = Number(b.vy) || 0;
        sp.lastUpdate = Date.now();
        kamer.updated = Date.now();
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* SCHADE TOEBRENGEN */
      if (actie === "schade") {
        const code = schoonCode(b.code);
        const doelwit = String(b.doelwit || "");
        const schutter = schoonNaam(b.naam); // wie schiet
        const kamer = await leesKamer(code);
        if (!kamer || kamer.state !== "game") return res.status(400).json({ fout: "spel niet actief" });

        // ── Schade aan de bot (alleen in coop-fase) ──
        if (doelwit === "__bot__") {
          if (!kamer.bot || !kamer.bot.alive || kamer.fase !== "coop") return res.status(200).json({ ok: true });
          // Rate-limit: max 1 HP-verlies per 80ms (voorkomt race-condition met meerdere spelers)
          const nu = Date.now();
          if (kamer.bot.lastHitTime && nu - kamer.bot.lastHitTime < 80) {
            return res.status(200).json({ ok: true });
          }
          kamer.bot.lastHitTime = nu;
          kamer.bot.hp = Math.max(0, kamer.bot.hp - 1);

          if (kamer.bot.hp <= 0) {
            // BOT IS DOOD → overgang naar battle-fase!
            kamer.bot.alive = false;
            kamer.bot.bullets = []; // opruimen
            kamer.botKiller = schutter || "onbekend";
            kamer.fase = "battle";
            // Iedereen die nog leeft krijgt volle HP terug
            const nu = Date.now();
            for (const sp of kamer.spelers) {
              if (sp.alive) {
                sp.hp = 3;
                sp.spawnTijd = nu + 3000; // 3 sec bescherming tijdens overgang
              }
            }
            // Solo-speler? Direct winnaar bepalen (niemand om tegen te vechten)
            const overNaBotDood = kamer.spelers.filter(s => s.alive);
            if (overNaBotDood.length <= 1) {
              kamer.state = "klaar";
              kamer.winnaar = overNaBotDood.length === 1 ? overNaBotDood[0].naam : null;
            }
          }
          kamer.updated = Date.now();
          await schrijfKamer(kamer);
          return res.status(200).json({ ok: true });
        }

        // ── Schade aan een speler (alleen in battle-fase) ──
        if (kamer.fase !== "battle") return res.status(200).json({ ok: true });
        const sp = kamer.spelers.find(s => s.naam === schoonNaam(doelwit));
        if (!sp || !sp.alive) return res.status(200).json({ ok: true });
        if (sp.spawnTijd && Date.now() < sp.spawnTijd) return res.status(200).json({ ok: true, beschermd: true });
        sp.hp = Math.max(0, sp.hp - 1);
        if (sp.hp <= 0) {
          sp.alive = false;
          // Kill bijhouden
          if (schutter) {
            kamer.kills[schutter] = (kamer.kills[schutter] || 0) + 1;
          }
          const over = kamer.spelers.filter(s => s.alive);
          if (over.length <= 1) {
            kamer.state = "klaar";
            kamer.winnaar = over.length === 1 ? over[0].naam : null;
          }
        }
        kamer.updated = Date.now();
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* BOT POSITIE UPDATEN (host stuurt dit) */
      if (actie === "bot_beweeg") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        const kamer = await leesKamer(code);
        if (!kamer || kamer.host !== naam || !kamer.bot || kamer.state !== "game" || kamer.fase !== "coop") return res.status(200).json({ ok: true });
        kamer.bot.x = Math.max(0, Math.min(800, Number(b.x) || 400));
        kamer.bot.y = Math.max(0, Math.min(600, Number(b.y) || 300));
        kamer.bot.hoek = Number(b.hoek) || 0;
        kamer.bot.vx = Number(b.vx) || 0;
        kamer.bot.vy = Number(b.vy) || 0;
        kamer.bot.bullets = Array.isArray(b.bullets) ? b.bullets.slice(0, 20) : [];
        kamer.updated = Date.now();
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* GAME STARTEN NA AFTELLEN */
      if (actie === "gamestart") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        const kamer = await leesKamer(code);
        if (!kamer || kamer.host !== naam) return res.status(403).json({ fout: "alleen de host" });
        if (kamer.state !== "aftellen") return res.status(200).json({ ok: true });
        kamer.state = "game";
        kamer.updated = Date.now();
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      /* OPNIEUW SPELEN */
      if (actie === "reset") {
        const code = schoonCode(b.code), naam = schoonNaam(b.naam);
        const kamer = await leesKamer(code);
        if (!kamer || kamer.host !== naam) return res.status(403).json({ fout: "alleen de host kan resetten" });
        const totaal = kamer.spelers.length;
        const nu = Date.now();
        kamer.spelers = kamer.spelers.map((sp, i) => {
          const pos = spawnPositie(i, totaal);
          return { ...sp, ...pos, vx: 0, vy: 0, hp: 3, alive: true, spawnTijd: nu + 4000 };
        });
        kamer.state = "aftellen";
        kamer.startTijd = nu + 4000;
        kamer.winnaar = null;
        kamer.fase = "coop";
        kamer.botKiller = null;
        kamer.kills = {};
        kamer.bot = maakBot(totaal);
        kamer.updated = nu;
        await schrijfKamer(kamer);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ fout: "onbekende actie" });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ fout: "methode niet toegestaan" });
  } catch (e) {
    return res.status(500).json({ fout: "server error", detail: String(e.message || e).slice(0, 200) });
  }
}
