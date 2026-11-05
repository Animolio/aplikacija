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
      if (error) return A.greska(error.code === '23505' ? 'Prijava s ovim OIB-om već postoji. Prijavite se adresom e-pošte s kojom ste se prvi put prijavili ili pišite na animolio@mozon.hr.' : 'Prijava nije poslana. Pokušajte ponovno.');
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
    A.prikazi(`${A.zaglavlje('ANIMOLIO PARTNER')}<h1>${A.esc(p.naziv)}</h1>
      <div id="novo"></div>
      <div id="zarada" style="display:flex;flex-direction:column;gap:12px"></div>
      <div class="kartica" style="flex-direction:row;align-items:center;gap:16px"><div class="qr-okvir">${qrSvg(link, 120)}</div>
        <div style="display:flex;flex-direction:column;gap:6px"><span class="oznaka">KOD ZA KUPCE</span><span class="kod-srednji">${A.esc(p.kod)}</span></div></div>
      <button class="gumb drugi" id="dijeli">Podijeli poveznicu za kupce</button>
      <div class="kartica"><span class="oznaka">AKADEMIJA ZA PARTNERE</span>
        <ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px;font-size:15px;line-height:1.45">${PRAVILA.map((t) => `<li>${t}</li>`).join('')}</ul>
        ${p.pravila_procitana ? '<span class="sitno">Potvrđeno.</span>' : '<button class="gumb mali" id="procitao">Pročitao/la sam što smijemo reći kupcima</button>'}
      </div>
      <p class="poruka" role="alert"></p><div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#odjava').addEventListener('click', odjava);
    A.vezPostavke(pocetna);
    if (window.AnimolioNovo) window.AnimolioNovo.u(A, 'partner', A.app.querySelector('#novo'), pocetna);
    zarada(A, A.app.querySelector('#zarada'));
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

  // Zarada partnera: samo neto, bez PDV-a (Zdravko 5.11.2026.). Obračun mjesečno, plaćanje po računu partnera.
  const MJ = ['siječnju', 'veljači', 'ožujku', 'travnju', 'svibnju', 'lipnju', 'srpnju', 'kolovozu', 'rujnu', 'listopadu', 'studenom', 'prosincu'];
  const eurP = (v) => Number(v || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const datP = (d) => { const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return `${x.getDate()}. ${x.getMonth() + 1}. ${x.getFullYear()}.`; };
  const bocP = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'bočica' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'bočice' : 'bočica'}`;
  async function zarada(A, el) {
    if (!el) return;
    const [zr, is] = await Promise.all([A.sb.rpc('partner_zarada'), A.sb.from('partner_isplate').select('id, obracun_od, obracun_do, iznos_eur, racun, isplaceno').order('obracun_do', { ascending: false })]);
    if (zr.error || is.error) { el.innerHTML = ''; return; }
    const z = (Array.isArray(zr.data) ? zr.data[0] : zr.data) || {}; const isp = is.data || [];
    const ceka = isp.filter((i) => !i.isplaceno && !i.racun);
    el.innerHTML = `<div class="zarada-kartica"><span class="zk-oznaka">Vaša zarada u ${MJ[new Date().getMonth()]}, bez PDV-a</span>
        <span class="zk-broj">${eurP(z.mjesec)} <small>€</small></span>
        <div class="zk-dno"><div><b>${eurP(z.u_cekanju)} €</b><span>u čekanju${z.dana_cekanja ? ` (${z.dana_cekanja} dana)` : ''}</span></div><div><b>${eurP(z.za_obracun)} €</b><span>za idući obračun</span></div></div>
        <span class="zk-oznaka">${bocP(Number(z.bocica_mjesec || 0))} prodano s vašim kodom ovaj mjesec</span></div>
      ${ceka.map((i) => `<button class="gumb" type="button" data-racun="${i.id}">Pošalji račun na ${eurP(i.iznos_eur)} €</button>`).join('')}
      ${isp.length ? `<span class="oznaka">OBRAČUNI I ISPLATE</span><div class="kartica lista">${isp.map((i) => `<div class="stavka"><div class="stavka-tekst"><b>Obračun ${datP(i.obracun_od)} – ${datP(i.obracun_do)}</b>
        <span class="sitno">${i.isplaceno ? `Isplaćeno ${datP(i.isplaceno)}` : i.racun ? 'Račun primljen, čeka isplatu' : 'Čeka vaš račun'}</span></div><b>${eurP(i.iznos_eur)} €</b></div>`).join('')}</div>` : ''}`;
    el.querySelectorAll('[data-racun]').forEach((b) => b.addEventListener('click', () => {
      const i = isp.find((x) => x.id === Number(b.dataset.racun)); if (i) zaslonRacun(A, i);
    }));
  }
  function zaslonRacun(A, i) {
    A.prikazi(`${vrhP(A, true)}<h1>Pošalji račun</h1>
      <div class="kartica"><span class="oznaka">NA RAČUNU MORA PISATI</span>
        <span>Kupac: <b>MOZON d.o.o.</b>, Malo Budaševo 86, 44202 Budaševo, OIB 90016851974</span>
        <span>Opis: <b>Usluga preporuke Animolio proizvoda, ${datP(i.obracun_od)} – ${datP(i.obracun_do)}</b></span>
        <span>Iznos bez PDV-a: <b>${eurP(i.iznos_eur)} €</b></span>
</div>
      <label class="polje">Račun (PDF ili fotografija, do 10 MB)<input type="file" id="dat" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"></label>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="gumb" type="button" id="salji">Pošalji</button></div>`, pocetna);
    A.app.querySelector('#salji').addEventListener('click', async (e) => {
      const f = A.app.querySelector('#dat').files[0];
      if (!f) return A.greska('Odaberite datoteku.');
      if (f.size > 10485760) return A.greska('Datoteka je veća od 10 MB.');
      const ext = ((f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'pdf';
      const put = `${A.S.korisnik.id}/racuni/${Date.now()}.${ext}`;
      const b = e.currentTarget; A.zauzeto(b, true);
      const up = await A.sb.storage.from('agenti').upload(put, f, { contentType: f.type || undefined, upsert: false });
      if (up.error) { A.zauzeto(b, false); return A.greska('Datoteka nije učitana. Pokušajte ponovno.'); }
      const r = await A.sb.rpc('partner_posalji_racun', { isplata: i.id, putanja: put });
      A.zauzeto(b, false);
      if (r.error) return A.greska('Slanje nije uspjelo. Pokušajte ponovno.');
      pocetna();
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
