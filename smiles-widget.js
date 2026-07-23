/* smiles-widget.js — Smiles rolt achter je muis aan + mini-chat tijdens het spelen */
(function () {
  try {
    const mods = JSON.parse(localStorage.getItem('deluxe-mods') || '[]');
    if (!mods.includes('smiles')) return;
  } catch { return; }

  /* ── CSS ── */
  const css = document.createElement('style');
  css.textContent = `
  #sw-rol {
    position: fixed; z-index: 9999; pointer-events: none;
    width: 52px; height: 52px; transform-origin: center;
  }
  #sw-rol svg { width: 100%; height: 100%; display: block; }
  #sw-knop {
    position: fixed; bottom: 16px; right: 16px; z-index: 9998;
    width: 52px; height: 52px; border-radius: 50%;
    background: linear-gradient(135deg, #ff3b3b, #3b82ff);
    border: 3px solid rgba(255,255,255,0.3);
    cursor: pointer; pointer-events: all;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    animation: sw-puls 2.4s ease-in-out infinite;
  }
  @keyframes sw-puls {
    0%,100% { box-shadow: 0 4px 20px rgba(0,0,0,0.6); }
    50% { box-shadow: 0 4px 32px rgba(255,59,59,0.55), 0 4px 32px rgba(59,130,255,0.35); }
  }
  #sw-knop svg { width: 34px; height: 34px; }
  #sw-panel {
    position: fixed; bottom: 78px; right: 16px; z-index: 9999;
    width: 270px; background: rgba(5,7,15,0.96);
    border: 1px solid rgba(255,217,59,0.35); border-radius: 16px;
    padding: 12px; gap: 8px;
    pointer-events: all; backdrop-filter: blur(12px);
    display: none; flex-direction: column;
  }
  #sw-panel.open { display: flex; }
  #sw-naam { font: 700 12px/1 system-ui,sans-serif; color: rgba(255,217,59,0.8); }
  #sw-x {
    position: absolute; top: 8px; right: 10px;
    background: none; border: none; color: rgba(255,255,255,0.35);
    font-size: 15px; cursor: pointer; padding: 0 4px; pointer-events: all;
  }
  #sw-x:hover { color: #fff; }
  #sw-log {
    max-height: 150px; overflow-y: auto;
    display: flex; flex-direction: column; gap: 6px;
  }
  .sw-b {
    max-width: 92%; padding: 6px 11px; border-radius: 12px;
    font: 13px/1.35 system-ui,sans-serif; color: #fff;
  }
  .sw-b.s { align-self: flex-start; background: rgba(255,217,59,0.11); border: 1px solid rgba(255,217,59,0.3); }
  .sw-b.j { align-self: flex-end; background: rgba(59,130,255,0.17); border: 1px solid rgba(59,130,255,0.4); }
  #sw-rij { display: flex; gap: 6px; }
  #sw-inp {
    flex: 1; background: rgba(0,0,0,0.5); color: #fff;
    border: 1.5px solid rgba(255,217,59,0.4); border-radius: 10px;
    padding: 8px 10px; font: 13px system-ui,sans-serif; outline: none;
  }
  #sw-send {
    background: linear-gradient(90deg,#c9a227,#ffd93b);
    color: #201a00; border: none; border-radius: 10px;
    padding: 8px 12px; font: 900 14px system-ui,sans-serif; cursor: pointer;
  }
  #sw-bel {
    position: fixed; z-index: 9997; pointer-events: none;
    background: rgba(5,7,15,0.93); border: 1px solid rgba(255,217,59,0.4);
    border-radius: 12px; padding: 7px 12px;
    color: #fff; font: 12.5px system-ui,sans-serif;
    max-width: 190px; white-space: normal;
    opacity: 0; transition: opacity 0.4s;
  }
  #sw-bel.aan { opacity: 1; }

  /* ── 😈 HORROR-STAND (timer om!) ── */
  #sw-doem {
    position: fixed; inset: 0; z-index: 9990; pointer-events: none; display: none;
    background: radial-gradient(circle at 50% 45%, rgba(25,0,8,0.15), rgba(0,0,0,0.78) 92%);
    animation: sw-flikker 5s infinite;
  }
  @keyframes sw-flikker {
    0%,88%,100% { opacity: 1; }
    90% { opacity: .5; } 92% { opacity: 1; } 95% { opacity: .65; } 97% { opacity: 1; }
  }
  #sw-flits {
    position: fixed; inset: 0; z-index: 10001; pointer-events: none;
    background: radial-gradient(circle, #fff 30%, #ff2222 100%); opacity: 0;
    transition: opacity 0.9s;
  }
  #sw-banner {
    display: none; position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
    z-index: 9995; background: rgba(25,0,0,0.93); border: 2px solid #ff2222;
    color: #fff; font: 800 12.5px system-ui,sans-serif; padding: 8px 16px;
    border-radius: 999px; text-decoration: none; pointer-events: all;
    animation: sw-bang 1.2s infinite; max-width: 92vw; text-align: center;
  }
  @keyframes sw-bang {
    0%,100% { box-shadow: 0 0 10px rgba(255,0,0,0.5); }
    50% { box-shadow: 0 0 28px rgba(255,0,0,0.95); }
  }
  body.sw-horror #sw-knop { background: linear-gradient(135deg,#7a0000,#1a0505); animation: none; }
  body.sw-horror #sw-naam { color: #ff4444; }
  #sw-rol.sw-boos { width: 66px; height: 66px; filter: drop-shadow(0 0 16px rgba(255,0,0,0.85)); }
  `;
  document.head.appendChild(css);

  /* ── SVG-gezicht ── */
  const SMILES_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sw-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ff3b3b"/>
      <stop offset="1" stop-color="#3b82ff"/>
    </linearGradient></defs>
    <circle cx="50" cy="50" r="44" fill="url(#sw-g)" stroke="#0d1b2e" stroke-width="3"/>
    <circle cx="35" cy="40" r="6" fill="#fff"/>
    <circle cx="65" cy="40" r="6" fill="#fff"/>
    <circle cx="36" cy="41" r="2.6" fill="#0d1b2e"/>
    <circle cx="64" cy="41" r="2.6" fill="#0d1b2e"/>
    <path d="M28 60 Q50 80 72 60" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/>
  </svg>`;

  /* 😈 het boze gezicht — voor als de timer om is... */
  const HORROR_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <defs><radialGradient id="sw-h" cx="0.5" cy="0.4">
      <stop offset="0" stop-color="#5a0a0a"/>
      <stop offset="1" stop-color="#120202"/>
    </radialGradient></defs>
    <circle cx="50" cy="50" r="44" fill="url(#sw-h)" stroke="#ff2222" stroke-width="3"/>
    <path d="M24 32 L44 42" stroke="#ff2222" stroke-width="5" stroke-linecap="round"/>
    <path d="M76 32 L56 42" stroke="#ff2222" stroke-width="5" stroke-linecap="round"/>
    <circle cx="37" cy="45" r="4.5" fill="#ff2222"/>
    <circle cx="63" cy="45" r="4.5" fill="#ff2222"/>
    <path d="M26 70 L34 62 L42 70 L50 62 L58 70 L66 62 L74 70" stroke="#ff2222" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;

  /* ── HTML bouwen ── */
  const rol = document.createElement('div');
  rol.id = 'sw-rol';
  rol.innerHTML = SMILES_SVG;
  document.body.appendChild(rol);

  const knop = document.createElement('div');
  knop.id = 'sw-knop';
  knop.title = 'Praat met Smiles!';
  knop.innerHTML = SMILES_SVG;
  document.body.appendChild(knop);

  const panel = document.createElement('div');
  panel.id = 'sw-panel';
  panel.innerHTML = `
    <button id="sw-x">✕</button>
    <div id="sw-naam">😄 SMILES</div>
    <div id="sw-log"></div>
    <div id="sw-rij">
      <input id="sw-inp" placeholder="zeg iets..." maxlength="200" autocomplete="off"/>
      <button id="sw-send">▶</button>
    </div>`;
  document.body.appendChild(panel);

  const bel = document.createElement('div');
  bel.id = 'sw-bel';
  document.body.appendChild(bel);

  /* 😈 horror-elementen (onzichtbaar tot de timer om is) */
  const doem = document.createElement('div'); doem.id = 'sw-doem'; document.body.appendChild(doem);
  const flits = document.createElement('div'); flits.id = 'sw-flits'; document.body.appendChild(flits);
  const banner = document.createElement('a'); banner.id = 'sw-banner'; banner.href = '/smiles.html';
  banner.textContent = '😱 DE TIJD IS OM — SMILES IS LOS! Klik hier om hem te verslaan!';
  document.body.appendChild(banner);

  /* ── Muis volgen met rol-rotatie ── */
  let mx = window.innerWidth / 2, my = window.innerHeight * 0.7;
  let px = mx, py = my, hoek = 0;
  let gesloten = false; // pointer lock actief?

  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  document.addEventListener('touchmove', e => {
    if (e.touches[0]) { mx = e.touches[0].clientX; my = e.touches[0].clientY; }
  }, { passive: true });

  // pointer lock (Blokwereld / adventurecraft3d)
  document.addEventListener('pointerlockchange', () => {
    gesloten = !!document.pointerLockElement;
  });

  /* ── 😈 HORROR-MOTOR ─────────────────────────────────
     Loopt de Smiles-timer af (smiles-staat in localStorage)?
     Dan wordt de HELE SITE eng: donker, intense muziek en
     Smiles jaagt op je — in elk spel. Versla het monster in
     de doos (smiles.html) en alles wordt weer normaal.
     (Brian's wens 2026-07-23) */
  let horror = false;
  const H_VANG = ['GOTCHA. 😈', 'I told you... I am ALWAYS right.', 'You cannot run from SMILES.', 'Tik. Tak. 😈'];
  const H_BERICHTJES = [
    'THE TIME IS UP. 😈', 'I see you...', 'RUN.', 'You cannot hide.',
    'Kom naar de doos... als je durft.', 'I am ALWAYS right. ALWAYS.', 'Achter je. 😈',
  ];
  const H_ANTW = [
    'Why are you still talking? RUN. 😈', 'The time is UP, little player.',
    'I gave you HOURS... 😈', 'Versla me maar in de doos. Als je durft.',
    'hehehe... 😈', 'I am not angry. I am... HUNGRY. 😈',
  ];
  function horrorActief() {
    try {
      const mods = JSON.parse(localStorage.getItem('deluxe-mods') || '[]');
      if (!mods.includes('smiles')) return false;
      const s = JSON.parse(localStorage.getItem('smiles-staat') || 'null');
      if (!s) return false;
      if (s.fase === 'monster') return true;
      if (s.fase === 'assistent' && s.doomTijd && Date.now() > s.doomTijd) return true;
      return false;
    } catch { return false; }
  }
  /* intense muziek: lage dreun + hartslag + valse uithalen (WebAudio) */
  let ac = null, muziekAan = null, muziekTimer = null;
  function startMuziek() {
    if (muziekAan) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') { ac.resume(); }
      const master = ac.createGain(); master.gain.value = 0.085; master.connect(ac.destination);
      const d1 = ac.createOscillator(); d1.type = 'sawtooth'; d1.frequency.value = 55;
      const d2 = ac.createOscillator(); d2.type = 'sawtooth'; d2.frequency.value = 55.8;
      const lf = ac.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 200;
      const dg = ac.createGain(); dg.gain.value = 0.55;
      d1.connect(lf); d2.connect(lf); lf.connect(dg); dg.connect(master);
      d1.start(); d2.start();
      muziekAan = { master, ossen: [d1, d2] };
      muziekTimer = setInterval(() => {
        if (!muziekAan) return;
        try {
          // hartslag: boem... boem...
          const o = ac.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(60, ac.currentTime);
          o.frequency.exponentialRampToValueAtTime(36, ac.currentTime + 0.16);
          const g = ac.createGain(); g.gain.setValueAtTime(0.8, ac.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.24);
          o.connect(g); g.connect(muziekAan.master); o.start(); o.stop(ac.currentTime + 0.26);
          // af en toe een valse hoge uithaal
          if (Math.random() < 0.22) {
            const s = ac.createOscillator(); s.type = 'triangle';
            const f = 700 + Math.random() * 800;
            s.frequency.setValueAtTime(f, ac.currentTime);
            s.frequency.exponentialRampToValueAtTime(f * 0.45, ac.currentTime + 0.8);
            const sg = ac.createGain(); sg.gain.setValueAtTime(0.12, ac.currentTime);
            sg.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.85);
            s.connect(sg); sg.connect(muziekAan.master); s.start(); s.stop(ac.currentTime + 0.9);
          }
        } catch {}
      }, 850);
    } catch {}
  }
  function stopMuziek() {
    if (muziekTimer) { clearInterval(muziekTimer); muziekTimer = null; }
    if (muziekAan) {
      const m = muziekAan; muziekAan = null;
      try { m.master.gain.setTargetAtTime(0.0001, ac.currentTime, 0.25); } catch {}
      setTimeout(() => m.ossen.forEach(o => { try { o.stop(); } catch {} }), 900);
    }
  }
  function schreeuw() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const duur = 0.5, buf = ac.createBuffer(1, ac.sampleRate * duur, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ac.createBufferSource(); src.buffer = buf;
      const f = ac.createBiquadFilter(); f.type = 'bandpass';
      f.frequency.setValueAtTime(2400, ac.currentTime);
      f.frequency.exponentialRampToValueAtTime(300, ac.currentTime + duur);
      const g = ac.createGain(); g.gain.value = 0.3;
      src.connect(f); f.connect(g); g.connect(ac.destination); src.start();
    } catch {}
  }
  function zetHorror(aan) {
    if (aan === horror) return;
    horror = aan;
    document.body.classList.toggle('sw-horror', aan);
    doem.style.display = aan ? 'block' : 'none';
    banner.style.display = aan ? 'block' : 'none';
    rol.innerHTML = aan ? HORROR_SVG : SMILES_SVG;
    knop.innerHTML = aan ? HORROR_SVG : SMILES_SVG;
    rol.classList.toggle('sw-boos', aan);
    const naam = document.getElementById('sw-naam');
    if (naam) naam.textContent = aan ? '😈 SMILES' : '😄 SMILES';
    document.title = (aan ? '😈 ' : '') + document.title.replace(/^😈 /, '');
    if (aan) startMuziek(); else stopMuziek();
  }
  // check elke 4 sec — dus als de timer afloopt TERWIJL je speelt, slaat hij live toe
  setInterval(() => zetHorror(horrorActief()), 4000);
  // muziek mag pas na je eerste klik/toets (browser-regel)
  document.addEventListener('pointerdown', () => { if (horror) startMuziek(); }, true);
  document.addEventListener('keydown', () => { if (horror) startMuziek(); }, true);
  setTimeout(() => zetHorror(horrorActief()), 400);

  const HOEK_MIN = -16, HOEK_MAX = 16; // bob-richting beperkt

  let lungeTot = 0, volgendeLunge = performance.now() + 5000, vangCd = 0;
  let roamX = innerWidth / 2, roamY = innerHeight / 2, roamT = 0;

  (function frame() {
    requestAnimationFrame(frame);
    const nu = performance.now();
    if (horror && !gesloten) {
      // 😈 HIJ JAAGT OP JE: sluipt langzaam... en STORMT dan ineens op je af
      if (nu > volgendeLunge) { lungeTot = nu + 650; volgendeLunge = nu + 4200 + Math.random() * 3500; }
      const snelheid = nu < lungeTot ? 0.22 : 0.028;
      const dx = mx - px, dy = my - py;
      px += dx * snelheid; py += dy * snelheid;
      hoek += dx * 0.4;
      // GEPAKT? flits + schreeuw, en hij deinst even terug
      if (Math.hypot(dx, dy) < 36 && nu > vangCd) {
        vangCd = nu + 9000;
        flits.style.transition = 'none'; flits.style.opacity = 0.95;
        requestAnimationFrame(() => { flits.style.transition = 'opacity 0.9s'; flits.style.opacity = 0; });
        schreeuw();
        bel.textContent = H_VANG[Math.floor(Math.random() * H_VANG.length)];
        bel.classList.add('aan'); setTimeout(() => bel.classList.remove('aan'), 2600);
        px = Math.random() < 0.5 ? -80 : innerWidth + 80; py = Math.random() * innerHeight;
      }
    } else if (horror && gesloten) {
      // pointer-lock (Blokwereld): hij zwerft dreigend over je scherm
      if (nu > roamT) { roamT = nu + 2600; roamX = 60 + Math.random() * (innerWidth - 120); roamY = 60 + Math.random() * (innerHeight - 120); }
      px += (roamX - px) * 0.03; py += (roamY - py) * 0.03; hoek += 2.5;
    } else if (gesloten) {
      // In pointer-lock: Smiles bounct in de linkeronderhoek
      const doelX = 24, doelY = window.innerHeight - 76;
      px += (doelX - px) * 0.06;
      py += (doelY - py) * 0.06;
      hoek += 4; // blijft rollen op de plek
    } else {
      const dx = mx - px, dy = my - py;
      px += dx * 0.09;
      py += dy * 0.09 + 20; // iets onder de cursor
      // roteer op basis van horizontale snelheid
      hoek += dx * 0.55;
    }
    rol.style.left = (px - 26) + 'px';
    rol.style.top  = (py - 26) + 'px';
    rol.style.transform = `rotate(${hoek}deg)`;

    // spraakbel volgt ook mee
    if (bel.classList.contains('aan')) {
      bel.style.left = (px + 32) + 'px';
      bel.style.top  = (py - 56) + 'px';
    }
  })();

  /* ── Antwoorden ── */
  const ANTW = [
    [/\b(hoi|hallo|hello|hey|hi)\b/i, ["HELLO HELLO! 😄", "Hiiii! 😄 Best day ever!"]],
    [/naam|name|wie ben/i,             ["I'm SMILES! The friendliest face EVER! 😄"]],
    [/hoe gaat|how are/i,              ["AMAZING! I'm always happy! Always... 😄"]],
    [/mop|grap|joke/i,                 ["Why did the smiley cross the road? To SMILE at you! 😄"]],
    [/spel|game|speel/i,               ["Ooh I LOVE this game! You're doing GREAT! 😄"]],
    [/score|punt/i,                    ["SCORE MORE! You can do it! I believe in you! 😄"]],
    [/win|gewon/i,                     ["YESSSS! Champion! 😄🏆"]],
    [/verlor|dood|dead|game.over/i,    ["Aww! Try again! I believe in you! 😄"]],
    [/help|hulp/i,                     ["I'm ALWAYS here! Just ask! 😄"]],
    [/goed|nice|cool|leuk|knap/i,      ["Awww THANK YOU! 😄 You're the best!"]],
    [/bang|eng|scary/i,                ["Me? Scary?? Noooo. I'm just a happy little face. 😄 ...Maybe."]],
    [/(\d+)\s*([+\-x*])\s*(\d+)/,     'SOM'],
  ];
  function antw(txt) {
    if (horror) return H_ANTW[Math.floor(Math.random() * H_ANTW.length)];
    for (const [p, u] of ANTW) {
      const m = txt.match(p);
      if (!m) continue;
      if (u === 'SOM') {
        const a = +m[1], b = +m[3], op = m[2];
        const r = op==='+' ? a+b : op==='-' ? a-b : a*b;
        return `${a} ${op} ${b} = ${r}! I'm ALWAYS right! 😄`;
      }
      return u[Math.floor(Math.random() * u.length)];
    }
    const f = [
      "Interesting! I know EVERYTHING about that. Trust me. 😄",
      "Great question! The answer is YES! Probably! 😄",
      "Ooh ask me more, I LOVE talking! 😄",
      "SMILES APPROVES THIS MESSAGE! 😄",
    ];
    return f[Math.floor(Math.random() * f.length)];
  }

  /* ── Chat-functies ── */
  const log$ = document.getElementById('sw-log');
  function voegToe(txt, wie) {
    const d = document.createElement('div');
    d.className = 'sw-b ' + wie;
    d.textContent = txt;
    log$.appendChild(d);
    log$.scrollTop = log$.scrollHeight;
  }
  function smilesZegt(txt) {
    voegToe(txt, 's');
    try {
      const u = new SpeechSynthesisUtterance(txt);
      // zelf-gekozen stem (🔊 STEM-knop op smiles.html) — anders eerste Engelse
      const vs = speechSynthesis.getVoices();
      const wens = localStorage.getItem('smiles-stem');
      const gekozen = (wens && vs.find(v => v.voiceURI === wens || v.name === wens))
        || vs.filter(v => (v.lang || '').startsWith('en'))[0];
      if (gekozen) u.voice = gekozen;
      u.lang = 'en-US';
      u.pitch = horror ? 0.35 : 1.5;   // 😈 in horror-stand praat hij LAAG en eng
      u.rate  = horror ? 0.82 : 1.05;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {}
  }
  function stuur() {
    const inp = document.getElementById('sw-inp');
    const txt = inp.value.trim(); if (!txt) return;
    inp.value = '';
    voegToe(txt, 'j');
    setTimeout(() => smilesZegt(antw(txt.toLowerCase())), 500);
  }

  /* ── Events ── */
  knop.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open') && log$.childElementCount === 0) {
      setTimeout(() => smilesZegt("HELLO! I'm Smiles! Talking to you while you PLAY! 😄 Ask me ANYTHING!"), 300);
    }
  });
  document.getElementById('sw-x').addEventListener('click', () => panel.classList.remove('open'));
  document.getElementById('sw-send').addEventListener('click', stuur);
  document.getElementById('sw-inp').addEventListener('keydown', e => { if (e.key === 'Enter') stuur(); });

  /* ── Periodieke berichtjes via de spraakbel ── */
  const BERICHTJES = [
    "I'm rolling behind you! 😄",
    "You can do it! SMILES believes in you! 😄",
    "Don't forget about me! 😄",
    "AMAZING MOVE! 😄",
    "Click the button to chat! 😄",
    "Something is... fine. Everything is FINE. 😄",
    "You're the BEST player! 😄",
  ];
  let bIdx = 0;
  function toonBel() {
    bel.textContent = horror
      ? H_BERICHTJES[Math.floor(Math.random() * H_BERICHTJES.length)]
      : BERICHTJES[bIdx++ % BERICHTJES.length];
    bel.style.left = (px + 32) + 'px';
    bel.style.top  = (py - 56) + 'px';
    bel.classList.add('aan');
    setTimeout(() => bel.classList.remove('aan'), 3200);
  }
  setTimeout(() => {
    toonBel();
    setInterval(toonBel, 28000 + Math.random() * 14000);
  }, 5000);

})();
