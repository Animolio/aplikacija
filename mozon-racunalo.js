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
  const SEKCIJE = [['prijave', 'Prijave agenata'], ['agenti', 'Agenti'], ['partneri', 'Partneri'], ['kodovi', 'Kodovi za popust'], ['prodaje', 'Prodaje po kodu'], ['klub', 'Klub']];
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
  async function prikazi() { okvir(); const g = m.querySelector('#g'); g.innerHTML = '<p class="sitno">Učitavam…</p>'; try { await ({ prijave, agenti, partneri, kodovi, prodaje, klub })[aktivna](g); } catch (e) { g.innerHTML = '<p class="poruka">Podaci se nisu učitali. Osvježite stranicu.</p>'; } }
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
    g.innerHTML = naslov('Partneri', 'Odbijanjem se podaci prijave brišu. Raskidom se kod partnera gasi u aplikaciji; gašenje u Wixu dodaje se s n8n tokom.') + (d.length ? `<table><thead><tr><th>Naziv</th><th>OIB</th><th>Adresa</th><th>E-pošta</th><th>Agent</th><th>Kod</th><th>Pravila</th><th>Stanje</th><th></th></tr></thead><tbody>
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

  async function kodovi(g) {
    const d = await rpc('mozon_kodovi');
    g.innerHTML = naslov('Kodovi za popust', 'Narudžbe se broje od 2.11.2026., kad je n8n počeo upisivati prodaje po kodu. Gašenje koda u Wixu dodaje se s n8n tokom.') + `<table><thead><tr><th>Kod</th><th>Vrsta</th><th>Naziv</th><th>Aktivan</th><th class="br">Narudžbi</th><th class="br">Iznos</th><th class="br">Popust</th><th>Zadnja</th></tr></thead><tbody>
      ${d.map((k) => `<tr><td><b>${esc(k.kod)}</b></td><td>${esc(k.vrsta)}</td><td>${esc(k.naziv)}</td><td>${k.aktivan ? 'Da' : 'Ne'}</td><td class="br">${k.narudzbi}</td><td class="br">${eur(k.iznos_eur)}</td><td class="br">${eur(k.popust_eur)}</td><td>${datum(k.zadnja)}</td></tr>`).join('')}</tbody></table>`;
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
