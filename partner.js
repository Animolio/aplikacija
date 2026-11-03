/* Animolio aplikacija — partneri i agentov QR za nove partnere (3.11.2026.) */
(function () {
  'use strict';
  const zast = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
  try { const p = new URLSearchParams(location.search).get('partner'); if (p) { zast('animolio_agent_kod', p.trim().toUpperCase()); history.replaceState(null, '', location.pathname); } } catch (e) {}
  const adresa = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  const qrSvg = (tekst, vel) => { const q = window.qrcode(0, 'M'); q.addData(tekst); q.make(); const n = q.getModuleCount(); return q.createSvgTag({ cellSize: Math.max(2, Math.floor(vel / (n + 8))), margin: 4, scalable: true }).replace('<svg ', `<svg role="img" aria-label="QR kod" style="width:${vel}px;height:${vel}px;display:block" `); };
  function oibIspravan(oib) { if (!/^\d{11}$/.test(oib)) return false; let a = 10; for (let i = 0; i < 10; i++) { a = (a + Number(oib[i])) % 10; if (a === 0) a = 10; a = (a * 2) % 11; } return ((11 - a) % 10) === Number(oib[10]); }
  const vrhP = (A, natrag) => A.vrh(natrag).replace('>ANIMOLIO<', '>ANIMOLIO PARTNER<');
  const dobro = (A, t) => { const p = A.app.querySelector('.poruka'); if (p) { p.textContent = t; p.style.color = 'var(--tekst)'; } };

  const PT = {};
  // Poziva se iz app.js nakon prijave. Vraća true ako partnerski dio preuzima.
  PT.preuzmi = async function (A) {
    const { data: p } = await A.sb.from('partneri').select('*').eq('id', A.S.korisnik.id).maybeSingle();
    if (!p && !zast('animolio_agent_kod')) return false;
    if (!p) { const { data: ag } = await A.sb.from('agenti').select('id').eq('id', A.S.korisnik.id).maybeSingle(); if (ag) { zast('animolio_agent_kod', null); return false; } }
    PT.A = A; PT.p = p;
    if (!p) return prijava(), true;
    if (p.stanje === 'prijava') return poslano(), true;
    if (p.stanje === 'odobren') return pocetna(), true;
    kraj(); return true;
  };

  async function prijava() {
    const A = PT.A; const kodA = zast('animolio_agent_kod');
    const { data: ag } = await A.sb.rpc('agent_po_kodu', { k: kodA });
    const agent = ag && ag[0];
    A.prikazi(`${vrhP(A, false)}<h1>Prijava partnera</h1>
      ${agent ? `<p class="sitno">Preporučio vas je ${A.esc(agent.ime)}, Animolio Agent.</p>` : '<p class="sitno">Kod agenta nije pronađen. Prijavu možete poslati i bez njega.</p>'}
      <form id="f" style="display:flex;flex-direction:column;gap:14px;flex:1">
        <label class="polje">Naziv obrta ili tvrtke<input type="text" id="naziv" maxlength="80" autocomplete="organization"></label>
        <label class="polje">OIB<input type="text" id="oib" inputmode="numeric" maxlength="11"></label>
        <label class="polje">Adresa lokacije<input type="text" id="adr" maxlength="160" autocomplete="street-address"></label>
        <label class="polje">E-pošta<input type="email" value="${A.esc(A.S.korisnik.email)}" disabled></label>
        <label style="display:flex;gap:12px;align-items:flex-start;font-size:14px;line-height:1.45;color:var(--tekst)"><input type="checkbox" id="priv" style="width:22px;height:22px;flex:none;margin:0"> <span>Pročitao/la sam <a href="https://www.animolio.eu/zastita-privatnosti" target="_blank" rel="noopener">Zaštitu privatnosti</a>.</span></label>
        <p class="poruka" role="alert"></p>
        <div class="dno"><button class="gumb" type="submit">Pošalji prijavu</button></div>
      </form>`);
    A.app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = e.submitter;
      const naziv = A.app.querySelector('#naziv').value.trim().replace(/\s+/g, ' ');
      const oib = A.app.querySelector('#oib').value.replace(/\D/g, '');
      const adr = A.app.querySelector('#adr').value.trim().replace(/\s+/g, ' ');
      if (naziv.length < 2) return A.greska('Upišite naziv obrta ili tvrtke.');
      if (!oibIspravan(oib)) return A.greska('OIB nije ispravan. Provjerite znamenke.');
      if (adr.length < 5) return A.greska('Upišite adresu lokacije.');
      if (!A.app.querySelector('#priv').checked) return A.greska('Potvrdite da ste pročitali Zaštitu privatnosti.');
      A.zauzeto(b, true);
      const red = { naziv, oib, adresa: adr }; if (agent) red.agent_id = agent.id;
      const { data, error } = await A.sb.from('partneri').insert(red).select('*').single();
      A.zauzeto(b, false);
      if (error) return A.greska(error.code === '23505' ? 'Prijava s ovim OIB-om već postoji.' : 'Prijava nije poslana. Pokušajte ponovno.');
      PT.p = data; zast('animolio_agent_kod', null); poslano();
    });
  }

  function poslano() {
    const A = PT.A;
    A.prikazi(`${vrhP(A, false)}<div class="sredina centar" style="align-items:center"><h1>Prijava je poslana</h1>
      <p style="max-width:300px">MOZON pregledava prijavu. Kad bude odobrena, ovdje ćete vidjeti svoj kod za kupce.</p></div>
      <p class="poruka" role="alert"></p><div class="dno"><button class="gumb drugi" id="osvjezi">Provjeri ponovno</button><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#osvjezi').addEventListener('click', async () => {
      const { data } = await A.sb.from('partneri').select('*').eq('id', A.S.korisnik.id).maybeSingle(); PT.p = data;
      if (data && data.stanje === 'odobren') pocetna(); else dobro(A, 'Prijava još čeka odobrenje.');
    });
    A.app.querySelector('#odjava').addEventListener('click', odjava);
  }

  const PRAVILA = [
    'Serumi njeguju šape, njuškicu, kožu i dlaku. Ne liječe i ne sprječavaju bolesti.',
    'FLUFFY sadrži eterično ulje čajevca. Nije za mačke. Mačkama preporučujemo MARCY.',
    'SVEN sadrži lavandu. MARCY je bez eteričnih ulja i najblaži je od tri.',
    'Ako šapa ili koža izgleda bolesno (crvena, otečena, rana, ljubimac šepa), kupca uputite veterinaru.',
    'Preporuke vrijede samo za pse i mačke.',
    'Kupac u Animolio Klubu dobiva preporuku prema svom ljubimcu.'
  ];
  function pocetna() {
    const A = PT.A; const p = PT.p; const link = adresa() + '?kod=' + encodeURIComponent(p.kod);
    A.prikazi(`${vrhP(A, false)}<h1>${A.esc(p.naziv)}</h1>
      <div class="kartica" style="flex-direction:row;align-items:center;gap:16px">${qrSvg(link, 120)}
        <div style="display:flex;flex-direction:column;gap:6px"><span class="oznaka">KOD ZA KUPCE</span><span style="font-family:Georgia,serif;font-weight:600;font-size:28px;line-height:1">${A.esc(p.kod)}</span></div></div>
      <button class="gumb drugi" id="dijeli">Podijeli poveznicu za kupce</button>
      <div class="kartica"><span class="oznaka">AKADEMIJA ZA PARTNERE</span>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:15px;line-height:1.45">${PRAVILA.map((t) => `<li>${t}</li>`).join('')}</ul>
        ${p.pravila_procitana ? '<span class="sitno">Potvrđeno.</span>' : '<button class="gumb mali" id="procitao">Pročitao/la sam što smijemo reći kupcima</button>'}
      </div>
      <p class="poruka" role="alert"></p><div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#odjava').addEventListener('click', odjava);
    A.app.querySelector('#dijeli').addEventListener('click', async () => {
      try { if (navigator.share) await navigator.share({ title: 'Animolio Klub', url: link }); else { await navigator.clipboard.writeText(link); dobro(A, 'Poveznica je kopirana.'); } } catch (e) {}
    });
    const pr = A.app.querySelector('#procitao');
    if (pr) pr.addEventListener('click', async () => {
      A.zauzeto(pr, true); const { error } = await A.sb.rpc('partner_procitao'); A.zauzeto(pr, false);
      if (error) return A.greska('Nije spremljeno. Pokušajte ponovno.');
      PT.p.pravila_procitana = new Date().toISOString(); pocetna();
    });
  }

  function kraj() {
    const A = PT.A;
    A.prikazi(`${vrhP(A, false)}<div class="sredina centar"><h1>Suradnja nije aktivna</h1><p>Za pitanja pišite na animolio@mozon.hr.</p></div>
      <div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#odjava').addEventListener('click', odjava);
  }
  async function odjava() { await PT.A.sb.auth.signOut(); location.reload(); }

  // Agentov dio: QR za novog partnera i popis njegovih partnera (koristi agent.js)
  PT.agentQR = function (A, a, natrag) {
    const link = adresa() + '?partner=' + encodeURIComponent(a.kod);
    A.prikazi(`${A.vrh(true).replace('>ANIMOLIO<', '>ANIMOLIO AGENT<')}<h1>Novi partner</h1>
      <div class="sredina centar" style="align-items:center"><div style="padding:18px;background:#fff;border:1px solid var(--rub);border-radius:22px">${qrSvg(link, 230)}</div>
      <p style="max-width:290px">Partner skenira kod svojim mobitelom i sam upisuje podatke.</p></div>
      <p class="sitno centar">Na vašem mobitelu ne ostaju partnerovi podaci.</p>`, natrag);
  };
  PT.mojiPartneri = async function (A) {
    const { data } = await A.sb.rpc('moji_partneri');
    if (!data || !data.length) return '<p class="sitno">Još nemate partnera.</p>';
    const st = { prijava: 'Čeka odobrenje', odobren: 'Aktivan', raskinut: 'Suradnja završena' };
    return data.map((p) => `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--rub)"><b>${A.esc(p.naziv)}</b><span class="sitno">${st[p.stanje] || ''}${p.kod ? ' · ' + A.esc(p.kod) : ''}</span></div>`).join('');
  };

  window.AnimolioPartner = PT;
})();
