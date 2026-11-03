/* Animolio aplikacija — izgled (3.11.2026.)
   Klub: Animolio, Sven, Marcy, Fluffy, Custom (fotografija ljubimca). Agent, Partner i MOZON: samo Animolio.
   Način: kao mobitel / svijetlo / tamno. Fotografija ostaje samo na ovom uređaju. */
(function () {
  'use strict';
  const SKINS = {
    animolio: { naziv: 'Animolio', L: { bg: '#FDFCF8', surface: '#FFFFFF', surface2: '#FBEEE8', ink: '#3A2A21', muted: '#6E5C50', line: '#EEDFD6', accent: '#3A2A21', accentInk: '#FDFCF8', accentSoft: '#F7E1D7', hero: '#F7E1D7', heroInk: '#3A2A21' }, D: { bg: '#1A1310', surface: '#241B17', surface2: '#2E231E', ink: '#F7EDE6', muted: '#BBA79A', line: '#3A2C25', accent: '#F2CDBE', accentInk: '#2A1A12', accentSoft: '#3A2822', hero: '#3A2822', heroInk: '#F7EDE6' } },
    sven: { naziv: 'Sven', L: { bg: '#FDF8F6', surface: '#FFFFFF', surface2: '#FBEAE4', ink: '#2B2326', muted: '#6F5F61', line: '#F0DFDA', accent: '#B8323A', accentInk: '#FFFFFF', accentSoft: '#FBE3DF', hero: '#7D3338', heroInk: '#FFF4F1' }, D: { bg: '#1A1214', surface: '#24191B', surface2: '#2F2023', ink: '#F7ECEA', muted: '#C3A8A8', line: '#3D2A2D', accent: '#EE7A6E', accentInk: '#2A1214', accentSoft: '#3A2124', hero: '#4A2226', heroInk: '#F7ECEA' } },
    marcy: { naziv: 'Marcy', L: { bg: '#F7F9FC', surface: '#FFFFFF', surface2: '#E9F0F7', ink: '#1E2747', muted: '#55607E', line: '#DDE5EF', accent: '#2A5297', accentInk: '#FFFFFF', accentSoft: '#E3EBF6', hero: '#263472', heroInk: '#F3F6FC' }, D: { bg: '#0F1424', surface: '#171E33', surface2: '#1F2842', ink: '#E9EEF7', muted: '#9AA6C2', line: '#28324D', accent: '#72AFD2', accentInk: '#0D1A2B', accentSoft: '#1C2C47', hero: '#1D2A55', heroInk: '#E9EEF7' } },
    fluffy: { naziv: 'Fluffy', L: { bg: '#FCFAF2', surface: '#FFFFFF', surface2: '#F5EDCF', ink: '#3A2F1A', muted: '#6F6248', line: '#EDE4C8', accent: '#86652F', accentInk: '#FFFFFF', accentSoft: '#F6EED4', hero: '#E1C983', heroInk: '#3A2F1A' }, D: { bg: '#17140C', surface: '#211C11', surface2: '#2B2516', ink: '#F5EEDB', muted: '#BFB291', line: '#3A321E', accent: '#E1C983', accentInk: '#241D0C', accentSoft: '#352C17', hero: '#3A3018', heroInk: '#F5EEDB' } },
  };
  const SEM = { L: { bad: '#9B2C2C', good: '#2F7A4A' }, D: { bad: '#EE8B78', good: '#6FC48F' } };
  const VARS = { bg: '--pozadina', surface: '--kartica', surface2: '--kartica2', ink: '--tekst', muted: '--blago', line: '--rub', accent: '--naglasak', accentInk: '--naglasak-tekst', accentSoft: '--naglasak-blago', hero: '--hero', heroInk: '--hero-tekst', bad: '--greska', good: '--dobro' };
  const KLJUC = 'animolio_izgled', KFOTO = 'animolio_foto';
  const sp = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; } catch (e) { return v === undefined ? null : false; } };

  let T = { skin: 'animolio', nacin: 'sustav', boje: null };
  try { const s = JSON.parse(sp(KLJUC) || 'null'); if (s && s.skin) T = Object.assign(T, s); } catch (e) {}
  let uloga = 'klub';

  /* ---- boje ---- */
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16));
  const hex = (c) => '#' + c.map((v) => ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2)).join('').toUpperCase();
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const onto = (c) => (cr(c, '#FFFFFF') >= cr(c, '#141414') ? '#FFFFFF' : '#141414');
  const fix = (c, bg, prema, min) => { let k = 0, o = c; while (cr(o, bg) < min && k < 20) { k++; o = mix(c, prema, k * 0.05); } return o; };

  // Naglasak iz fotografije: najzasićenija boja srednje svjetline; pozadina i tekst izvedeni, s provjerom čitljivosti.
  function izFotografije(a) {
    const bg = mix(a, '#FFFFFF', 0.93), ink = mix(a, '#141414', 0.82);
    const acc = fix(a, bg, ink, 4.5);
    const L = { bg, surface: '#FFFFFF', surface2: mix(bg, a, 0.08), ink, muted: fix(mix(ink, bg, 0.38), bg, ink, 4.5), line: mix(bg, ink, 0.12), accent: acc, accentInk: onto(acc), accentSoft: mix(bg, a, 0.16), hero: ink, heroInk: onto(ink) };
    const dbg = mix(a, '#0C0C0D', 0.9), dink = '#F4F2EE', dacc = fix(a, dbg, '#FFFFFF', 4.5);
    const D = { bg: dbg, surface: mix(a, '#0C0C0D', 0.84), surface2: mix(a, '#0C0C0D', 0.78), ink: dink, muted: mix(dink, dbg, 0.36), line: mix(dbg, dink, 0.14), accent: dacc, accentInk: onto(dacc), accentSoft: mix(dbg, dacc, 0.16), hero: mix(a, '#0C0C0D', 0.74), heroInk: dink };
    return { L, D };
  }
  function naglasakIzSlike(img) {
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; const x = c.getContext('2d');
    x.drawImage(img, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data;
    let best = null, bs = -1;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 510;
      if (l < 0.18 || l > 0.82) continue;
      const s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
      const sc = s * (1 - Math.abs(l - 0.45));
      if (sc > bs) { bs = sc; best = [r, g, b]; }
    }
    if (!best || bs < 0.12) return '#8B6B3D'; // siva fotografija: ostaje Animolio smeđa
    return hex(best);
  }

  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const tamno = () => (T.nacin === 'tamno' ? true : T.nacin === 'svijetlo' ? false : !!(mq && mq.matches));
  const skinZaUlogu = () => (uloga === 'klub' ? T.skin : 'animolio');

  function primijeni() {
    const d = tamno(), sk = skinZaUlogu();
    let pal = SKINS[sk];
    if (sk === 'custom') pal = T.boje ? izFotografije(T.boje) : SKINS.animolio;
    if (!pal) pal = SKINS.animolio;
    const t = Object.assign({}, pal[d ? 'D' : 'L'], SEM[d ? 'D' : 'L']);
    const r = document.documentElement;
    Object.keys(VARS).forEach((k) => r.style.setProperty(VARS[k], t[k]));
    r.style.colorScheme = d ? 'dark' : 'light';
    r.dataset.izgled = sk; r.dataset.nacin = d ? 'tamno' : 'svijetlo';
    if (['sven', 'marcy', 'fluffy'].includes(sk)) r.style.setProperty('--motiv', `url(motiv-${sk}.jpg)`); else r.style.removeProperty('--motiv');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.bg);
  }
  if (mq) { try { mq.addEventListener('change', primijeni); } catch (e) { mq.addListener(primijeni); } }
  const spremi = () => sp(KLJUC, JSON.stringify(T));

  /* ---- fotografija ---- */
  const foto = () => sp(KFOTO);
  function ucitajFoto(datoteka) {
    return new Promise((ok, ne) => {
      const fr = new FileReader();
      fr.onerror = () => ne(new Error('citanje'));
      fr.onload = () => {
        const img = new Image();
        img.onerror = () => ne(new Error('slika'));
        img.onload = () => {
          const max = 900, k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const url = c.toDataURL('image/jpeg', 0.8);
          if (!sp(KFOTO, url)) return ne(new Error('mjesto'));
          T.boje = naglasakIzSlike(c); T.skin = 'custom'; spremi(); primijeni(); ok(url);
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(datoteka);
    });
  }

  /* ---- zaslon Postavke ---- */
  const ikonaFoto = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
  function postavke(A, natrag) {
    const klub = uloga === 'klub';
    const f = foto();
    const pl = (k) => {
      const pr = T.skin === k ? 'true' : 'false';
      if (k === 'animolio') return `<button type="button" class="izgled-gumb" data-skin="animolio" aria-pressed="${pr}"><span class="izgled-slika slovo">A</span><span>Animolio</span></button>`;
      if (k === 'custom') return `<button type="button" class="izgled-gumb" data-skin="custom" aria-pressed="${pr}"><span class="izgled-slika foto"${f ? ` style="background-image:url(${f})"` : ''}>${f ? '' : ikonaFoto}</span><span>Foto</span></button>`;
      return `<button type="button" class="izgled-gumb" data-skin="${k}" aria-pressed="${pr}"><span class="izgled-slika" style="background-image:url(motiv-${k}.jpg)"></span><span>${SKINS[k].naziv}</span></button>`;
    };
    A.prikazi(`${A.vrh(true)}<h1>Postavke</h1>
      ${klub ? `<section class="kartica"><span class="oznaka">IZGLED APLIKACIJE</span>
        <div class="izgledi">${['animolio', 'sven', 'marcy', 'fluffy', 'custom'].map(pl).join('')}</div>
        <input type="file" id="foto" accept="image/*" hidden>
        <div id="fotoInfo">${T.skin === 'custom' ? '<button type="button" class="gumb drugi mali" id="fotoNova">Promijeni fotografiju</button>' : ''}</div>
        <p class="sitno">Fotografija ostaje samo na ovom mobitelu i ne šalje se nikamo. Boje se uzimaju iz fotografije i prilagođavaju da tekst ostane čitljiv.</p>
        <p class="sitno">Ilustracije s etiketa: akademski slikar Eugen Varzić.</p></section>` : ''}
      <section class="kartica"><span class="oznaka">NAČIN PRIKAZA</span>
        <div class="segment" role="group" aria-label="Način prikaza">${[['sustav', 'Kao mobitel'], ['svijetlo', 'Svijetlo'], ['tamno', 'Tamno']].map(([k, n]) => `<button type="button" data-nacin="${k}" aria-pressed="${T.nacin === k}">${n}</button>`).join('')}</div></section>
      <p class="poruka" role="alert"></p>
      ${klub && A.odjava ? '<div class="dno"><button class="veza" type="button" id="odjava">Odjava</button></div>' : ''}`, natrag);
    const app = A.app, por = app.querySelector('.poruka');
    const od = app.querySelector('#odjava'); if (od) od.addEventListener('click', A.odjava);
    const ponovno = () => postavke(A, natrag);
    const traziFoto = () => app.querySelector('#foto').click();
    app.querySelectorAll('[data-skin]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.skin;
      if (k === 'custom' && !foto()) return traziFoto();
      T.skin = k; spremi(); primijeni(); ponovno();
    }));
    const fn = app.querySelector('#fotoNova'); if (fn) fn.addEventListener('click', traziFoto);
    const fi = app.querySelector('#foto');
    if (fi) fi.addEventListener('change', async () => {
      const d = fi.files && fi.files[0]; if (!d) return;
      try { await ucitajFoto(d); ponovno(); }
      catch (e) { por.textContent = e.message === 'mjesto' ? 'Fotografija je prevelika za spremanje na ovom mobitelu. Pokušajte s drugom.' : 'Fotografija se nije učitala. Pokušajte s drugom.'; }
    });
    app.querySelectorAll('[data-nacin]').forEach((b) => b.addEventListener('click', () => { T.nacin = b.dataset.nacin; spremi(); primijeni(); ponovno(); }));
  }

  window.AnimolioTema = {
    primijeni,
    uloga(u) { uloga = u || 'klub'; primijeni(); },
    postavke,
    foto: () => (skinZaUlogu() === 'custom' ? foto() : null),
    izgled: () => skinZaUlogu()
  };
  primijeni();
})();
