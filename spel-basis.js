// ══════════════════════════════════════════════════════
// spel-basis.js — gedeelde hulpjes voor de Claude-spellen
// • geefKeys()  → keys verdienen in de gezamenlijke spaarpot
// • basisCanvas() → canvas dat automatisch meegroeit
// • editorKlaar() → het ✏️ EDIT-systeem voor Arthur & Sahasra:
//   Arthur, Sahasra (of NovaX) mogen de instellingen van dit
//   spel aanpassen, zo vaak ze willen — iedereen speelt daarna
//   met die versie. Opslag op de server via /api/spellen?stel=…
// ══════════════════════════════════════════════════════

// ── 🗝️ keys (zelfde spaarpot als de winkel, max 25/dag per spel) ──
function geefKeys(n, spel) {
  try {
    const vandaag = new Date().toDateString();
    const dagSleutel = "deluxe-dagkeys-" + spel;
    let d = {};
    try { d = JSON.parse(localStorage.getItem(dagSleutel)) || {}; } catch (e) {}
    if (d.dag !== vandaag) d = { dag: vandaag, verdiend: 0 };
    const erbij = Math.max(0, Math.min(n, 25 - d.verdiend));
    if (erbij > 0) {
      d.verdiend += erbij;
      localStorage.setItem(dagSleutel, JSON.stringify(d));
      const saldo = (parseInt(localStorage.getItem("deluxe-keys") || "0", 10) || 0) + erbij;
      localStorage.setItem("deluxe-keys", String(saldo));
    }
    return erbij;
  } catch (e) { return 0; }
}
function keysTekst(aantal) {
  return aantal > 0 ? "🗝️ <b>+" + aantal + " keys</b> voor de winkel!" : "🗝️ dag-limiet bereikt (morgen weer keys!)";
}

// ── speler + rechten ──
function spelerNaam() { try { return localStorage.getItem("deluxe-speler") || ""; } catch (e) { return ""; } }
function magEditen() {
  const n = spelerNaam().toLowerCase();
  return n.includes("arthur") || n.includes("sahasra") || n === "novax";
}

// ── canvas dat meegroeit met het scherm ──
function basisCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  const m = { ctx, W: 0, H: 0 };
  function maat() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    m.W = window.innerWidth; m.H = window.innerHeight;
    canvas.width = m.W * dpr; canvas.height = m.H * dpr;
    canvas.style.width = m.W + "px"; canvas.style.height = m.H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  maat();
  window.addEventListener("resize", maat);
  return m;
}

// ── record bijhouden ──
function zetRecord(sleutel, score) {
  const best = Math.max(score, parseInt(localStorage.getItem(sleutel) || "0", 10) || 0);
  localStorage.setItem(sleutel, String(best));
  return best;
}

// ══════════════════════════════════════════════════════
// ✏️ HET EDITOR-SYSTEEM (voor Arthur — en NovaX natuurlijk)
//
// editorKlaar(spelId, velden, standaard, pasToe)
//   spelId    bv. "zombietik"
//   velden    [{sleutel, label, soort:'schuif'|'tekst'|'keuze',
//               min, max, stap, maxLen, keuzes:[{w, label}]}]
//   standaard {sleutel: waarde, ...}
//   pasToe(waarden, door) — wordt aangeroepen bij laden én na opslaan
// ══════════════════════════════════════════════════════
function editorKlaar(spelId, velden, standaard, pasToe) {
  let huidige = { ...standaard };
  let door = null;

  function schoon(ruw) {
    const uit = { ...standaard };
    if (!ruw || typeof ruw !== "object") return uit;
    for (const v of velden) {
      const w = ruw[v.sleutel];
      if (w === undefined || w === null) continue;
      if (v.soort === "schuif") {
        const g = Number(w);
        if (isFinite(g)) uit[v.sleutel] = Math.max(v.min, Math.min(v.max, g));
      } else if (v.soort === "tekst") {
        const t = String(w).slice(0, v.maxLen || 12);
        if (t.trim()) uit[v.sleutel] = t;
      } else if (v.soort === "keuze") {
        if (v.keuzes.some(k => k.w === w)) uit[v.sleutel] = w;
      }
    }
    return uit;
  }

  function toonBadge() {
    let b = document.getElementById("editBadge");
    if (!door) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("div"); b.id = "editBadge"; document.body.appendChild(b); }
    b.textContent = "⚙️ afgesteld door " + door;
  }

  // instellingen van de server halen (Arthur's laatste versie)
  fetch("/api/spellen?stel=" + spelId, { cache: "no-store" })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && data.instellingen && Object.keys(data.instellingen).length) {
        huidige = schoon(data.instellingen);
        door = data.door || null;
      }
      toonBadge();
      pasToe(huidige, door);
    })
    .catch(() => pasToe(huidige, null));

  // geen edit-rechten? dan alleen spelen
  if (!magEditen()) return;

  const knop = document.createElement("button");
  knop.id = "editKnop";
  knop.textContent = "✏️ EDIT (" + (spelerNaam() || "?") + ")";
  document.body.appendChild(knop);

  knop.addEventListener("click", () => {
    const oud = document.getElementById("editOverlay");
    if (oud) { oud.remove(); return; }
    const ov = document.createElement("div");
    ov.id = "editOverlay";
    const doos = document.createElement("div");
    doos.className = "doos";
    doos.innerHTML = "<h2>✏️ Stel dit spel af</h2><div class='wie'>Jouw versie geldt voor iedereen — en je mag zo vaak veranderen als je wil!</div>";

    const invoer = {};
    for (const v of velden) {
      const veld = document.createElement("div");
      veld.className = "editVeld";
      const label = document.createElement("label");
      label.textContent = v.label;
      veld.appendChild(label);
      if (v.soort === "schuif") {
        const s = document.createElement("input");
        s.type = "range"; s.min = v.min; s.max = v.max; s.step = v.stap || 1;
        s.value = huidige[v.sleutel];
        const w = document.createElement("span");
        w.className = "waarde"; w.textContent = s.value;
        s.addEventListener("input", () => { w.textContent = s.value; });
        label.appendChild(w);
        veld.appendChild(s);
        invoer[v.sleutel] = () => Number(s.value);
      } else if (v.soort === "tekst") {
        const t = document.createElement("input");
        t.type = "text"; t.maxLength = v.maxLen || 12; t.value = huidige[v.sleutel];
        veld.appendChild(t);
        invoer[v.sleutel] = () => t.value;
      } else {
        const sel = document.createElement("select");
        for (const k of v.keuzes) {
          const o = document.createElement("option");
          o.value = k.w; o.textContent = k.label;
          if (k.w === huidige[v.sleutel]) o.selected = true;
          sel.appendChild(o);
        }
        veld.appendChild(sel);
        invoer[v.sleutel] = () => (sel.value === "true" ? true : sel.value === "false" ? false : (v.keuzes.some(k => k.w === Number(sel.value)) ? Number(sel.value) : sel.value));
      }
      doos.appendChild(veld);
    }

    const knoppen = document.createElement("div");
    knoppen.className = "editKnoppen";
    const opslaan = document.createElement("button");
    opslaan.className = "knop"; opslaan.textContent = "💾 OPSLAAN";
    const reset = document.createElement("button");
    reset.className = "knop weg"; reset.textContent = "↺ STANDAARD";
    const dicht = document.createElement("button");
    dicht.className = "knop weg"; dicht.textContent = "✕";
    knoppen.append(opslaan, reset, dicht);
    doos.appendChild(knoppen);
    const melding = document.createElement("div");
    melding.style.cssText = "margin-top:10px;font-size:14px;color:#9aa4c7;min-height:20px";
    doos.appendChild(melding);
    ov.appendChild(doos);
    document.body.appendChild(ov);
    ov.addEventListener("click", e => { if (e.target === ov) ov.remove(); });
    dicht.addEventListener("click", () => ov.remove());

    async function stuur(waarden) {
      melding.textContent = "opslaan…";
      try {
        const r = await fetch("/api/spellen?stel=1", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spel: spelId, naam: spelerNaam(), instellingen: waarden }),
        });
        const uit = await r.json().catch(() => ({}));
        if (!r.ok) { melding.textContent = "❌ " + (uit.fout || "opslaan mislukt"); return; }
        huidige = schoon(waarden);
        door = Object.keys(waarden).length ? spelerNaam() : null;
        toonBadge();
        pasToe(huidige, door);
        melding.textContent = "✅ opgeslagen — iedereen speelt nu jouw versie!";
        setTimeout(() => ov.remove(), 900);
      } catch (e) { melding.textContent = "❌ geen verbinding"; }
    }
    opslaan.addEventListener("click", () => {
      const waarden = {};
      for (const v of velden) waarden[v.sleutel] = invoer[v.sleutel]();
      stuur(schoon(waarden));
    });
    reset.addEventListener("click", () => stuur({}));
  });
}
