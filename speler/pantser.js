// ══════════════════════════════════════════════════════════════════
// 🛡️ HET PANTSER van de speler (Brian 22 okt: "net zo realistisch als de mensen in het gebouw")
//
// Echte 3D-platen in plaats van een geschilderd pak. Zo werkt het:
//  1. We verdelen het lichaam in platen (een soort Voronoi met hoekige randen),
//     elk lichaamsdeel met zijn eigen plaatgrootte.
//  2. Waar een plaat hoort, snijden we het stuk lichaam eruit — precies, langs een
//     rechte lijn door elk driehoekje ("marching triangles"), zodat de randen strak zijn.
//  3. Dat stuk duwen we naar buiten (1–1,5 cm dik) en geven het zijkanten. Zo is het een
//     echte plaat met dikte, die de vorm van het lijf precies volgt.
//  4. Bij ellebogen, knieën, oksels, kruis, middel, nek, polsen en zolen komt geen plaat:
//     daar zie je het zwarte pak, zoals bij een echt harnas.
//  5. Elk hoekpunt houdt de 'skin weights' van het lijf: de platen bewegen dus met dezelfde
//     botten mee en zitten in elke houding precies goed.
//  6. In sommige naden en op sommige platen komen verzonken blauwe lichtstrepen.
// ══════════════════════════════════════════════════════════════════
(function(){
  const comp = (attr, i, k) => k === 0 ? attr.getX(i) : k === 1 ? attr.getY(i) : k === 2 ? attr.getZ(i) : attr.getW(i);   // (three r128 heeft geen getComponent)
  function hash(a, b){ const s = Math.sin(a * 127.1 + (b || 0) * 311.7) * 43758.5453; return s - Math.floor(s); }

  window.bouwPantser = function(lijf, opties){
    opties = opties || {};
    const geo = lijf.geometry, P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
    const I = geo.index ? geo.index.array : null, nTri = (I ? I.length : P.count) / 3;
    const bones = lijf.skeleton.bones, nv = P.count;
    // Alles in de geometrie-ruimte van het lijf: daar staan de hoekpunten (in rust) én de botten
    // (inverse bind-matrices) in hetzelfde stelsel. In dit model is daar z 'omhoog', dus voor ons
    // rekenwerk verwisselen we y en z: dan is y omhoog en x links/rechts.
    const as = (x, y, z) => [x, z, y];
    const botPos = {};
    lijf.skeleton.boneInverses.forEach((inv, i) => {
      const p = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(inv).invert());
      const q = as(p.x, p.y, p.z);
      botPos[bones[i].name.replace(/^Bip0\d_/, '')] = new THREE.Vector3(q[0], q[1], q[2]);
    });
    const BP = (n) => botPos[n] || new THREE.Vector3(0, -99, 0);
    // ── per hoekpunt: wereldpositie, wereldnormaal, hoofd-bot ──
    const W = new Float32Array(nv * 3), WN = new Float32Array(nv * 3), hoofdBot = new Array(nv);
    for(let i = 0; i < nv; i++){
      const q = as(P.getX(i), P.getY(i), P.getZ(i)); W[i * 3] = q[0]; W[i * 3 + 1] = q[1]; W[i * 3 + 2] = q[2];
      const n = as(N.getX(i), N.getY(i), N.getZ(i)), l = Math.hypot(n[0], n[1], n[2]) || 1; WN[i * 3] = n[0] / l; WN[i * 3 + 1] = n[1] / l; WN[i * 3 + 2] = n[2] / l;
      let bw = -1, bi = 0;
      for(let k = 0; k < 4; k++){ const w = comp(SW, i, k); if(w > bw){ bw = w; bi = comp(SI, i, k); } }
      hoofdBot[i] = bones[bi].name.replace(/^Bip0\d_/, '');
    }
    // lichaamsdeel per bot → plaatgrootte, dikte, richting van de lichtgroef
    const deel = (b) => /Spine|Pelvis|Neck|Clavicle/.test(b) ? 'romp' : /UpperArm|Forearm/.test(b) ? 'arm' : /Hand|Finger/.test(b) ? 'hand' : /Thigh|Calf/.test(b) ? 'been' : /Foot|Toe/.test(b) ? 'voet' : 'romp';
    // ── zaadpunten: een ONTWORPEN plaatindeling (zoals een echt harnas), op basis van het skelet ──
    // richtingen van het lijf: x = opzij, y = omhoog, 'voor' = waar de tenen heen wijzen
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    // (gemiddelde van beide voeten: één voet staat altijd een beetje naar buiten gedraaid)
    const voorRuw = BP('L_Toe0').clone().sub(BP('L_Foot')).add(BP('R_Toe0').clone().sub(BP('R_Foot'))); voorRuw.y = 0; voorRuw.x = 0;
    const VOOR = voorRuw.lengthSq() > 1e-6 ? voorRuw.normalize() : V(0, 0, 1);
    const OPZIJ = V(1, 0, 0), OP = V(0, 1, 0);
    const zaden = [];
    const zaad = (p, richting, d) => zaden.push({x: p.x, y: p.y, z: p.z, nx: richting.x, ny: richting.y, nz: richting.z, deel: d, id: zaden.length});
    // hoe dik is een lichaamsdeel rond een lijn van a naar b? (gemiddelde afstand van zijn hoekpunten tot die lijn)
    const straal = (a, b, botNaam) => {
      const ab = b.clone().sub(a), L = ab.length(); ab.normalize(); let som = 0, n = 0;
      for(let i = 0; i < nv; i++){ if(hoofdBot[i] !== botNaam) continue; const p = V(W[i * 3], W[i * 3 + 1], W[i * 3 + 2]).sub(a); const t = p.dot(ab); if(t < 0 || t > L) continue; som += p.sub(ab.clone().multiplyScalar(t)).length(); n++; }
      return n ? som / n : 0.04;
    };
    // ringen van platen om een arm of been
    const ringen = (vanBot, naarBot, botNaam, ts, hoeken, d) => {
      const a = BP(vanBot), b = BP(naarBot), as = b.clone().sub(a).normalize();
      let u = VOOR.clone().sub(as.clone().multiplyScalar(VOOR.dot(as))); if(u.lengthSq() < 1e-4) u = OP.clone().sub(as.clone().multiplyScalar(OP.dot(as))); u.normalize();
      const w = new THREE.Vector3().crossVectors(as, u).normalize();
      const r = straal(a, b, botNaam);
      ts.forEach((t, k) => hoeken.forEach(h => {
        const hh = h + (k % 2) * 0.35;                       // ringen een beetje verspringen, zoals stenen in een muur
        const dir = u.clone().multiplyScalar(Math.cos(hh)).add(w.clone().multiplyScalar(Math.sin(hh)));
        zaad(a.clone().lerp(b, t).add(dir.clone().multiplyScalar(r)), dir, d);
      }));
    };
    const rondom3 = [0, 2.1, -2.1], rondom4 = [0, 1.57, 3.14, -1.57];
    for(const s of ['L', 'R']){
      ringen(s + '_UpperArm', s + '_Forearm', s + '_UpperArm', [0.42, 0.72], rondom3, 'arm');
      ringen(s + '_Forearm', s + '_Hand', s + '_Forearm', [0.3, 0.68], rondom3, 'arm');
      ringen(s + '_Thigh', s + '_Calf', s + '_Thigh', [0.28, 0.58, 0.85], rondom4, 'been');
      ringen(s + '_Calf', s + '_Foot', s + '_Calf', [0.22, 0.52, 0.8], rondom3, 'been');
      // laars: neus, wreef, hiel
      const voet = BP(s + '_Foot'), teen = BP(s + '_Toe0');
      zaad(teen.clone().add(V(0, 0.02, 0)), VOOR, 'voet');
      zaad(voet.clone().lerp(teen, 0.5).add(V(0, 0.04, 0)), OP, 'voet');
      zaad(voet.clone().sub(VOOR.clone().multiplyScalar(0.05)), VOOR.clone().negate(), 'voet');
      // grote schouderplaat
      const sch = BP(s + '_UpperArm');
      zaad(sch.clone().add(V(Math.sign(sch.x) * 0.02, 0.04, 0)), V(Math.sign(sch.x), 1, 0).normalize(), 'schouder');
      // kniekap (vóór de knie) en elleboogkap (achter de elleboog)
      const kn = BP(s + '_Calf'), el = BP(s + '_Forearm');
      zaad(kn.clone().add(VOOR.clone().multiplyScalar(straal(BP(s + '_Thigh'), kn, s + '_Thigh') * 0.9)), VOOR, 'kap');
      zaad(el.clone().sub(VOOR.clone().multiplyScalar(straal(BP(s + '_UpperArm'), el, s + '_UpperArm') * 0.9)), VOOR.clone().negate(), 'kap');
    }
    // romp: borst (2 helften + borstbeen), buik in rijen, flanken, rug, heupen
    const r2 = BP('Spine2'), r1 = BP('Spine1'), bk = BP('Pelvis');
    const romp = (x, y, voor) => { const p = V(x, y, 0).add(VOOR.clone().multiplyScalar(voor)); const n = VOOR.clone().multiplyScalar(Math.sign(voor) || 0).add(OPZIJ.clone().multiplyScalar(Math.sign(x) * (Math.abs(voor) < 0.02 ? 1 : 0.2))).normalize(); zaad(p, n, 'romp'); };
    const diep = 0.09;
    for(const sx of [-1, 1]){
      romp(sx * 0.06, r2.y + 0.04, diep);                  // borst
      romp(sx * 0.045, r1.y, diep);                        // buik boven
      romp(sx * 0.045, (r1.y + bk.y) / 2 + 0.01, diep);    // buik onder
      romp(sx * 0.13, r1.y + 0.02, 0);                     // flank
      romp(sx * 0.065, r2.y + 0.03, -diep);                // schouderblad
      romp(sx * 0.055, r1.y - 0.01, -diep);                // onderrug
      romp(sx * 0.09, bk.y - 0.02, diep * 0.8);            // heup voor
      romp(sx * 0.09, bk.y - 0.01, -diep * 0.8);           // heup achter
      romp(sx * 0.14, bk.y, 0);                            // heup opzij
    }
    romp(0, r2.y - 0.035, diep + 0.01);                     // borstbeen
    // gewone afstand: dan zijn de grenzen tussen twee platen platte vlakken → kaarsrechte plaatranden
    const afs = (x, y, z, s) => { const dx = x - s.x, dy = (y - s.y) * 0.9, dz = z - s.z; return Math.sqrt(dx * dx + dy * dy + dz * dz); };
    const zaadAfst = (a, b) => { const A = zaden[a], B = zaden[b]; return Math.hypot(A.x - B.x, (A.y - B.y) * 0.9, A.z - B.z) || 1e-6; };
    // ── waar mág een plaat (> 0) — rond gewrichten komt geen plaat ──
    const pols = [BP('L_Hand'), BP('R_Hand')], elleboog = [BP('L_Forearm'), BP('R_Forearm')], schouder = [BP('L_UpperArm'), BP('R_UpperArm')];
    const knie = [BP('L_Calf'), BP('R_Calf')], heup = [BP('L_Thigh'), BP('R_Thigh')], enkel = [BP('L_Foot'), BP('R_Foot')];
    const nek = BP('Neck'), bekken = BP('Pelvis'), rug = BP('Spine1');
    // de riem ligt precies op de zoom van de (oorspronkelijke) trui: daar is het lijf het dikst, en een plaat
    // zou daar uitbollen. We zoeken de hoogte waar de romp het breedst is tussen bekken en buik.
    const middelY = (() => {
      let besteY = (bekken.y + rug.y) * 0.5, beste = -1;
      for(let y = bekken.y - 0.06; y <= rug.y; y += 0.005){
        let som = 0, n = 0;
        for(let i = 0; i < nv; i++){ if(Math.abs(W[i * 3 + 1] - y) > 0.006 || !/Spine|Pelvis/.test(hoofdBot[i])) continue; som += Math.hypot(W[i * 3], W[i * 3 + 2] - bekken.z); n++; }
        if(n > 6 && som / n > beste){ beste = som / n; besteY = y; }
      }
      return besteY;
    })();
    const masker = (x, y, z) => {
      let m = 1;
      const dist = (p) => Math.hypot(x - p.x, y - p.y, z - p.z);
      for(let s = 0; s < 2; s++){
        const sg = Math.sign(pols[s].x) || 1;                              // aan welke kant zit deze hand?
        m = Math.min(m, sg * (pols[s].x - x) - 0.015);                     // de armplaat stopt 1,5 cm vóór de pols; daarna handschoen
        // elleboog: aan de buigkant (voorkant) het zwarte pak, aan de achterkant een kap
        const ve = (x - elleboog[s].x) * VOOR.x + (z - elleboog[s].z) * VOOR.z;
        m = Math.min(m, Math.max(dist(elleboog[s]) - 0.05, -ve - 0.012));
        // knie: aan de achterkant (knieholte) het zwarte pak, vóór een kniekap
        const vk = (x - knie[s].x) * VOOR.x + (z - knie[s].z) * VOOR.z;
        m = Math.min(m, Math.max(dist(knie[s]) - 0.058, vk - 0.014));
        m = Math.min(m, dist(enkel[s]) - 0.035);
        // oksel: alleen het hoekje waar arm en romp elkaar raken (onder het schoudergewricht, aan de binnenkant)
        m = Math.min(m, Math.max(y - (schouder[s].y - 0.04), Math.abs(x - (schouder[s].x - sg * 0.03)) - 0.03, Math.abs(z - schouder[s].z) - 0.055, (schouder[s].y - 0.13) - y));
      }
      m = Math.min(m, Math.max(Math.abs(x) - 0.06, y - (heup[0].y - 0.02), (heup[0].y - 0.2) - y));    // kruis
      m = Math.min(m, Math.abs(y - middelY) - 0.018);                                                  // zwarte riem rond het middel (over de zoom)
      m = Math.min(m, Math.max(0.085 - Math.hypot(x - nek.x, (z - nek.z) * 1.15), (nek.y - 0.06) - y));   // hoge zwarte kraag
      m = Math.min(m, y - 0.03);                                                                        // zolen
      return m;
    };
    // ── een PUNT op het lijf: geometrie-positie, normaal, botgewichten + alles wat we per punt moeten weten ──
    const maakPunt = (p, n, w) => {
      const q = as(p[0], p[1], p[2]), qn = as(n[0], n[1], n[2]);
      let a = 9, b = 9, ia = 0, ib = 0;
      for(const s of zaden){
        if(s.nx * qn[0] + s.ny * qn[1] + s.nz * qn[2] < -0.2) continue;   // alleen zaden aan dezelfde kant (geen plaat dwars door een arm)
        const d = afs(q[0], q[1], q[2], s);
        if(d < a){ b = a; ib = ia; a = d; ia = s.id; } else if(d < b){ b = d; ib = s.id; }
      }
      // hoort dit punt vooral bij de hand? dan nooit een plaat (handschoen)
      let hb = -1, hw = 0; for(const k in w) if(w[k] > hw){ hw = w[k]; hb = +k; }
      const opHand = hb >= 0 && /Hand|Finger/.test(bones[hb].name);
      return {p, n, w, q, qn, mk: opHand ? -0.02 : masker(q[0], q[1], q[2]), id1: ia, id2: ib === ia ? (ia + 1) % zaden.length : ib};
    };
    const GAP = opties.naad || 0.006;
    // precieze afstand tot de grens tussen plaat a en b (de grens is een plat vlak midden tussen de twee zaadpunten)
    const totGrens = (pt, a, b) => { const da = afs(pt.q[0], pt.q[1], pt.q[2], zaden[a]), db = afs(pt.q[0], pt.q[1], pt.q[2], zaden[b]); return (db * db - da * da) / (2 * zaadAfst(a, b)); };
    const veldPlaat = (pt, c) => Math.min((pt.id1 === c ? totGrens(pt, c, pt.id2) : totGrens(pt, c, pt.id1)) - GAP / 2, pt.mk);
    // ── uitvoer-buffers ──
    const uit = {plaat: {p: [], n: [], k: [], si: [], sw: []}, gloed: {p: [], n: [], k: [], si: [], sw: []}, halo: {p: [], n: [], k: [], si: [], sw: []}};
    const zet = (doel, pos, nrm, kl, si, sw) => { doel.p.push(pos[0], pos[1], pos[2]); doel.n.push(nrm[0], nrm[1], nrm[2]); doel.k.push(kl[0], kl[1], kl[2]); doel.si.push(si[0], si[1], si[2], si[3]); doel.sw.push(sw[0], sw[1], sw[2], sw[3]); };
    const origPunt = [];
    const punt = (i) => {
      if(origPunt[i]) return origPunt[i];
      const w = {}; for(let k = 0; k < 4; k++){ const ww = comp(SW, i, k); if(ww > 0){ const b = comp(SI, i, k); w[b] = (w[b] || 0) + ww; } }
      return (origPunt[i] = maakPunt([P.getX(i), P.getY(i), P.getZ(i)], [N.getX(i), N.getY(i), N.getZ(i)], w));
    };
    // een punt binnen een driehoek (barycentrisch): positie, normaal en botgewichten mengen
    const binnenPunt = (A, B, C, u, v) => {
      const t = 1 - u - v, w = {};
      for(const [X, f] of [[A, t], [B, u], [C, v]]) if(f > 0) for(const k in X.w) w[k] = (w[k] || 0) + X.w[k] * f;
      const p = [0, 1, 2].map(k => A.p[k] * t + B.p[k] * u + C.p[k] * v);
      const n = [0, 1, 2].map(k => A.n[k] * t + B.n[k] * u + C.n[k] * v), l = Math.hypot(n[0], n[1], n[2]) || 1;
      return maakPunt(p, [n[0] / l, n[1] / l, n[2] / l], w);
    };
    const meng = (a, b, t) => {
      const w = {};
      for(const k in a.w) w[k] = (w[k] || 0) + a.w[k] * (1 - t);
      for(const k in b.w) w[k] = (w[k] || 0) + b.w[k] * t;
      const n = [a.n[0] + (b.n[0] - a.n[0]) * t, a.n[1] + (b.n[1] - a.n[1]) * t, a.n[2] + (b.n[2] - a.n[2]) * t], l = Math.hypot(n[0], n[1], n[2]) || 1;
      const L = (x, y) => x + (y - x) * t;
      return {p: [L(a.p[0], b.p[0]), L(a.p[1], b.p[1]), L(a.p[2], b.p[2])], n: [n[0] / l, n[1] / l, n[2] / l], w, rand: true,
        q: a.q && b.q ? [L(a.q[0], b.q[0]), L(a.q[1], b.q[1]), L(a.q[2], b.q[2])] : null, qn: a.qn && b.qn ? [L(a.qn[0], b.qn[0]), L(a.qn[1], b.qn[1]), L(a.qn[2], b.qn[2])] : null,
        mk: a.mk !== undefined && b.mk !== undefined ? L(a.mk, b.mk) : 0, id1: t < 0.5 ? a.id1 : b.id1, id2: t < 0.5 ? a.id2 : b.id2};
    };
    const gewichten = (w) => {
      const lijst = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 4);
      let som = 0; for(const [, x] of lijst) som += x;
      const si = [0, 0, 0, 0], sw = [0, 0, 0, 0];
      lijst.forEach(([b, x], k) => { si[k] = +b; sw[k] = x / (som || 1); });
      return {si, sw};
    };
    // knip een veelhoek tot het deel waar het veld > 0 is (Sutherland-Hodgman)
    const knip = (pts, f) => {
      const uitP = [];
      for(let k = 0; k < pts.length; k++){
        const a = pts[k], b = pts[(k + 1) % pts.length], fa = f[k], fb = f[(k + 1) % pts.length];
        if(fa > 0) uitP.push(a);
        if((fa > 0) !== (fb > 0)){ const t = fa / (fa - fb); uitP.push(meng(a, b, t)); }
      }
      return uitP;
    };
    // de plaat zelf: buitenkant + zijkanten
    const dikte = (d) => d === 'schouder' ? 0.021 : d === 'kap' ? 0.016 : d === 'romp' ? 0.013 : d === 'been' ? 0.012 : d === 'arm' ? 0.010 : 0.009;
    const OFF = 0.0025;
    const op = (q, h) => [q.p[0] + q.n[0] * h, q.p[1] + q.n[1] * h, q.p[2] + q.n[2] * h];
    // afronding: aan de rand staat de plaat op 55% van zijn dikte en over 7 mm loopt hij rond op tot vol
    const BW = 0.007;
    const rondHoogte = (q, onder, boven, c) => {
      if(c === undefined || onder === null) return boven;
      const f = q.rand ? 0 : Math.max(0, veldPlaat(q, c));
      const t = Math.min(1, f / BW), r = Math.sqrt(1 - (1 - t) * (1 - t));     // kwart cirkel
      return onder + (boven - onder) * (0.55 + 0.45 * r);
    };
    const vul = (doel, poly, kl, onder, boven, c) => {
      const hg = poly.map(q => rondHoogte(q, onder, boven, c));
      for(let k = 1; k + 1 < poly.length; k++){
        for(const i of [0, k, k + 1]){ const q = poly[i], g = gewichten(q.w); zet(doel, op(q, hg[i]), q.n, kl, g.si, g.sw); }
      }
      if(onder === null) return;
      // zijkanten langs de randen die door het knippen zijn ontstaan
      for(let k = 0; k < poly.length; k++){
        const a = poly[k], b = poly[(k + 1) % poly.length];
        if(!(a.rand && b.rand)) continue;
        const ab = [b.p[0] - a.p[0], b.p[1] - a.p[1], b.p[2] - a.p[2]];
        let wn = [ab[1] * a.n[2] - ab[2] * a.n[1], ab[2] * a.n[0] - ab[0] * a.n[2], ab[0] * a.n[1] - ab[1] * a.n[0]];
        const l = Math.hypot(wn[0], wn[1], wn[2]) || 1; wn = wn.map(x => x / l);
        const ga = gewichten(a.w), gb = gewichten(b.w), donker = [kl[0] * 0.78, kl[1] * 0.78, kl[2] * 0.8];
        const a0 = op(a, onder), a1 = op(a, hg[k]), b0 = op(b, onder), b1 = op(b, hg[(k + 1) % poly.length]);
        zet(doel, a0, wn, donker, ga.si, ga.sw); zet(doel, b0, wn, donker, gb.si, gb.sw); zet(doel, b1, wn, donker, gb.si, gb.sw);
        zet(doel, a0, wn, donker, ga.si, ga.sw); zet(doel, b1, wn, donker, gb.si, gb.sw); zet(doel, a1, wn, donker, ga.si, ga.sw);
      }
    };
    // ── LICHTSTREPEN ──
    // Een streep is de strook tussen twee rechte grenzen (plus een begin en een eind). Elke grens is een
    // 'lineair veld', en die kun je precies knippen — hoe groot de driehoekjes ook zijn.
    const knipReeks = (pts, velden) => { let poly = pts; for(const v of velden){ const f = poly.map(v); if(f.every(x => x <= 0)) return []; if(!f.every(x => x > 0)) poly = knip(poly, f); if(poly.length < 3) return []; } return poly; };
    const dot3 = (q, s, d) => (q.q[0] - s[0]) * d[0] + (q.q[1] - s[1]) * d[1] + (q.q[2] - s[2]) * d[2];
    const streep = (pts, oorsprong, langsAs, dwarsAs, breed, lengte, extra, hoogte) => {
      const velden = [q => breed / 2 - dot3(q, oorsprong, dwarsAs), q => breed / 2 + dot3(q, oorsprong, dwarsAs), q => dot3(q, oorsprong, langsAs), q => lengte - dot3(q, oorsprong, langsAs)].concat(extra);
      const poly = knipReeks(pts, velden);
      if(poly.length >= 3) vul(uit.gloed, poly, [1, 1, 1], null, hoogte);
    };
    const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const kruis3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    // groef midden op een plaat, langs het lichaamsdeel
    const groef = (pts, s, c, hoogte) => {
      const as2 = s.deel === 'arm' ? [Math.sign(s.x) || 1, 0, 0] : [0, 1, 0];
      const dwars = norm3(kruis3(as2, [s.nx, s.ny, s.nz]));
      const L = 0.075, start = [s.x - as2[0] * L / 2, s.y - as2[1] * L / 2, s.z - as2[2] * L / 2];
      streep(pts, start, as2, dwars, 0.0042, L, [q => veldPlaat(q, c) - 0.008], hoogte);
    };
    const paarGloeit = (a, b) => hash(Math.min(a, b), Math.max(a, b)) < 0.3;
    // de 'V' van licht op de borst (zoals in Brian's ontwerp): twee strepen die onderaan samenkomen
    const borstbeen = zaden[zaden.length - 1];
    const vStrepen = (() => {
      const punt0 = [borstbeen.x, borstbeen.y - 0.012, borstbeen.z], uit2 = [];
      for(const sx of [-1, 1]){
        const top = [borstbeen.x + sx * 0.06, borstbeen.y + 0.06, borstbeen.z];
        const d = [top[0] - punt0[0], top[1] - punt0[1], top[2] - punt0[2]], L = Math.hypot(d[0], d[1], d[2]);
        const langs = [d[0] / L, d[1] / L, d[2] / L], dwars = norm3(kruis3(langs, [VOOR.x, VOOR.y, VOOR.z]));
        uit2.push({start: punt0, langs, dwars, L});
      }
      return uit2;
    })();
    // ── alle driehoeken van het lijf: in 16 stukjes verdelen, dan per plaat knippen ──
    const S = opties.verdeling || (opties.licht ? 3 : 4);
    for(let t = 0; t < nTri; t++){
      const ia = I ? I[t * 3] : t * 3, ib = I ? I[t * 3 + 1] : t * 3 + 1, ic = I ? I[t * 3 + 2] : t * 3 + 2;
      const A = punt(ia), B = punt(ib), C = punt(ic);
      if(A.mk < -0.03 && B.mk < -0.03 && C.mk < -0.03) continue;           // helemaal in een handschoen/gewricht
      // raster van punten binnen de driehoek (rij i hoort bij B, kolom j bij C)
      const R = [];
      for(let i = 0; i <= S; i++){ R.push([]); for(let j = 0; j <= S - i; j++){
        R[i].push(i === 0 && j === 0 ? A : (i === S ? B : (j === S ? C : binnenPunt(A, B, C, i / S, j / S))));
      } }
      const sub = [];
      for(let i = 0; i < S; i++) for(let j = 0; j < S - i; j++){
        sub.push([R[i][j], R[i + 1][j], R[i][j + 1]]);
        if(j < S - i - 1) sub.push([R[i + 1][j], R[i + 1][j + 1], R[i][j + 1]]);
      }
      for(const pts of sub){
        const cellen = new Set(pts.map(q => q.id1));
        for(const c of cellen){
          const f = pts.map(q => veldPlaat(q, c));
          if(f.every(x => x <= 0)) continue;
          const poly = f.every(x => x > 0) ? pts : knip(pts, f);
          if(poly.length < 3) continue;
          const s = zaden[c], h = hash(c, 3), h2 = hash(c, 9);
          const basis = h < 0.12 ? 0.68 : 0.8 + 0.04 * h2;                  // gebroken wit (echt wit plastic weerkaatst ~75%), een paar platen net iets grijzer
          const kl = opties.kleurPerPlaat ? [hash(c, 1), hash(c, 2), hash(c, 4)] : [basis * 0.985, basis * 0.99, basis];
          const dk = dikte(s.deel) + (h - 0.5) * 0.003;
          vul(uit.plaat, poly, kl, OFF, OFF + dk, c);
          if(h2 > 0.62 && s !== borstbeen) groef(pts, s, c, OFF + dk + 0.0006);
          if(Math.hypot(s.x - borstbeen.x, s.y - borstbeen.y, s.z - borstbeen.z) < 0.14) for(const v of vStrepen) streep(pts, v.start, v.langs, v.dwars, 0.0045, v.L, [q => veldPlaat(q, c) - BW, q => q.qn[0] * VOOR.x + q.qn[2] * VOOR.z - 0.3], OFF + dk + 0.0006);   // (niet op de afgeronde rand: daar ligt de plaat lager)
        }
        // blauwe lichtlijn in sommige naden
        // lichtlijn in sommige naden (tussen twee bepaalde platen), net onder de plaatrand
        { const a0 = pts[0].id1, b0 = pts[0].id2;
          if(paarGloeit(a0, b0) && pts.every(q => (q.id1 === a0 || q.id1 === b0) && (q.id2 === a0 || q.id2 === b0))){
            const poly = knipReeks(pts, [q => 0.0017 - totGrens(q, a0, b0), q => 0.0017 + totGrens(q, a0, b0), q => q.mk + 0.01]);
            if(poly.length >= 3) vul(uit.gloed, poly, [1, 1, 1], null, OFF + 0.0062);   // diep in de naad, net onder de afgeronde plaatranden
          } }
      }
    }
    // gladde normalen: voor elk hoekpunt het gemiddelde van de vlakjes eromheen die minder dan 55° afwijken.
    // Dan zien de afgeronde randen er rond uit, maar blijven de zijkanten van de platen scherp.
    const gladNormalen = (b) => {
      const n = b.p.length / 9, fn = new Float32Array(n * 3), emmer = new Map(), sleutel = (i) => Math.round(b.p[i * 3] * 8000) + ',' + Math.round(b.p[i * 3 + 1] * 8000) + ',' + Math.round(b.p[i * 3 + 2] * 8000);
      for(let f = 0; f < n; f++){
        const o = f * 9, ux = b.p[o + 3] - b.p[o], uy = b.p[o + 4] - b.p[o + 1], uz = b.p[o + 5] - b.p[o + 2], vx = b.p[o + 6] - b.p[o], vy = b.p[o + 7] - b.p[o + 1], vz = b.p[o + 8] - b.p[o + 2];
        let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        // de gewenste kant (zoals bij het maken gezet) bepaalt de richting
        if(nx * b.n[o] + ny * b.n[o + 1] + nz * b.n[o + 2] < 0){ nx = -nx; ny = -ny; nz = -nz; }
        fn[f * 3] = nx; fn[f * 3 + 1] = ny; fn[f * 3 + 2] = nz;     // (lengte = 2× oppervlak: grote vlakjes tellen zwaarder)
        for(let k = 0; k < 3; k++){ const key = sleutel(f * 3 + k); let e = emmer.get(key); if(!e) emmer.set(key, e = []); e.push(f); }
      }
      const KREUK = Math.cos(55 * Math.PI / 180);
      for(let i = 0; i < n * 3; i++){
        const f = (i / 3) | 0, ax = fn[f * 3], ay = fn[f * 3 + 1], az = fn[f * 3 + 2], al = Math.hypot(ax, ay, az) || 1;
        let sx = 0, sy = 0, sz = 0;
        for(const g of emmer.get(sleutel(i))){ const gx = fn[g * 3], gy = fn[g * 3 + 1], gz = fn[g * 3 + 2], gl = Math.hypot(gx, gy, gz) || 1; if((ax * gx + ay * gy + az * gz) / (al * gl) >= KREUK){ sx += gx; sy += gy; sz += gz; } }
        const l = Math.hypot(sx, sy, sz);
        if(l > 0){ b.n[i * 3] = sx / l; b.n[i * 3 + 1] = sy / l; b.n[i * 3 + 2] = sz / l; }
      }
    };
    gladNormalen(uit.plaat);
    const maak = (b, mat) => {
      if(!b.p.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(b.k, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(b.si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(b.sw, 4));
      const m = new THREE.SkinnedMesh(g, mat);
      m.position.copy(lijf.position); m.quaternion.copy(lijf.quaternion); m.scale.copy(lijf.scale);
      m.bind(lijf.skeleton, lijf.bindMatrix);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
      return m;
    };
    return {
      platen: maak(uit.plaat, opties.plaatMat), gloed: maak(uit.gloed, opties.gloedMat), halo: opties.haloMat ? maak(uit.halo, opties.haloMat) : null,
      info: {zaden: zaden.length, plaatDriehoeken: uit.plaat.p.length / 9, gloedDriehoeken: uit.gloed.p.length / 9}
    };
  };
})();
