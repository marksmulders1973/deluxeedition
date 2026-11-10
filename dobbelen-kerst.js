// 🎄 Kerstversiering voor de dobbel-pagina's (dobbelen.html en dobbelen-spel.html): alles wordt getekend, er zijn geen plaatjes nodig.
// De pagina moet zelf <div id="ballen"> en <canvas id="decor"> hebben, plus de bijbehorende stijl.
(function () {
  const GROEN = ['#0a3319', '#0b3d1f', '#0f4d27', '#14602f', '#1b7038', '#237f41', '#2f8f4e'];
  function toeval(zaad) { return function () { zaad |= 0; zaad = zaad + 0x6D2B79F5 | 0; let t = Math.imul(zaad ^ zaad >>> 15, 1 | zaad); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const meng = (a, b, f) => a + (b - a) * f;

  // Een glanzende bol (kerstbal) op het doek.
  function bol(c, x, y, r, kleur) {
    const K = { rood: ['#ff8a8a', '#d3122f', '#6d0716'], goud: ['#fff3bf', '#d9ae2b', '#7a5a08'], groen: ['#9fe3b4', '#167a41', '#07361b'], zilver: ['#ffffff', '#c9ced6', '#6d7480'] }[kleur];
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.arc(x + r * .18, y + r * .28, r, 0, 7); c.fill();
    const g = c.createRadialGradient(x - r * .38, y - r * .42, r * .08, x, y, r);
    g.addColorStop(0, K[0]); g.addColorStop(.45, K[1]); g.addColorStop(1, K[2]);
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * .36, y - r * .42, r * .2, r * .11, -.7, 0, 7); c.fill();
    c.fillStyle = '#b8912a'; c.fillRect(x - r * .2, y - r * 1.16, r * .4, r * .24);
  }

  // Een lichtje dat gloeit.
  function lichtje(c, x, y, r, kleur) {
    const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, kleur); g.addColorStop(.25, kleur.replace('1)', '.55)')); g.addColorStop(1, kleur.replace('1)', '0)'));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2, 0, 7); c.fill();
    c.fillStyle = '#fffdf0'; c.beginPath(); c.arc(x, y, r * .55, 0, 7); c.fill();
  }

  // Een dennentak: een steeltje met aan beide kanten naalden.
  function tak(c, x0, y0, x1, y1, naald, rnd, licht) {
    const dx = x1 - x0, dy = y1 - y0, lang = Math.hypot(dx, dy), hoek = Math.atan2(dy, dx);
    c.strokeStyle = '#3a2a14'; c.lineWidth = Math.max(1, naald * .12); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const stappen = Math.max(6, Math.round(lang / (naald * .22)));
    c.lineWidth = Math.max(.9, naald * .075);
    for (let i = 0; i <= stappen; i++) {
      const f = i / stappen, px = x0 + dx * f, py = y0 + dy * f, l = naald * (1.05 - f * .45);
      for (const kant of [-1, 1]) {
        const a = hoek + kant * (.55 + rnd() * .55), nl = l * (.6 + rnd() * .5);
        c.strokeStyle = GROEN[Math.min(GROEN.length - 1, Math.floor(rnd() * 4 + licht * 3.2))];
        c.beginPath(); c.moveTo(px, py); c.lineTo(px + Math.cos(a) * nl, py + Math.sin(a) * nl); c.stroke();
      }
    }
  }

  // Een slinger van dennengroen langs een lijn: punt(t) geeft de plek, t loopt van 0 tot 1.
  function slinger(c, punt, lengte, dikte, rnd, metLichtjes) {
    const stappen = Math.max(8, Math.round(lengte / (dikte * .28)));
    c.lineCap = 'round';
    for (let i = 0; i <= stappen; i++) {
      const p = punt(i / stappen);
      for (let k = 0; k < 11; k++) {
        const a = rnd() * 6.283, l = dikte * (.45 + rnd() * .65);
        c.strokeStyle = GROEN[Math.floor(rnd() * GROEN.length)]; c.lineWidth = 1 + rnd() * .9;
        c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x + Math.cos(a) * l, p.y + Math.sin(a) * l); c.stroke();
      }
    }
    for (let i = 1; i < stappen; i++) {
      const p = punt(i / stappen), r = rnd();
      if (i % 5 === 2) bol(c, p.x, p.y + 3, dikte * .2, r < .5 ? 'rood' : 'goud');
      else if (metLichtjes && i % 5 === 4) lichtje(c, p.x + (r - .5) * dikte, p.y + (rnd() - .5) * dikte, dikte * .16, 'rgba(255,214,120,1)');
    }
  }

  // Een ketting van gouden kralen langs een lijn.
  function kralen(c, punt, lengte, r) {
    const n = Math.max(6, Math.round(lengte / (r * 2.1)));
    for (let i = 0; i <= n; i++) {
      const p = punt(i / n);
      const g = c.createRadialGradient(p.x - r * .35, p.y - r * .35, r * .1, p.x, p.y, r);
      g.addColorStop(0, '#fff6c9'); g.addColorStop(.5, '#d9ae2b'); g.addColorStop(1, '#7a5a08');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill();
    }
  }

  // Een rode strik.
  function strik(c, x, y, s) {
    const lus = (kant) => {
      const g = c.createLinearGradient(x, y - s, x + kant * s * 1.5, y + s);
      g.addColorStop(0, '#e2203c'); g.addColorStop(1, '#8f0b20');
      c.fillStyle = g; c.beginPath(); c.moveTo(x, y);
      c.bezierCurveTo(x + kant * s * .6, y - s * 1.1, x + kant * s * 1.7, y - s * .9, x + kant * s * 1.5, y);
      c.bezierCurveTo(x + kant * s * 1.7, y + s * .8, x + kant * s * .6, y + s * .7, x, y); c.fill();
      c.fillStyle = '#a80f27'; c.beginPath(); c.moveTo(x, y);
      c.lineTo(x + kant * s * .95, y + s * 2.1); c.lineTo(x + kant * s * .45, y + s * 1.8); c.lineTo(x + kant * s * .25, y + s * 2.2); c.closePath(); c.fill();
    };
    lus(-1); lus(1);
    c.fillStyle = '#c8102e'; c.beginPath(); c.ellipse(x, y, s * .36, s * .42, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - s * .1, y - s * .12, s * .12, s * .16, 0, 0, 7); c.fill();
  }

  function ster(c, x, y, r) {
    lichtje(c, x, y, r * .8, 'rgba(255,220,120,1)');
    const g = c.createRadialGradient(x - r * .2, y - r * .2, r * .1, x, y, r);
    g.addColorStop(0, '#fff8d0'); g.addColorStop(.5, '#f1c232'); g.addColorStop(1, '#a8790c');
    c.fillStyle = g; c.strokeStyle = '#8a6408'; c.lineWidth = Math.max(1, r * .05); c.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .42 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.fill(); c.stroke();
  }

  // De kerstboom: lagen dennentakken van onder naar boven, daarna kralen, lichtjes, ballen en de piek.
  function kerstboom(c, cx, voet, h) {
    const rnd = toeval(2026), w = h * .64, top = voet - h * .93, onder = voet - h * .08, kroon = onder - top;
    c.fillStyle = 'rgba(0,0,0,.13)'; c.beginPath(); c.ellipse(cx, voet - h * .012, w * .42, h * .022, 0, 0, 7); c.fill();
    const sg = c.createLinearGradient(cx - w * .05, 0, cx + w * .05, 0);
    sg.addColorStop(0, '#3b2512'); sg.addColorStop(.5, '#6b4423'); sg.addColorStop(1, '#2c1b0c');
    c.fillStyle = sg; c.fillRect(cx - w * .05, onder - h * .02, w * .1, h * .09);
    const LAGEN = 13, half = (f) => meng(w / 2, w * .05, Math.pow(f, .92)), yVan = (f) => meng(onder, top + kroon * .07, f);
    c.lineCap = 'round';
    for (let i = 0; i < LAGEN; i++) {
      const f = i / (LAGEN - 1), y = yVan(f), hw = half(f), th = kroon / LAGEN * 2.1;
      c.fillStyle = '#082a14'; c.beginPath(); c.moveTo(cx, y - th); c.lineTo(cx - hw * .93, y - th * .08); c.lineTo(cx + hw * .93, y - th * .08); c.closePath(); c.fill();
      const takken = Math.round(16 + (1 - f) * 20), lijst = [];
      for (let b = 0; b < takken; b++) lijst.push((b + rnd()) / takken * 2 - 1);
      lijst.sort((a, b2) => Math.abs(b2) - Math.abs(a)); // buitenste eerst, middelste bovenop
      for (const u of lijst) {
        const x1 = cx + u * hw * (.92 + rnd() * .12), y1 = y - (1 - Math.abs(u)) * th * .1 + rnd() * h * .012;
        const x0 = cx + u * hw * .12, y0 = y - th * (.62 + rnd() * .25);
        tak(c, x0, y0, x1, y1, h * .024, rnd, .25 + (u < 0 ? .3 : 0) + rnd() * .3);
      }
    }
    for (let j = 0; j < 6; j++) {
      const f0 = .06 + j * .155, f1 = f0 + .075, links = j % 2 === 0;
      const a = { x: cx + (links ? -1 : 1) * half(f0) * .86, y: yVan(f0) - h * .012 }, b = { x: cx + (links ? 1 : -1) * half(f1) * .86, y: yVan(f1) - h * .012 };
      const m = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + h * .035 };
      kralen(c, (t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * m.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * m.y + t * t * b.y }), Math.hypot(b.x - a.x, b.y - a.y) * 1.1, h * .0055);
    }
    for (let k = 0; k < 46; k++) {
      const f = .02 + rnd() * .9, x = cx + (rnd() * 2 - 1) * half(f) * .82, y = yVan(f) - rnd() * kroon / LAGEN;
      lichtje(c, x, y, h * .0065, rnd() < .8 ? 'rgba(255,214,120,1)' : 'rgba(255,245,225,1)');
    }
    const geplaatst = [], soorten = ['rood', 'goud', 'rood', 'zilver', 'goud', 'rood'];
    for (let k = 0, pog = 0; k < 30 && pog < 600; pog++) {
      const f = .03 + rnd() * .86, r = h * .017 * (.8 + rnd() * .55), x = cx + (rnd() * 2 - 1) * half(f) * .8, y = yVan(f) - rnd() * kroon / LAGEN * .6;
      if (geplaatst.some((g) => Math.hypot(g.x - x, g.y - y) < (g.r + r) * 1.9)) continue;
      geplaatst.push({ x, y, r }); bol(c, x, y, r, soorten[k % soorten.length]); k++;
    }
    ster(c, cx, top + kroon * .02, h * .05);
  }

  // De ballen die aan het plafond hangen (losse plaatjes, zodat ze zachtjes kunnen wiegen).
  function hangBallen(W) {
    const doos = document.getElementById('ballen'), rnd = toeval(7), smal = W < 900;
    doos.innerHTML = '';
    const n = Math.max(5, Math.round(W / (smal ? 62 : 92))), kleuren = ['rood', 'goud', 'groen', 'rood', 'goud'];
    const VERF = { rood: ['#ffb3b3', '#d3122f', '#6d0716'], goud: ['#fff6cf', '#d9ae2b', '#7a5a08'], groen: ['#b9efc9', '#167a41', '#07361b'] };
    for (let i = 0; i < n; i++) {
      const x = (i + .5) * W / n + (rnd() - .5) * W / n * .5, rand = Math.abs(x - W / 2) / (W / 2);
      const middenkolom = Math.abs(x - W / 2) < 290;
      const r = smal ? 10 + rnd() * 5 : 15 + rnd() * 11;
      const draad = (smal || middenkolom) ? 34 + rnd() * 26 : 70 + rand * 150 + rnd() * 70;
      const kleur = kleuren[i % kleuren.length], v = VERF[kleur], b = r + 4, hoog = draad + r * 2 + 8, id = 'kb' + i;
      const my = draad + r + 4, streep = rnd() < .45;
      const el = document.createElement('div');
      el.className = 'bal';
      el.style.left = (x - b) + 'px';
      el.style.animationDuration = (3.2 + rnd() * 2.6).toFixed(2) + 's';
      el.style.animationDelay = (-rnd() * 4).toFixed(2) + 's';
      el.innerHTML = `<svg width="${b * 2}" height="${hoog}" viewBox="0 0 ${b * 2} ${hoog}">
        <defs><radialGradient id="${id}" cx="34%" cy="30%" r="75%"><stop offset="0" stop-color="${v[0]}"/><stop offset=".45" stop-color="${v[1]}"/><stop offset="1" stop-color="${v[2]}"/></radialGradient>
        <clipPath id="${id}c"><circle cx="${b}" cy="${my}" r="${r}"/></clipPath></defs>
        <line x1="${b}" y1="0" x2="${b}" y2="${draad}" stroke="#b79a4a" stroke-width="1.3"/>
        <rect x="${b - r * .24}" y="${draad}" width="${r * .48}" height="${r * .3 + 5}" rx="1.5" fill="#c9a227" stroke="#8a6a12" stroke-width=".6"/>
        <circle cx="${b}" cy="${my}" r="${r}" fill="url(#${id})"/>
        ${streep ? `<g clip-path="url(#${id}c)"><path d="M0 ${my - r * .2} q${b} ${r * .5} ${b * 2} 0 v${r * .34} q${-b} ${r * .5} ${-b * 2} 0z" fill="${kleur === 'goud' ? '#b3122c' : '#e9c95a'}" opacity=".85"/></g>` : ''}
        <ellipse cx="${b - r * .36}" cy="${my - r * .42}" rx="${r * .2}" ry="${r * .11}" fill="#fff" opacity=".8" transform="rotate(-35 ${b - r * .36} ${my - r * .42})"/>
      </svg>`;
      doos.appendChild(el);
    }
  }

  function teken() {
    const doek = document.getElementById('decor'), W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    doek.width = Math.round(W * dpr); doek.height = Math.round(H * dpr);
    const c = doek.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    const smal = W < 900, rnd = toeval(11);

    // kerstboom: op een breed scherm links naast de namen, op een smal scherm onderaan erachter
    if (smal) {
      // dobbelscherm (data-boom="vaag"): een kleinere, vagere boom, zodat de naam en de steen goed te zien blijven
      const vaag = document.body.dataset.boom === 'vaag';
      c.globalAlpha = vaag ? .5 : 1; kerstboom(c, W / 2, H - 4, Math.min(H * (vaag ? .5 : .7), W * 1.45)); c.globalAlpha = 1;
    }
    else { const ruimte = (W - 520) / 2; kerstboom(c, ruimte / 2, H - 6, Math.min(H * .86, ruimte * 1.5)); }

    // slingers langs de zijkanten (alleen als er ruimte is)
    if (!smal) for (const kant of [0, 1]) {
      const x0 = kant ? W - 16 : 16, eind = H * (kant ? .78 : .34);
      slinger(c, (t) => ({ x: x0 + Math.sin(t * 9 + kant) * 9, y: 40 + t * (eind - 40) }), eind - 40, 15, rnd, true);
    }

    // slingers langs het plafond: dennengroen in bogen, daaronder een gouden kralenketting, strikken op de ophangpunten
    const bogen = Math.max(2, Math.round(W / (smal ? 190 : 270))), stuk = W / bogen, zak = smal ? 26 : 36;
    for (let i = 0; i < bogen; i++) {
      const ax = i * stuk, bx = ax + stuk;
      const boog = (diep, y0) => (t) => ({ x: ax + (bx - ax) * t, y: y0 + 4 * diep * t * (1 - t) });
      kralen(c, boog(zak * 1.75, 16), stuk * 1.15, 3.2);
      slinger(c, boog(zak, 14), stuk * 1.06, 17, rnd, true);
    }
    for (let i = 0; i <= bogen; i++) strik(c, i * stuk, 16, smal ? 11 : 14);
  }

  let wacht = 0, vorigeW = 0;
  function alles() { const W = window.innerWidth; teken(); if (W !== vorigeW) { vorigeW = W; hangBallen(W); } }
  window.addEventListener('resize', () => { clearTimeout(wacht); wacht = setTimeout(alles, 150); });
  alles();
})();
