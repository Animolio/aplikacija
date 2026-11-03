/* Animolio aplikacija — ulaz za agente (3.11.2026.). Probna verzija: tekst ugovora nije konačan. */
(function () {
  'use strict';
  const UGOVOR_VERZIJA = 'nacrt-0';
  const UGOVOR = [
    ['Članak 1. Predmet ugovora', '[Tekst ugovora nakon pregleda odvjetnika]'],
    ['Članak 2. Kod agenta', '[Tekst ugovora]'],
    ['Članak 3. Provizija i obračun', '[Tekst ugovora]'],
    ['Članak 4. Isplata', '[Tekst ugovora]'],
    ['Članak 5. Raskid suradnje s partnerom', '[Tekst ugovora]'],
    ['Članak 6. Završne odredbe', '[Tekst ugovora]']
  ];
  const zastavica = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  try { if (new URLSearchParams(location.search).get('proba') === '1') zastavica('animolio_proba', '1'); } catch (e) {}

  function oibIspravan(oib) {
    if (!/^\d{11}$/.test(oib)) return false;
    let a = 10;
    for (let i = 0; i < 10; i++) { a = (a + Number(oib[i])) % 10; if (a === 0) a = 10; a = (a * 2) % 11; }
    return ((11 - a) % 10) === Number(oib[10]);
  }
  function ibanIspravan(iban) {
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
    const pr = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
    let ost = 0; for (const z of pr) ost = (ost * 10 + Number(z)) % 97;
    return ost === 1;
  }
  async function sha256(t) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const dobro = (da) => { const p = document.querySelector('.poruka'); if (p) p.style.color = da ? 'var(--tekst)' : ''; };
  const vrhAgent = (A, natrag) => A.vrh(natrag).replace('>ANIMOLIO<', '>ANIMOLIO AGENT<');
  const traka = (k) => `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px">${[1, 2, 3, 4].map((i) => `<div style="height:4px;border-radius:4px;background:${i <= k ? 'var(--tekst)' : 'var(--rub)'}"></div>`).join('')}</div>`;

  const AG = {
    vezaUlaz() {
      return zastavica('animolio_proba') === '1' ? '<button class="veza" type="button" id="agentUlaz">Postanite Animolio Agent</button>' : '';
    },
    // Poziva se iz app.js nakon prijave. Vraća true ako agentski dio preuzima.
    async preuzmi(A) {
      const { data: a } = await A.sb.from('agenti').select('*').eq('id', A.S.korisnik.id).maybeSingle();
      if (!a && zastavica('animolio_namjera') !== 'agent') return false;
      AG.A = A; AG.a = a;
      if (!a) return zaslonPodaci(), true;
      if (a.stanje === 'prijava') return zaslonUgovor(), true;
      if (a.stanje === 'potpisano') return zaslonCeka(), true;
      if (a.stanje === 'odobren') return zaslonOdobren(), true;
      zaslonKraj(); return true;
    }
  };

  // Poveznica na ulaznom zaslonu Kluba
  document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('#agentUlaz')) return;
    zastavica('animolio_namjera', 'agent');
    const h = document.querySelector('h1.veliki'); if (h) h.textContent = 'Animolio Agent';
    const p = h && h.nextElementSibling; if (p) p.textContent = 'Prijava za suradnju. Nakon prijave e-poštom upisujete podatke i potpisujete ugovor.';
    e.target.closest('#agentUlaz').remove();
  });

  function zaslonPodaci() {
    const A = AG.A; const a = AG.a || {};
    A.prikazi(`${vrhAgent(A, false)}${traka(1)}
      <h1>Vaši podaci</h1>
      <form id="f" style="display:flex;flex-direction:column;gap:14px;flex:1">
        <label class="polje">Ime i prezime<input type="text" id="ime" autocomplete="name" maxlength="80" value="${A.esc(a.ime_prezime || '')}"></label>
        <label class="polje">OIB<input type="text" id="oib" inputmode="numeric" maxlength="11" value="${A.esc(a.oib || '')}"></label>
        <label class="polje">E-pošta<input type="email" value="${A.esc(A.S.korisnik.email)}" disabled></label>
        <label class="polje">IBAN za isplatu provizije<input type="text" id="iban" autocapitalize="characters" value="${A.esc(a.iban || '')}"></label>
        <p class="sitno">Ako prijava ne bude odobrena, podatke brišemo.</p>
        <p class="poruka" role="alert"></p>
        <div class="dno"><button class="gumb" type="submit">Dalje</button><button class="veza" type="button" id="odustani">Odustani</button></div>
      </form>`);
    A.app.querySelector('#odustani').addEventListener('click', () => { zastavica('animolio_namjera', null); A.zaslonPocetna(); });
    A.app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = e.submitter;
      const ime = A.app.querySelector('#ime').value.trim().replace(/\s+/g, ' ');
      const oib = A.app.querySelector('#oib').value.replace(/\D/g, '');
      const iban = A.app.querySelector('#iban').value.toUpperCase().replace(/\s/g, '');
      if (ime.length < 3 || !ime.includes(' ')) return A.greska('Upišite ime i prezime.');
      if (!oibIspravan(oib)) return A.greska('OIB nije ispravan. Provjerite znamenke.');
      if (!ibanIspravan(iban)) return A.greska('IBAN nije ispravan. Provjerite slova i znamenke.');
      A.zauzeto(b, true);
      const r = AG.a
        ? await A.sb.from('agenti').update({ ime_prezime: ime, oib, iban }).eq('id', A.S.korisnik.id).select('*').single()
        : await A.sb.from('agenti').insert({ ime_prezime: ime, oib, iban }).select('*').single();
      A.zauzeto(b, false);
      if (r.error) return A.greska(r.error.code === '23505' ? 'Prijava s ovim OIB-om već postoji.' : 'Podaci nisu spremljeni. Pokušajte ponovno.');
      AG.a = r.data; zaslonUgovor();
    });
  }

  function zaslonUgovor() {
    const A = AG.A; let procitano = false; let kodOk = false; let crtano = false;
    const tekst = UGOVOR.map(([n, t]) => `<b style="color:var(--tekst)">${n}</b><span>${t}</span>`).join('');
    A.prikazi(`${vrhAgent(A, true)}${traka(2)}
      <h1 style="font-size:26px">Ugovor o suradnji</h1>
      <div class="okvir" style="font-size:13px">Probna verzija: tekst ugovora još nije konačan.</div>
      <div id="ugovor" tabindex="0" style="height:220px;overflow-y:auto;border:1px solid var(--rub);border-radius:14px;background:var(--kartica);padding:16px;display:flex;flex-direction:column;gap:8px;font-size:14px;line-height:1.5;color:#4F3E33">${tekst}<span style="font-weight:700;text-align:center;color:var(--tekst)">Kraj ugovora</span></div>
      <div id="korak2" style="display:flex;flex-direction:column;gap:10px;opacity:.4;pointer-events:none">
        <button class="gumb drugi" type="button" id="posaljiKod">Pošalji kod za potpis na ${A.esc(A.S.korisnik.email)}</button>
        <input type="text" id="kodPotpis" class="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="10" aria-label="Kod za potpis" placeholder="">
        <div style="position:relative;height:150px;border:1.5px dashed #BBA996;border-radius:14px;background:var(--kartica)">
          <span style="position:absolute;left:14px;top:10px;font-size:12px;font-weight:600;color:var(--blago)">Potpis prstom</span>
          <button type="button" id="obrisi" style="position:absolute;right:10px;top:8px;border:1px solid var(--rub);background:var(--kartica);color:var(--tekst);border-radius:10px;padding:0 12px;font:inherit;font-size:13px;font-weight:600;height:36px">Obriši</button>
          <canvas id="platno" style="width:100%;height:100%;touch-action:none;display:block"></canvas>
        </div>
      </div>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="gumb" type="button" id="potpisi" disabled>Pročitajte ugovor do kraja</button></div>`, () => { zaslonPodaci(); });
    const ug = A.app.querySelector('#ugovor'); const k2 = A.app.querySelector('#korak2'); const gb = A.app.querySelector('#potpisi');
    const osvjezi = () => {
      if (!procitano) return;
      k2.style.opacity = 1; k2.style.pointerEvents = 'auto';
      gb.disabled = !(kodOk && crtano);
      gb.textContent = kodOk && crtano ? 'Potpiši i pošalji' : (kodOk ? 'Potpišite se prstom' : 'Upišite kod iz e-pošte');
    };
    const provjeriKraj = () => { if (ug.scrollTop + ug.clientHeight >= ug.scrollHeight - 8) { procitano = true; osvjezi(); } };
    ug.addEventListener('scroll', provjeriKraj); setTimeout(provjeriKraj, 50);

    A.app.querySelector('#posaljiKod').addEventListener('click', async (e) => {
      A.zauzeto(e.target, true);
      const { error } = await A.sb.auth.signInWithOtp({ email: A.S.korisnik.email, options: { shouldCreateUser: false } });
      A.zauzeto(e.target, false);
      A.greska(error ? 'Kod nije poslan. Pričekajte minutu pa pokušajte ponovno.' : 'Kod je poslan. Upišite ga ispod.'); dobro(!error);
    });
    const kp = A.app.querySelector('#kodPotpis');
    const provjeriKod = async (rucno) => {
      const t = kp.value.replace(/\D/g, '');
      if (kodOk) return;
      if (t.length < 8 && !(rucno && t.length >= 6)) { return osvjezi(); }
      const { error } = await A.sb.auth.verifyOtp({ email: A.S.korisnik.email, token: t, type: 'email' });
      kodOk = !error; kp.style.borderColor = error ? 'var(--greska)' : 'var(--tekst)';
      A.greska(error ? 'Kod nije ispravan ili je istekao.' : 'Kod je potvrđen.'); dobro(!error);
      if (!error) kp.disabled = true;
      osvjezi();
    };
    kp.addEventListener('input', () => provjeriKod(false));
    kp.addEventListener('change', () => provjeriKod(true));

    const c = A.app.querySelector('#platno'); const x = c.getContext('2d');
    const velicina = () => { const r = c.getBoundingClientRect(); const d = window.devicePixelRatio || 1; c.width = r.width * d; c.height = r.height * d; x.scale(d, d); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#3A2A21'; };
    velicina();
    let crta = false;
    const tocka = (ev) => { const r = c.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
    c.addEventListener('pointerdown', (ev) => { crta = true; c.setPointerCapture(ev.pointerId); const [px, py] = tocka(ev); x.beginPath(); x.moveTo(px, py); });
    c.addEventListener('pointermove', (ev) => { if (!crta) return; const [px, py] = tocka(ev); x.lineTo(px, py); x.stroke(); if (!crtano) { crtano = true; osvjezi(); } });
    c.addEventListener('pointerup', () => { crta = false; });
    A.app.querySelector('#obrisi').addEventListener('click', () => { x.clearRect(0, 0, c.width, c.height); crtano = false; osvjezi(); });

    gb.addEventListener('click', async () => {
      A.zauzeto(gb, true);
      const hash = await sha256(UGOVOR_VERZIJA + '\n' + UGOVOR.map((u) => u.join('\n')).join('\n'));
      const { data, error } = await A.sb.from('agenti').update({ ugovor_verzija: UGOVOR_VERZIJA, ugovor_hash: hash, potpis: c.toDataURL('image/png'), stanje: 'potpisano' }).eq('id', A.S.korisnik.id).select('*').single();
      A.zauzeto(gb, false);
      if (error) return A.greska('Potpis nije spremljen. Pokušajte ponovno.');
      AG.a = data; zastavica('animolio_namjera', null); zaslonCeka();
    });
  }

  function zaslonCeka() {
    const A = AG.A;
    A.prikazi(`${vrhAgent(A, false)}${traka(3)}
      <div class="sredina centar" style="align-items:center">
        <h1>Ugovor je poslan</h1>
        <p style="max-width:300px">MOZON pregledava prijavu i potpisuje ugovor. Kad prijava bude odobrena, ovdje ćete vidjeti svoj kod.</p>
      </div>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="gumb drugi" id="osvjezi">Provjeri ponovno</button><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#osvjezi').addEventListener('click', async (e) => {
      A.zauzeto(e.target, true);
      const { data } = await A.sb.from('agenti').select('*').eq('id', A.S.korisnik.id).maybeSingle();
      A.zauzeto(e.target, false);
      AG.a = data;
      if (data && data.stanje === 'odobren') zaslonOdobren(); else A.greska('Prijava još čeka odobrenje.');
    });
    A.app.querySelector('#odjava').addEventListener('click', odjava);
  }

  function zaslonOdobren() {
    const A = AG.A; const a = AG.a;
    A.prikazi(`${vrhAgent(A, false)}${traka(4)}
      <div class="sredina centar" style="align-items:center">
        <span class="sitno" style="font-weight:600">Suradnja je odobrena</span>
        <span class="oznaka" style="letter-spacing:.2em">VAŠ KOD</span>
        <span style="font-family:Georgia,serif;font-weight:600;font-size:52px;line-height:1">${A.esc(a.kod)}</span>
        <span class="okvir" style="font-size:14px">${a.akademija_polozena ? 'Kod je aktivan' : 'Aktivira se nakon Akademije'}</span>
        ${a.akademija_polozena ? '' : '<p class="sitno" style="max-width:300px">Akademija se priprema.</p>'}
      </div>
      <div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#odjava').addEventListener('click', odjava);
  }

  function zaslonKraj() {
    const A = AG.A;
    A.prikazi(`${vrhAgent(A, false)}
      <div class="sredina centar"><h1>Prijava nije aktivna</h1><p>Za pitanja pišite na animolio@mozon.hr.</p></div>
      <div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#odjava').addEventListener('click', odjava);
  }

  async function odjava() { await AG.A.sb.auth.signOut(); location.reload(); }

  window.AnimolioAgent = AG;
})();
