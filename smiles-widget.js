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

  const HOEK_MIN = -16, HOEK_MAX = 16; // bob-richting beperkt

  (function frame() {
    requestAnimationFrame(frame);
    if (gesloten) {
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
      const vs = speechSynthesis.getVoices().filter(v => (v.lang || '').startsWith('en'));
      if (vs.length) u.voice = vs[0];
      u.lang = 'en-US'; u.pitch = 1.5; u.rate = 1.05;
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
    bel.textContent = BERICHTJES[bIdx++ % BERICHTJES.length];
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
