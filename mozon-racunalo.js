/* Animolio · MOZON pregled za računalo (3.11.2026.) */
(function () {
  'use strict';
  const C = window.ANIMOLIO;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const m = document.getElementById('m');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const datum = (d) => d ? new Date(d).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const eur = (x) => Number(x || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const STANJE = { prijava: 'Nije potpisao', potpisano: 'Čeka odobrenje', odobren: 'Odobren', odbijen: 'Odbijen', raskinut: 'Raskinut' };
  const SEKCIJE = [['prijave', 'Prijave agenata'], ['agenti', 'Agenti'], ['partneri', 'Partneri'], ['kodovi', 'Kodovi za popust'], ['prodaje', 'Prodaje po kodu'], ['provizija', 'Provizija i isplate'], ['klub', 'Klub']];
  let email = ''; let aktivna = 'prijave'; let cekaBroj = 0;

  /* ---------- Prijava ---------- */
  function prijava(poruka) {
    m.innerHTML = `<form class="prijavaM" id="f"><span class="marka">ANIMOLIO · MOZON</span><h1>Prijava</h1>
      <label class="polje">E-pošta<input type="email" id="mail" autocomplete="email" required value="${esc(email)}"></label>
      <p class="poruka" role="alert">${esc(poruka || '')}</p><button class="gumb" type="submit">Pošalji kod za prijavu</button></form>`;
    m.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault(); email = m.querySelector('#mail').value.trim().toLowerCase();
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) return (m.querySelector('.poruka').textContent = 'Kod nije poslan. Pričekajte minutu pa pokušajte ponovno.');
      kod();
    });
  }
  function kod() {
    m.innerHTML = `<form class="prijavaM" id="f"><span class="marka">ANIMOLIO · MOZON</span><h1>Kod iz e-pošte</h1>
      <p class="sitno">Poslan na ${esc(email)}.</p>
      <input type="text" id="kod" class="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="10" aria-label="Kod iz e-pošte" required>
      <p class="poruka" role="alert"></p><button class="gumb" type="submit">Prijava</button></form>`;
    m.querySelector('#kod').focus();
    m.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const { error } = await sb.auth.verifyOtp({ email, token: m.querySelector('#kod').value.replace(/\D/g, ''), type: 'email' });
      if (error) return (m.querySelector('.poruka').textContent = 'Kod nije ispravan ili je istekao.');
      start();
    });
  }

  /* ---------- Okvir ---------- */
  function okvir() {
    m.innerHTML = `<div class="okvirM"><nav class="bocno" aria-label="Sekcije"><span class="marka">ANIMOLIO · MOZON</span>
      ${SEKCIJE.map(([k, n]) => `<button data-s="${k}" ${k === aktivna ? 'aria-current="page"' : ''}>${n}${k === 'prijave' && cekaBroj ? `<span class="broj">${cekaBroj}</span>` : ''}</button>`).join('')}
      <div class="dolje"><button id="odjava">Odjava</button></div></nav><main class="glavno" id="g"></main></div>`;
    m.querySelector('nav').addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { aktivna = b.dataset.s; prikazi(); } });
    m.querySelector('#odjava').addEventListener('click', async () => { await sb.auth.signOut(); prijava(); });
  }
  async function prikazi() { okvir(); const g = m.querySelector('#g'); g.innerHTML = '<p class="sitno">Učitavam…</p>'; try { await ({ prijave, agenti, partneri, kodovi, prodaje, provizija, klub })[aktivna](g); } catch (e) { g.innerHTML = '<p class="poruka">Podaci se nisu učitali. Osvježite stranicu.</p>'; } }
  const rpc = async (ime, arg) => { const { data, error } = await sb.rpc(ime, arg); if (error) throw error; return data; };
  const naslov = (t, opis) => `<h1>${t}</h1>${opis ? `<p class="sitno">${opis}</p>` : ''}`;

  /* ---------- Sekcije ---------- */
  async function prijave(g) {
    const d = (await rpc('mozon_prijave')).filter((p) => p.stanje === 'potpisano' || p.stanje === 'prijava');
    cekaBroj = d.filter((p) => p.stanje === 'potpisano').length; okvir(); g = m.querySelector('#g');
    if (!d.length) { g.innerHTML = naslov('Prijave agenata') + '<p class="sitno">Nema prijava koje čekaju.</p>'; return; }
    g.innerHTML = naslov('Prijave agenata', 'Odbijanjem se podaci prijave brišu.') + `<table><thead><tr><th>Ime i prezime</th><th>E-pošta</th><th>OIB</th><th>IBAN</th><th>Potpis</th><th>Stanje</th><th></th></tr></thead><tbody>
      ${d.map((p) => `<tr data-id="${p.id}"><td><b>${esc(p.ime_prezime)}</b></td><td>${esc(p.email)}</td><td>${esc(p.oib)}</td><td>${esc(p.iban)}</td>
        <td>${p.potpis && /^data:image\/png;base64,/.test(p.potpis) ? `<img class="potpisImg" src="${p.potpis}" alt="Potpis">` : ''}<span class="sitno">${datum(p.potpisano)}${p.ugovor_verzija ? ' · ' + esc(p.ugovor_verzija) : ''}</span></td>
        <td><span class="oznakaS ${p.stanje === 'potpisano' ? 'ceka' : ''}">${STANJE[p.stanje]}</span></td>
        <td>${p.stanje === 'potpisano' ? '<button class="mali glavni" data-a="odobri">Odobri</button> <button class="mali" data-a="odbij">Odbij</button>' : ''}</td></tr>`).join('')}</tbody></table><p class="poruka" role="alert"></p>`;
    g.querySelector('tbody').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; const por = g.querySelector('.poruka');
      if (b.dataset.a === 'odbij' && b.textContent !== 'Potvrdi brisanje') { b.textContent = 'Potvrdi brisanje'; return; }
      b.disabled = true;
      try {
        if (b.dataset.a === 'odobri') { const k = await rpc('mozon_odobri', { agent: id }); por.style.color = 'var(--tekst)'; por.textContent = `Odobreno. Kod agenta: ${k}.`; }
        else { await rpc('mozon_odbij', { agent: id }); por.style.color = 'var(--tekst)'; por.textContent = 'Prijava odbijena, podaci obrisani.'; }
        setTimeout(prikazi, 1500);
      } catch (er) { b.disabled = false; por.style.color = ''; por.textContent = 'Radnja nije uspjela. Pokušajte ponovno.'; }
    });
  }

  async function agenti(g) {
    const d = await rpc('mozon_agenti');
    g.innerHTML = naslov('Agenti') + (d.length ? `<table><thead><tr><th>Ime i prezime</th><th>E-pošta</th><th>Kod</th><th>Odobren</th><th>Akademija</th><th>Stanje</th><th></th></tr></thead><tbody>
      ${d.map((a) => `<tr data-id="${a.id}"><td><b>${esc(a.ime_prezime)}</b></td><td>${esc(a.email)}</td><td><b>${esc(a.kod)}</b></td><td>${datum(a.odobreno)}</td>
        <td>${a.akademija_polozena ? 'Položena ' + datum(a.akademija_polozena) : (a.stanje === 'odobren' ? '<button class="mali" data-a="akad">Označi položenom</button>' : '')}</td>
        <td><span class="oznakaS">${STANJE[a.stanje]}</span></td><td>${a.stanje === 'odobren' ? '<button class="mali" data-a="raskid">Raskid suradnje</button>' : ''}</td></tr>`).join('')}</tbody></table><p class="poruka" role="alert"></p>` : '<p class="sitno">Još nema odobrenih agenata.</p>');
    const tb = g.querySelector('tbody'); if (!tb) return;
    tb.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id;
      if (b.dataset.a === 'raskid' && b.textContent !== 'Potvrdi raskid') { b.textContent = 'Potvrdi raskid'; return; }
      b.disabled = true;
      try { await rpc(b.dataset.a === 'akad' ? 'mozon_akademija' : 'mozon_raskini', { agent: id }); prikazi(); }
      catch (er) { b.disabled = false; g.querySelector('.poruka').textContent = 'Radnja nije uspjela.'; }
    });
  }

  async function partneri(g) {
    const d = await rpc('mozon_partneri');
    const ST = { prijava: 'Čeka odobrenje', odobren: 'Aktivan', raskinut: 'Raskinut' };
    g.innerHTML = naslov('Partneri', 'Odbijanjem se podaci prijave brišu. Raskidom kod prelazi pod Animolio: kupci zadržavaju popust, a agent više ne vidi kod.') + (d.length ? `<table><thead><tr><th>Naziv</th><th>OIB</th><th>Adresa</th><th>E-pošta</th><th>Agent</th><th>Kod</th><th>Pravila</th><th>Stanje</th><th></th></tr></thead><tbody>
      ${d.map((p) => `<tr data-id="${p.id}"><td><b>${esc(p.naziv)}</b><br><span class="sitno">${datum(p.stvoreno)}</span></td><td>${esc(p.oib)}</td><td>${esc(p.adresa)}</td><td>${esc(p.email)}</td>
        <td>${p.agent ? esc(p.agent) + ' · ' + esc(p.agent_kod) : '<span class="sitno">bez agenta</span>'}</td><td><b>${esc(p.kod || '')}</b></td>
        <td>${p.pravila_procitana ? 'Potvrđeno ' + datum(p.pravila_procitana) : ''}</td>
        <td><span class="oznakaS ${p.stanje === 'prijava' ? 'ceka' : ''}">${ST[p.stanje] || ''}</span></td>
        <td>${p.stanje === 'prijava' ? '<button class="mali glavni" data-a="odobri">Odobri</button> <button class="mali" data-a="odbij">Odbij</button>' : (p.stanje === 'odobren' ? '<button class="mali" data-a="raskid">Raskid suradnje</button>' : '')}</td></tr>`).join('')}</tbody></table><p class="poruka" role="alert"></p>` : '<p class="sitno">Još nema prijava partnera.</p>');
    const tb = g.querySelector('tbody'); if (!tb) return;
    tb.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; const por = g.querySelector('.poruka');
      if (b.dataset.a === 'odbij' && b.textContent !== 'Potvrdi brisanje') { b.textContent = 'Potvrdi brisanje'; return; }
      if (b.dataset.a === 'raskid' && b.textContent !== 'Potvrdi raskid') { b.textContent = 'Potvrdi raskid'; return; }
      b.disabled = true;
      try {
        if (b.dataset.a === 'odobri') { const k = await rpc('mozon_odobri_partnera', { partner: id }); por.style.color = 'var(--tekst)'; por.textContent = `Odobreno. Kod partnera: ${k}.`; setTimeout(prikazi, 1500); }
        else { await rpc(b.dataset.a === 'odbij' ? 'mozon_odbij_partnera' : 'mozon_raskini_partnera', { partner: id }); prikazi(); }
      } catch (er) { b.disabled = false; por.style.color = ''; por.textContent = 'Radnja nije uspjela. Pokušajte ponovno.'; }
    });
  }

  const adresaApp = () => location.origin + location.pathname.replace(/[^/]*$/, '');
  const qrSvg = (tekst) => { const q = window.qrcode(0, 'M'); q.addData(tekst); q.make(); return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true }); };
  function prikaziQr(el, kod) {
    const link = adresaApp() + '?kod=' + encodeURIComponent(kod); const svg = qrSvg(link);
    el.innerHTML = `<div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap;margin:12px 0"><div style="width:150px;background:#fff;padding:8px;border:1px solid #E8DFD3;border-radius:12px">${svg}</div>
      <div style="display:flex;flex-direction:column;gap:8px"><span>Kod <b>${esc(kod)}</b></span><span class="sitno">${esc(link)}</span><a class="mali" id="preuzmiQr" download="QR-${esc(kod)}.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}">Preuzmi QR za tisak (SVG)</a></div></div>`;
  }
  let prikaziKlub = false;
  async function kodovi(g) {
    const d = await rpc('mozon_kodovi');
    const VR = { partner: 'Partner', privatni: 'Privatni', test: 'Test', donacija: 'Donacija', animolio: 'Animolio', kampanja: 'Kampanja', klub: 'Član Kluba' };
    const glavni = d.filter((k) => k.vrsta !== 'klub'); const klub = d.filter((k) => k.vrsta === 'klub');
    const zbroj = (a, f) => a.reduce((s, k) => s + Number(k[f] || 0), 0);
    const red = (k) => `<tr data-kod="${esc(k.kod)}"><td><b>${esc(k.kod)}</b>${k.aktivan ? '' : '<br><span class="sitno">ugašen</span>'}</td><td>${VR[k.vrsta] || esc(k.vrsta)}${k.preneseno ? `<br><span class="sitno">od ${datum(k.preneseno)}</span>` : ''}</td><td>${esc(k.partner || k.naziv)}</td><td>${k.agent ? esc(k.agent) : ''}</td><td>${k.u_wixu ? 'Da' : ''}</td>
        <td class="br">${k.narudzbi_partner}</td><td class="br">${eur(k.iznos_partner)}</td><td class="br">${k.preneseno ? k.narudzbi_animolio : ''}</td><td class="br">${k.preneseno ? eur(k.iznos_animolio) : ''}</td><td class="br">${eur(k.popust_eur)}</td><td>${datum(k.zadnja)}</td>
        <td>${k.vrsta === 'kampanja' ? '<button class="mali" data-a="qr">QR</button> ' : ''}${['kampanja', 'klub', 'animolio'].includes(k.vrsta) ? (k.aktivan ? '<button class="mali" data-a="ugasi">Ugasi</button>' : '<button class="mali" data-a="ukljuci">Uključi</button>') : ''}</td></tr>`;
    const zaglavlje = '<table><thead><tr><th>Kod</th><th>Vrsta</th><th>Naziv / partner</th><th>Agent</th><th>Wix auto</th><th class="br">Narudžbi</th><th class="br">Iznos</th><th class="br">Nakon prijenosa: narudžbi</th><th class="br">Nakon prijenosa: iznos</th><th class="br">Popust</th><th>Zadnja</th><th></th></tr></thead><tbody>';
    g.innerHTML = naslov('Kodovi za popust', 'Narudžbe se broje od 2.11.2026. Kod bivšeg partnera prelazi pod Animolio: prodaje do prijenosa pripadaju partneru i agentu, prodaje poslije prijenosa Animoliju. „Wix auto” znači da je kupon u Wixu stvorio n8n. Ugašenom kodu n8n briše kupon u Wixu.')
      + `<form id="kamp" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:8px 0 4px"><label class="polje" style="min-width:260px">Novi kod za kampanju (naziv kampanje)<input type="text" id="kampNaziv" maxlength="60"></label><button class="mali glavni" type="submit">Napravi kod</button></form><div id="kampRez"></div>`
      + zaglavlje + glavni.map(red).join('') + '</tbody></table>'
      + `<h2 style="margin-top:28px">Osobni kodovi članova Kluba</h2><p class="sitno">${klub.length} kodova (aktivnih ${klub.filter((k) => k.aktivan).length}) · narudžbi ${zbroj(klub, 'narudzbi_partner')} · iznos ${eur(zbroj(klub, 'iznos_partner'))} · popust ${eur(zbroj(klub, 'popust_eur'))}</p>`
      + (klub.length ? `<button class="mali" id="klubTog">${prikaziKlub ? 'Sakrij popis' : 'Prikaži popis'}</button>` + (prikaziKlub ? zaglavlje + klub.map(red).join('') + '</tbody></table>' : '') : '')
      + '<p class="poruka" role="alert"></p>';
    const por = g.querySelector('.poruka');
    const kt = g.querySelector('#klubTog'); if (kt) kt.addEventListener('click', () => { prikaziKlub = !prikaziKlub; prikazi(); });
    g.querySelector('#kamp').addEventListener('submit', async (e) => {
      e.preventDefault(); const b = e.submitter; const naziv = g.querySelector('#kampNaziv').value.trim();
      if (naziv.length < 2) { por.textContent = 'Upišite naziv kampanje.'; return; }
      b.disabled = true;
      try { const kod = await rpc('mozon_nova_kampanja', { naziv }); por.textContent = ''; prikaziQr(g.querySelector('#kampRez'), kod); g.querySelector('#kampRez').insertAdjacentHTML('beforeend', '<p class="sitno">Kupon u Wixu nastaje za desetak sekundi. Kod se pojavljuje u tablici kad osvježite sekciju.</p>'); g.querySelector('#kampNaziv').value = ''; }
      catch (er) { por.style.color = ''; por.textContent = 'Kod nije napravljen. Pokušajte ponovno.'; }
      b.disabled = false;
    });
    g.querySelectorAll('tbody').forEach((tb) => tb.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const kod = b.closest('tr').dataset.kod;
      if (b.dataset.a === 'qr') { prikaziQr(g.querySelector('#kampRez'), kod); g.querySelector('#kampRez').scrollIntoView({ behavior: 'smooth' }); return; }
      if (b.dataset.a === 'ugasi' && b.textContent !== 'Potvrdi gašenje') { b.textContent = 'Potvrdi gašenje'; return; }
      b.disabled = true;
      try { await rpc('mozon_kod_aktivan', { k: kod, da: b.dataset.a === 'ukljuci' }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Radnja nije uspjela.'; }
    }));
  }

  async function prodaje(g) {
    const d = await rpc('mozon_prodaje');
    if (!d.length) { g.innerHTML = naslov('Prodaje po kodu') + '<p class="sitno">Još nema prodaja s kodom.</p>'; return; }
    g.innerHTML = naslov('Prodaje po kodu', 'Samo narudžbe s kodom za popust, od 2.11.2026.') + `<table><thead><tr><th>Mjesec</th><th>Kod</th><th>Proizvod</th><th class="br">Komada</th><th class="br">Iznos</th><th class="br">Popust</th></tr></thead><tbody>
      ${d.map((p) => `<tr><td>${esc(p.mjesec)}</td><td><b>${esc(p.kod)}</b></td><td>${esc(p.proizvod)}</td><td class="br">${p.komada}</td><td class="br">${eur(p.iznos_eur)}</td><td class="br">${eur(p.popust_eur)}</td></tr>`).join('')}</tbody></table>`;
  }

  async function klub(g) {
    const [k] = await rpc('mozon_klub');
    const pl = (n, t) => `<div class="plocica"><span class="oznaka">${t}</span><b>${n}</b></div>`;
    g.innerHTML = naslov('Klub', 'Samo brojke, bez osobnih podataka članova.') + `<div class="plocice">${pl(k.clanova, 'ČLANOVA')}${pl(k.s_kodom, 'S KODOM PARTNERA')}${pl(k.ljubimaca, 'LJUBIMACA')}${pl(k.pasa, 'PASA')}${pl(k.macaka, 'MAČAKA')}</div>`;
  }

  /* ---------- Provizija i isplate (3.11.2026.) — fiksni iznos po razini ---------- */
  const dan = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
  async function provizija(g) {
    const [{ data: s, error: es }, { data: raz, error: er }, d, isp] = await Promise.all([
      sb.from('agent_postavke').select('dana_cekanja, dan_obracuna, dan_isplate, najmanja_isplata').eq('id', 1).maybeSingle(),
      sb.from('razine').select('redni, naziv, po_bocici, po_trilogy').order('redni'),
      rpc('mozon_provizija'), rpc('mozon_isplate')]);
    if (es || er) throw (es || er);
    const v = (x) => x === null || x === undefined ? '' : esc(x);
    const iznosPolje = (r, k) => `<input type="number" data-r="${r.redni}" data-k="${k}" min="0" step="0.01" inputmode="decimal" value="${r[k] === null || r[k] === undefined ? '' : Number(r[k]).toFixed(2)}" aria-label="${esc(r.naziv)}, ${k === 'po_bocici' ? 'po bočici' : 'TRILOGY po paketu'}">`;
    const imeRazine = (n) => { const r = (raz || []).find((x) => x.redni === n); return r ? `${n} · ${esc(r.naziv)}` : String(n); };
    g.innerHTML = naslov('Provizija i isplate', 'Provizija je fiksan iznos po prodanoj bočici, prema razini agenta na dan prodaje. Agent vidi samo svoju proviziju i broj bočica.') + `
      <section class="plocica" style="gap:12px;max-width:720px">
        <span class="oznaka">RAZINE I IZNOSI</span>
        <table><thead><tr><th>Razina</th><th class="br">Po bočici (€)</th><th class="br">TRILOGY po paketu (€)</th></tr></thead><tbody>
          ${(raz || []).map((r) => `<tr><td><span style="font-weight:700">${imeRazine(r.redni)}</span></td><td class="br">${iznosPolje(r, 'po_bocici')}</td><td class="br">${iznosPolje(r, 'po_trilogy')}</td></tr>`).join('')}
        </tbody></table>
        <button class="mali glavni" type="button" id="spremiRazine" style="align-self:flex-start">Spremi iznose</button>
        <p class="poruka" id="porR" role="alert"></p>
      </section>
      <section class="plocica" style="gap:12px;max-width:720px">
        <span class="oznaka">ROKOVI</span>
        <form id="uvjeti" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:end">
          <label class="polje">Rok čekanja (dana)<input type="number" id="cek" min="0" max="120" step="1" inputmode="numeric" value="${v(s && s.dana_cekanja)}"></label>
          <label class="polje">Obračun do (dan)<input type="number" id="obr" min="1" max="28" step="1" inputmode="numeric" value="${v(s && s.dan_obracuna)}"></label>
          <label class="polje">Isplata do (dan)<input type="number" id="dan" min="1" max="28" step="1" inputmode="numeric" value="${v(s && s.dan_isplate)}"></label>
          <label class="polje">Najmanja isplata (€)<input type="number" id="najm" min="0" step="0.01" inputmode="decimal" value="${v(s && s.najmanja_isplata)}"></label>
          <button class="mali glavni" type="submit" style="grid-column:1/-1;justify-self:start">Spremi rokove</button>
        </form>
        <p class="sitno">Iznos manji od najmanje isplate prenosi se u idući obračun.</p>
        <p class="poruka" id="porU" role="alert"></p>
      </section>
      <h2>Stanje po agentu</h2>
      ${d.length ? `<table><thead><tr><th>Agent</th><th>Kod</th><th>Razina</th><th class="br">U čekanju</th><th class="br">Za obračun</th><th class="br">Obračunato, neisplaćeno</th><th class="br">Isplaćeno</th><th>Zadnji obračun do</th><th></th></tr></thead><tbody>
        ${d.map((a) => `<tr data-id="${a.id}"><td><b>${esc(a.ime_prezime)}</b></td><td>${esc(a.kod)}</td>
          <td><select data-razina aria-label="Razina agenta ${esc(a.ime_prezime)}">${(raz || []).map((r) => `<option value="${r.redni}"${r.redni === a.razina ? ' selected' : ''}>${imeRazine(r.redni)}</option>`).join('')}</select></td>
          <td class="br">${eur(a.u_cekanju)}</td><td class="br"><b>${eur(a.za_obracun)}</b></td><td class="br">${eur(a.obracunato_neisplaceno)}</td><td class="br">${eur(a.isplaceno)}</td><td>${dan(a.zadnji_obracun_do)}</td>
          <td>${Number(a.za_obracun) > 0 ? '<button class="mali" data-a="obracun">Napravi obračun</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema odobrenih agenata.</p>'}
      <h2>Obračuni</h2>
      ${isp.length ? `<table><thead><tr><th>Agent</th><th>Razdoblje</th><th class="br">Iznos</th><th>Isplaćeno</th><th></th></tr></thead><tbody>
        ${isp.map((i) => `<tr data-isp="${i.id}"><td><b>${esc(i.ime_prezime)}</b> · ${esc(i.kod)}</td><td>${dan(i.obracun_od)} – ${dan(i.obracun_do)}</td><td class="br"><b>${eur(i.iznos_eur)}</b></td>
          <td>${i.isplaceno ? dan(i.isplaceno) : '<span class="oznakaS ceka">Čeka isplatu</span>'}</td>
          <td>${i.isplaceno ? '' : '<button class="mali glavni" data-a="isplati">Označi isplaćenim</button> <button class="mali" data-a="ponisti">Poništi obračun</button>'}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema obračuna.</p>'}
      <p class="poruka" id="porP" role="alert"></p>`;
    const porU = g.querySelector('#porU'); const porP = g.querySelector('#porP'); const porR = g.querySelector('#porR');
    const broj = (x) => { x = String(x).trim().replace(',', '.'); return x === '' ? null : Number(x); };
    g.querySelector('#spremiRazine').addEventListener('click', async (e) => {
      const b = e.currentTarget; const po = {};
      for (const inp of g.querySelectorAll('input[data-r]')) {
        const n = broj(inp.value); if (n !== null && !(n >= 0 && n < 100)) return (porR.textContent = 'Iznos mora biti broj od 0 naviše.');
        if (inp.dataset.k === 'po_bocici' && n === null) return (porR.textContent = 'Iznos po bočici mora biti upisan za svaku razinu.');
        (po[inp.dataset.r] = po[inp.dataset.r] || {})[inp.dataset.k] = n;
      }
      b.disabled = true;
      for (const r of Object.keys(po)) {
        const { error } = await sb.from('razine').update(Object.assign(po[r], { izmijenjeno: new Date().toISOString() })).eq('redni', Number(r));
        if (error) { b.disabled = false; porR.textContent = 'Iznosi nisu spremljeni.'; return; }
      }
      prikazi();
    });
    g.querySelector('#uvjeti').addEventListener('submit', async (e) => {
      e.preventDefault();
      const p = { dana_cekanja: broj(g.querySelector('#cek').value), dan_obracuna: broj(g.querySelector('#obr').value), dan_isplate: broj(g.querySelector('#dan').value), najmanja_isplata: broj(g.querySelector('#najm').value) };
      if (p.dana_cekanja !== null && !(Number.isInteger(p.dana_cekanja) && p.dana_cekanja >= 0 && p.dana_cekanja <= 120)) return (porU.textContent = 'Rok čekanja mora biti cijeli broj od 0 do 120.');
      for (const k of ['dan_obracuna', 'dan_isplate']) if (p[k] !== null && !(Number.isInteger(p[k]) && p[k] >= 1 && p[k] <= 28)) return (porU.textContent = 'Dan mora biti od 1 do 28.');
      if (p.najmanja_isplata !== null && !(p.najmanja_isplata >= 0)) return (porU.textContent = 'Najmanja isplata mora biti 0 ili više.');
      const b = e.submitter; b.disabled = true;
      const { error } = await sb.from('agent_postavke').update(Object.assign(p, { izmijenjeno: new Date().toISOString() })).eq('id', 1);
      b.disabled = false;
      if (error) { porU.textContent = 'Rokovi nisu spremljeni.'; return; }
      prikazi();
    });
    g.querySelectorAll('select[data-razina]').forEach((sel) => sel.addEventListener('change', async () => {
      const tr = sel.closest('tr'); const ime = tr.querySelector('b').textContent;
      sel.disabled = true;
      try { await rpc('mozon_postavi_razinu', { agent: tr.dataset.id, razina: Number(sel.value) }); porP.style.color = 'var(--tekst)'; porP.textContent = `${ime}: razina promijenjena od danas. Prodaje prije današnjeg dana ostaju po staroj razini.`; setTimeout(prikazi, 1800); }
      catch (er2) { sel.disabled = false; porP.textContent = 'Razina nije promijenjena.'; }
    }));
    g.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.a;
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = a === 'isplati' ? 'Potvrdi: isplaćeno danas' : a === 'ponisti' ? 'Potvrdi poništenje' : 'Potvrdi obračun'; return; }
      b.disabled = true;
      try {
        if (a === 'obracun') await rpc('mozon_obracunaj', { agent: b.closest('tr').dataset.id });
        else await rpc(a === 'isplati' ? 'mozon_isplati' : 'mozon_ponisti_obracun', { isplata: Number(b.closest('tr').dataset.isp) });
        prikazi();
      } catch (er3) {
        b.disabled = false; const m = er3.message || '';
        porP.textContent = /ispod najmanje/.test(m) ? 'Iznos je manji od najmanje isplate; prenosi se u idući obračun.' : /nema iznosa/.test(m) ? 'Nema iznosa za obračun.' : 'Radnja nije uspjela.';
      }
    }));
  }

  /* ---------- Pokretanje ---------- */
  async function start() {
    const { data } = await sb.auth.getSession();
    if (!data.session) return prijava();
    const u = await sb.auth.getUser();
    if (u.error || !u.data.user) { await sb.auth.signOut({ scope: 'local' }); return prijava(); }
    email = u.data.user.email;
    const { data: mz } = await sb.rpc('je_mozon');
    if (mz !== true) { await sb.auth.signOut({ scope: 'local' }); return prijava('Ova adresa nema pristup MOZON pregledu.'); }
    try { cekaBroj = (await rpc('mozon_prijave')).filter((p) => p.stanje === 'potpisano').length; } catch (e) {}
    prikazi();
  }
  start();
})();
