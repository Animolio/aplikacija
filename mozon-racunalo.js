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
  const SEKCIJE = [['prijave', 'Prijave agenata'], ['agenti', 'Agenti'], ['partneri', 'Partneri'], ['kodovi', 'Kodovi za popust'], ['prodaje', 'Prodaje po kodu'], ['provizija', 'Provizija i razine'], ['zahtjevi', 'Zahtjevi za isplatu'], ['ppartneri', 'Provizija partnera'], ['veleprodaja', 'Veleprodaja'], ['uzorci', 'Uzorci'], ['obavijesti', 'Obavijesti i ankete'], ['klub', 'Klub']];
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
  async function prikazi() { okvir(); const g = m.querySelector('#g'); g.innerHTML = '<p class="sitno">Učitavam…</p>'; try { await ({ prijave, agenti, partneri, kodovi, prodaje, provizija, zahtjevi, ppartneri, veleprodaja, uzorci, obavijesti, klub })[aktivna](g); } catch (e) { g.innerHTML = '<p class="poruka">Podaci se nisu učitali. Osvježite stranicu.</p>'; } }
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

  // Dobrodošlica partneru: letak (uvijek) i ugovor (ako je potpisan u aplikaciji) kao PDF u privitku e-pošte
  const H2P = 'https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js';
  let h2pOb = null;
  const ucitajH2p = () => h2pOb || (h2pOb = new Promise((da, ne) => {
    if (!document.getElementById('fontLetak')) { const l = document.createElement('link'); l.id = 'fontLetak'; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;600;700&display=swap'; document.head.appendChild(l); }
    const s = document.createElement('script'); s.src = H2P; s.integrity = 'sha384-Yv5O+t3uE3hunW8uyrbpPW3iw6/5/Y7HitWJBLgqfMoA36NogMmy+8wWZMpn3HWc'; s.crossOrigin = 'anonymous';
    s.onload = () => da(window.html2pdf); s.onerror = () => { h2pOb = null; ne(new Error('pdf')); }; document.head.appendChild(s);
  }));
  async function uPdf(css, sadrzaj) {
    const h2p = await ucitajH2p();
    const okv = document.createElement('div'); okv.style.cssText = 'position:fixed;left:-10000px;top:0';
    okv.innerHTML = `<style>${css}</style>${sadrzaj}`; document.body.appendChild(okv);
    try {
      await Promise.all(Array.from(okv.querySelectorAll('img')).map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
      if (document.fonts) { await document.fonts.load('600 38pt Fraunces').catch(() => {}); await document.fonts.load('400 12pt Inter').catch(() => {}); await document.fonts.ready; }
      const uri = await h2p().set({ margin: 0, image: { type: 'jpeg', quality: 0.92 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'avoid-all'] } })
        .from(okv.lastElementChild).outputPdf('datauristring');
      return uri.slice(uri.indexOf(',') + 1);
    } finally { okv.remove(); }
  }
  function letakDijelovi(o) {
    const h = window.AnimolioLetak.html(o);
    const css = h.match(/<style>([\s\S]*?)<\/style>/)[1].replace(/@page\{[^}]*\}/, '').replace(/(^|\})\s*([^{}@]+)\{/g, (m, a, sel) => a + sel.split(',').map((x) => {
      x = x.trim(); if (x === 'html' || x === 'body') return '.letakA4'; if (x === '*') return '.letakA4,.letakA4 *'; return '.letakA4 ' + x;
    }).join(',') + '{');
    // QR kao slika (SVG se u PDF-u ne iscrtava ispravno)
    const q = window.qrcode(0, 'M'); q.addData(o.link); q.make();
    const tijelo = h.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<svg[\s\S]*?<\/svg>/, `<img src="${q.createDataURL(10, 0)}" alt="">`);
    return [css + '.letakA4{height:296.5mm!important}.letakA4 .kod .q img{width:100%;height:100%;display:block;image-rendering:pixelated}.letakA4 .dno{display:block}.letakA4 .dno span{display:inline}.letakA4 .dno span:first-child{float:left}.letakA4 .dno span:last-child{float:right}', `<div class="letakA4">${tijelo}</div>`];
  }
  const vrijeme = (t) => `${dan(t)} ${new Date(t).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}`;
  function ugovorDijelovi(u) {
    const U = window.AnimolioUgovorPartner;
    const css = '.ugA4{width:210mm;padding:16mm 20mm;background:#fff;color:#3A2A21;font-family:Arial,sans-serif;font-size:10.5pt;line-height:1.45}.ugA4 b,.ugA4 span{display:block}.ugA4 span{margin:1.5mm 0}.ugA4 b{margin-top:4mm}.ugA4 .pot{display:flex;gap:12mm;margin-top:8mm}.ugA4 .pot div{flex:1}.ugA4 img{height:26mm;max-width:70mm;object-fit:contain}.ugA4 .s{font-size:8pt;color:#8A7666;margin-top:6mm;word-break:break-all}';
    return [css, `<div class="ugA4">${U.html(u)}
      <div class="pot"><div><b>Za Suradnika</b><span>${esc(u.potpisnik || '')}</span>${u.potpis ? `<img src="${esc(u.potpis)}" alt="">` : ''}<span>${u.potpisano ? 'Potpisano u aplikaciji ' + vrijeme(u.potpisano) : ''}</span></div>
      <div><b>Za Naručitelja</b><span>${esc(u.mozon_potpisao || '')}</span><span>${u.mozon_potpisano ? 'Potpisano ' + vrijeme(u.mozon_potpisano) : ''}</span></div></div>
      <p class="s">Verzija ${esc(u.ugovor_verzija || '')} · SHA-256 ${esc(u.ugovor_hash || '')}</p></div>`];
  }
  async function posaljiDobrodoslicu(id, kod) {
    const [u] = await rpc('mozon_partner_ugovor', { partner: id });
    const letak = await uPdf(...letakDijelovi({ kod, naziv: u.naziv, link: adresaApp() + '?kod=' + encodeURIComponent(kod), baza: adresaApp() }));
    const ugovor = u.potpisano ? await uPdf(...ugovorDijelovi(u)) : null;
    await rpc('mozon_posta_partner', { partner: id, ugovor_pdf: ugovor, letak_pdf: letak });
    return ugovor ? 'ugovor i letak' : 'letak';
  }

  async function partneri(g) {
    const [d, { data: po }] = await Promise.all([rpc('mozon_partneri'), sb.from('agent_postavke').select('partner_ugovor_u_aplikaciji').eq('id', 1).maybeSingle()]);
    const ST = { prijava: 'Čeka odobrenje', odobren: 'Aktivan', raskinut: 'Raskinut' };
    g.innerHTML = naslov('Partneri', 'Odbijanjem se podaci prijave brišu. Raskidom kod prelazi pod Animolio: kupci zadržavaju popust, a agent više ne vidi kod.') + `
      <label class="kvacica" style="margin:0 0 14px"><input type="checkbox" id="ugApp" ${po && po.partner_ugovor_u_aplikaciji ? 'checked' : ''}> Partner potpisuje ugovor u aplikaciji, pri prijavi</label>
      <p class="poruka" id="porUg" role="alert"></p>` + (d.length ? `<table><thead><tr><th>Naziv</th><th>OIB</th><th>Adresa</th><th>E-pošta</th><th>Agent</th><th>Kod</th><th>Ugovor</th><th>Isplata</th><th>Pravila</th><th>Stanje</th><th></th></tr></thead><tbody>
      ${d.map((p) => `<tr data-id="${p.id}"><td><b>${esc(p.naziv)}</b><br><span class="sitno">${datum(p.stvoreno)}</span></td><td>${esc(p.oib)}</td><td>${esc(p.adresa)}</td><td>${esc(p.email)}</td>
        <td>${p.agent ? esc(p.agent) + ' · ' + esc(p.agent_kod) : '<span class="sitno">bez agenta</span>'}</td><td><b>${esc(p.kod || '')}</b></td>
        <td>${p.potpisano ? `${datum(p.potpisano)}<br><button class="mali" data-a="ugovor">Pogledaj</button>` : p.ugovor_potpisan ? `Papir · ${dan(p.ugovor_potpisan)}<br><button class="mali" data-a="papirx">Poništi</button>` : p.stanje === 'odobren' ? '<span class="sitno">Bez ugovora</span><br><button class="mali" data-a="papir">Ugovor potpisan</button>' : ''}</td>
        <td>${p.isplata === 'drugi' ? `Drugi dohodak${p.porez_posto !== null && p.porez_posto !== undefined ? ` · porez ${String(p.porez_posto).replace('.', ',')} %` : ''}${p.iban ? '' : '<br><span class="sitno">bez IBAN-a</span>'}` : 'Račun'}<br><button class="mali" data-a="isplata">Promijeni</button></td>
        <td>${p.pravila_procitana ? 'Potvrđeno ' + datum(p.pravila_procitana) : ''}</td>
        <td><span class="oznakaS ${p.stanje === 'prijava' ? 'ceka' : ''}">${ST[p.stanje] || ''}</span></td>
        <td>${p.stanje === 'prijava' ? `<button class="mali glavni" data-a="odobri">${p.potpisano ? 'Potpiši i odobri' : 'Odobri'}</button> <button class="mali" data-a="odbij">Odbij</button>` : (p.stanje === 'odobren' ? `<button class="mali" data-a="dobro" data-kod="${esc(p.kod || '')}">${p.potpisano ? 'Pošalji ugovor i letak' : 'Pošalji letak'}</button> <button class="mali" data-a="raskid">Raskid suradnje</button>` : '')}</td></tr>`).join('')}</tbody></table><p class="poruka" id="porPa" role="alert"></p><div id="ugovorPregled"></div>` : '<p class="sitno">Još nema prijava partnera.</p>');
    g.querySelector('#ugApp').addEventListener('change', async (e) => {
      const cb = e.currentTarget; cb.disabled = true;
      const { error } = await sb.from('agent_postavke').update({ partner_ugovor_u_aplikaciji: cb.checked, izmijenjeno: new Date().toISOString() }).eq('id', 1);
      cb.disabled = false; const pu = g.querySelector('#porUg');
      if (error) { cb.checked = !cb.checked; pu.style.color = ''; pu.textContent = 'Nije spremljeno.'; } else { pu.style.color = 'var(--tekst)'; pu.textContent = 'Spremljeno.'; }
    });
    const tb = g.querySelector('tbody'); if (!tb) return;
    tb.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return; const id = b.closest('tr').dataset.id; const por = g.querySelector('#porPa');
      if (b.dataset.a === 'ugovor') {
        const [u] = await rpc('mozon_partner_ugovor', { partner: id }); const U = window.AnimolioUgovorPartner; const el = g.querySelector('#ugovorPregled');
        if (!u || !U) return;
        const isti = u.ugovor_verzija === U.VERZIJA && (await U.sazetak(u)) === u.ugovor_hash;
        el.innerHTML = `<section class="plocica" style="gap:8px;max-width:760px;margin-top:16px"><span class="oznaka">UGOVOR · ${esc(u.naziv)}</span>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:14px;line-height:1.5">${U.html(u).split('<b style="').join('<b style="font-size:14px;font-family:inherit;font-weight:700;line-height:1.4;')}</div>
          <p><span style="font-weight:700">Za Suradnika:</span> ${esc(u.potpisnik || '')} · ${dan(u.potpisano)} ${new Date(u.potpisano).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })} · verzija ${esc(u.ugovor_verzija || '')}</p>
          <p><span style="font-weight:700">Za Naručitelja:</span> ${u.mozon_potpisano ? `${esc(u.mozon_potpisao || '')} · ${dan(u.mozon_potpisano)} ${new Date(u.mozon_potpisano).toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit' })}` : 'potpisuje se klikom „Potpiši i odobri”'}</p>
          ${u.potpis ? `<img src="${esc(u.potpis)}" alt="Potpis" style="height:110px;max-width:360px;object-fit:contain;background:#fff;border:1px solid #E8DFD3;border-radius:10px">` : ''}
          <p class="sitno">${isti ? 'Tekst odgovara potpisanom ugovoru.' : 'Tekst se ne podudara s potpisanom verzijom: provjerite verziju ugovora.'}</p></section>`;
        el.scrollIntoView({ behavior: 'smooth' }); return;
      }
      if (b.dataset.a === 'isplata') {
        const p = d.find((x) => x.id === id); const el = g.querySelector('#ugovorPregled'); if (!p) return;
        el.innerHTML = `<section class="plocica" style="gap:12px;max-width:560px;margin-top:16px"><span class="oznaka">ISPLATA · ${esc(p.naziv)}</span>
          <form id="isF" style="display:flex;flex-direction:column;gap:12px">
            <label class="polje">Način isplate<select id="isN"><option value="racun"${p.isplata !== 'drugi' ? ' selected' : ''}>Račun (tvrtka ili obrt)</option><option value="drugi"${p.isplata === 'drugi' ? ' selected' : ''}>Drugi dohodak (bez obrta)</option></select></label>
            <label class="polje">Porez na dohodak prema prebivalištu (%)<input type="number" id="isP" min="0" max="60" step="0.1" inputmode="decimal" value="${p.porez_posto ?? ''}"></label>
            <label class="polje">IBAN<input type="text" id="isI" maxlength="34" value="${esc(p.iban || '')}"></label>
            <button class="mali glavni" type="submit" style="align-self:flex-start">Spremi</button>
          </form><p class="poruka" id="porIs" role="alert"></p></section>`;
        el.querySelector('#isF').addEventListener('submit', async (ev) => {
          ev.preventDefault(); const pi = el.querySelector('#porIs');
          const nacin = el.querySelector('#isN').value; const pz = el.querySelector('#isP').value.trim().replace(',', '.'); const ib = el.querySelector('#isI').value.replace(/\s/g, '').toUpperCase();
          if (nacin === 'drugi' && pz !== '' && !(Number(pz) >= 0 && Number(pz) <= 60)) { pi.textContent = 'Stopa poreza mora biti od 0 do 60.'; return; }
          if (nacin === 'drugi' && ib && !/^HR\d{19}$/.test(ib)) { pi.textContent = 'IBAN nije ispravan.'; return; }
          const sb2 = ev.submitter; sb2.disabled = true;
          try { await rpc('mozon_partner_isplata', { partner: id, nacin, porez: nacin === 'drugi' && pz !== '' ? Number(pz) : null, racun_iban: ib || null }); prikazi(); }
          catch (er) { sb2.disabled = false; pi.textContent = 'Nije spremljeno.'; }
        });
        el.scrollIntoView({ behavior: 'smooth' }); return;
      }
      if (b.dataset.a === 'papir' || b.dataset.a === 'papirx') {
        if (b.textContent !== 'Potvrdi') { b.textContent = 'Potvrdi'; return; }
        b.disabled = true;
        const dd = new Date(); const danas = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
        try { await rpc('mozon_ugovor_potpisan', { partner: id, datum: b.dataset.a === 'papir' ? danas : null }); prikazi(); }
        catch (er) { b.disabled = false; por.style.color = ''; por.textContent = 'Nije spremljeno.'; }
        return;
      }
      if (b.dataset.a === 'odbij' && b.textContent !== 'Potvrdi brisanje') { b.textContent = 'Potvrdi brisanje'; return; }
      if (b.dataset.a === 'raskid' && b.textContent !== 'Potvrdi raskid') { b.textContent = 'Potvrdi raskid'; return; }
      b.disabled = true;
      try {
        if (b.dataset.a === 'odobri') {
          const k = await rpc('mozon_odobri_partnera', { partner: id }); por.style.color = 'var(--tekst)'; por.textContent = `Odobreno. Kod partnera: ${k}.`;
          try { const sto = await posaljiDobrodoslicu(id, k); por.textContent = `Odobreno. Kod partnera: ${k}. Poslano e-poštom: ${sto}.`; }
          catch (er) { por.style.color = ''; por.textContent = `Odobreno. Kod partnera: ${k}. E-pošta nije poslana.`; }
          setTimeout(prikazi, 3000);
        } else if (b.dataset.a === 'dobro') {
          const sto = await posaljiDobrodoslicu(id, b.dataset.kod); b.disabled = false; por.style.color = 'var(--tekst)'; por.textContent = `Poslano e-poštom: ${sto}.`;
        }
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

  /* ---------- Provizija i razine (3.11.2026.) — fiksni iznos po razini, bodovi, automatske razine ---------- */
  const dan = (d) => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
  const broj = (x) => { x = String(x).trim().replace(',', '.'); return x === '' ? null : Number(x); };
  const otvoriDatoteku = async (put, por) => {
    const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from('agenti').createSignedUrl(put, 300);
    if (error || !data) { if (w) w.close(); por.textContent = 'Datoteka se ne može otvoriti.'; return; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  };
  async function provizija(g) {
    const POLJA = 'dana_cekanja, dan_obracuna, dan_isplate, najmanja_isplata, dana_izmedu_racuna, veleprodaja_po_bocici, bod_bocica, bod_veleprodaja, bod_novi_partner, bod_aktivni_partner, razdoblje_mjeseci, doprinosi_iz_posto, porez_posto, zdravstveno_na_posto';
    const [{ data: s, error: es }, { data: raz, error: er }, d, isp] = await Promise.all([
      sb.from('agent_postavke').select(POLJA).eq('id', 1).maybeSingle(),
      sb.from('razine').select('redni, naziv, po_bocici, po_trilogy, prag_ulaz, prag_odrzavanje').order('redni'),
      rpc('mozon_provizija'), rpc('mozon_isplate')]);
    if (es || er) throw (es || er);
    const v = (x) => x === null || x === undefined ? '' : esc(x);
    const pol = (r, k, korak) => `<input type="number" data-r="${r.redni}" data-k="${k}" min="0" step="${korak}" inputmode="decimal" value="${r[k] === null || r[k] === undefined ? '' : (korak === '0.01' ? Number(r[k]).toFixed(2) : Number(r[k]))}" aria-label="${esc(r.naziv)} ${k}">`;
    const imeRazine = (n) => { const r = (raz || []).find((x) => x.redni === n); return r ? `${n} · ${esc(r.naziv)}` : String(n); };
    const p = (id, lab, k, korak) => `<label class="polje">${lab}<input type="number" id="${id}" data-p="${k}" min="0" step="${korak}" inputmode="decimal" value="${v(s && s[k])}"></label>`;
    const OBRT = { potvrdeno: 'Potvrđen', poslano: 'Čeka potvrdu', nema: '—' };
    g.innerHTML = naslov('Provizija i razine', 'Provizija je fiksan iznos po bočici, prema razini na dan prodaje. Razine određuju bodovi, provjera je 1. u mjesecu. Agent vidi samo svoju proviziju, bočice i bodove.') + `
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">RAZINE I IZNOSI</span>
        <table><thead><tr><th>Razina</th><th class="br">Po bočici, bruto (€)</th><th class="br">TRILOGY po paketu, bruto (€)</th><th class="br">Bodova za ulaz</th><th class="br">Bodova za održavanje</th></tr></thead><tbody>
          ${(raz || []).map((r) => `<tr><td><span style="font-weight:700">${imeRazine(r.redni)}</span></td><td class="br">${pol(r, 'po_bocici', '0.01')}</td><td class="br">${pol(r, 'po_trilogy', '0.01')}</td>
            <td class="br">${r.redni >= 3 ? pol(r, 'prag_ulaz', '1') : (r.redni === 2 ? '<span class="sitno">obrt</span>' : '')}</td><td class="br">${r.redni >= 3 ? pol(r, 'prag_odrzavanje', '1') : ''}</td></tr>`).join('')}
        </tbody></table>
        <button class="mali glavni" type="button" id="spremiRazine" style="align-self:flex-start">Spremi razine</button>
        <p class="poruka" id="porR" role="alert"></p>
      </section>
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">BODOVI, VELEPRODAJA I ROKOVI</span>
        <form id="uvjeti" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:end">
          ${p('b1', 'Bodova po bočici (kod)', 'bod_bocica', '0.1')}${p('b2', 'Bodova po bočici (veleprodaja)', 'bod_veleprodaja', '0.1')}${p('b3', 'Bodova za novog partnera', 'bod_novi_partner', '1')}${p('b4', 'Bodova mjesečno po aktivnom partneru', 'bod_aktivni_partner', '1')}
          ${p('b5', 'Razdoblje bodova (mjeseci)', 'razdoblje_mjeseci', '1')}${p('v1', 'Veleprodaja po bočici (€)', 'veleprodaja_po_bocici', '0.01')}${p('c1', 'Rok čekanja (dana)', 'dana_cekanja', '1')}${p('c2', 'Najmanja isplata (€)', 'najmanja_isplata', '0.01')}
          ${p('c3', 'Početak: obračun do (dan)', 'dan_obracuna', '1')}${p('c4', 'Početak: isplata do (dan)', 'dan_isplate', '1')}${p('c5', 'Obrt: dana između računa', 'dana_izmedu_racuna', '1')}
          ${p('d1', 'Bez obrta: doprinosi iz bruta (%)', 'doprinosi_iz_posto', '0.1')}${p('d2', 'Bez obrta: porez na dohodak (%)', 'porez_posto', '0.1')}${p('d3', 'Bez obrta: zdravstveno na bruto (%)', 'zdravstveno_na_posto', '0.1')}
          <button class="mali glavni" type="submit" style="grid-column:1/-1;justify-self:start">Spremi</button>
        </form>
        <p class="sitno">Novi partner donosi bodove nakon svoje druge narudžbe. Iznos manji od najmanje isplate prenosi se dalje.</p>
        <p class="poruka" id="porU" role="alert"></p>
      </section>
      <h2>Stanje po agentu</h2>
      ${d.length ? `<table><thead><tr><th>Agent</th><th>Razina</th><th class="br">Bodovi</th><th>Obrt</th><th class="br">U čekanju</th><th class="br">Za isplatu</th><th class="br">Račun čeka</th><th class="br">Isplaćeno</th><th></th></tr></thead><tbody>
        ${d.map((a) => `<tr data-id="${a.id}"><td><b>${esc(a.ime_prezime)}</b> · ${esc(a.kod)}</td><td>${imeRazine(a.razina)}</td><td class="br">${Number(a.bodovi).toLocaleString('hr-HR')}</td>
          <td>${OBRT[a.obrt] || '—'}${a.obrt === 'poslano' && a.obrt_dokument ? `<br><button class="mali" data-a="obrt-vidi" data-put="${esc(a.obrt_dokument)}">Pogledaj rješenje</button> <button class="mali glavni" data-a="obrt-da">Potvrdi</button> <button class="mali" data-a="obrt-ne">Vrati</button>` : ''}</td>
          <td class="br">${eur(a.u_cekanju)}</td><td class="br"><b>${eur(a.za_obracun)}</b></td><td class="br">${eur(a.racun_ceka)}</td><td class="br">${eur(a.isplaceno)}</td>
          <td>${a.obrt !== 'potvrdeno' && Number(a.za_obracun) > 0 ? '<button class="mali" data-a="obracun">Mjesečni obračun</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema odobrenih agenata.</p>'}
      <h2>Obračuni i isplate</h2>
      ${isp.length ? `<table><thead><tr><th>Agent</th><th>Razdoblje</th><th class="br">Bruto</th><th class="br">Neto (na račun agenta)</th><th>Isplaćeno</th><th></th></tr></thead><tbody>
        ${isp.map((i) => `<tr data-isp="${i.id}"><td><b>${esc(i.ime_prezime)}</b> · ${esc(i.kod)}</td><td>${dan(i.obracun_od)} – ${dan(i.obracun_do)}</td><td class="br">${eur(i.iznos_eur)}</td><td class="br"><b>${eur(i.neto_eur)}</b>${i.vrsta === 'obrt' ? '<br><span class="sitno">račun obrta</span>' : ''}</td>
          <td>${i.isplaceno ? dan(i.isplaceno) : '<span class="oznakaS ceka">Čeka isplatu</span>'}</td>
          <td>${i.isplaceno ? '' : '<button class="mali glavni" data-a="isplati">Označi isplaćenim</button> <button class="mali" data-a="ponisti">Poništi obračun</button>'}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema obračuna.</p>'}
      <p class="sitno">Agent u aplikaciji vidi samo neto.</p>
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">IZVOZ ZA KNJIGOVODSTVO</span>
        <p class="sitno">Tablica za knjigovođu: isplate agentima i partnerima u odabranom mjesecu i svi obračuni i računi koji još čekaju isplatu. Vrsta, ime ili naziv, OIB, IBAN, razdoblje, bruto, neto, datum isplate i stanje.</p>
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap">
          <label class="polje">Mjesec isplate<input type="month" id="izvozMj" value="${new Date().toISOString().slice(0, 7)}"></label>
          <button class="mali glavni" type="button" id="izvoz">Preuzmi tablicu</button>
        </div>
        <p class="poruka" id="porI" role="alert"></p>
      </section>
      <p class="poruka" id="porP" role="alert"></p>`;
    const porU = g.querySelector('#porU'); const porP = g.querySelector('#porP'); const porR = g.querySelector('#porR');
    g.querySelector('#izvoz').addEventListener('click', async (e) => {
      const porI = g.querySelector('#porI'); const mj = g.querySelector('#izvozMj').value;
      if (!/^\d{4}-\d{2}$/.test(mj)) { porI.textContent = 'Odaberite mjesec.'; return; }
      const b = e.currentTarget; b.disabled = true; porI.textContent = '';
      try {
        const red = await rpc('mozon_izvoz_isplata', { mjesec: mj + '-01' });
        const pol = (x) => { const s = x === null || x === undefined ? '' : String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const dt = (x) => { if (!x) return ''; const [y, m2, d2] = String(x).slice(0, 10).split('-'); return `${Number(d2)}.${Number(m2)}.${y}.`; };
        const zag = ['Vrsta', 'Ime / naziv', 'OIB', 'IBAN', 'Kod', 'Razdoblje od', 'Razdoblje do', 'Bruto (EUR)', 'Neto (EUR)', 'Isplaćeno', 'Stanje'];
        const linije = [zag.join(';')].concat(red.map((r) => [r.vrsta, r.ime_naziv, r.oib ? `="${r.oib}"` : '', r.iban, r.kod, dt(r.razdoblje_od), dt(r.razdoblje_do), Number(r.bruto_eur).toFixed(2).replace('.', ','), Number(r.neto_eur).toFixed(2).replace('.', ','), dt(r.isplaceno), r.stanje].map(pol).join(';')));
        const blob = new Blob(['\ufeff' + linije.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `animolio_isplate_${mj}.csv`;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        porI.style.color = 'var(--tekst)'; porI.textContent = red.length ? `Preuzeto. Broj redaka: ${red.length}.` : 'Preuzeto. Za taj mjesec nema isplata ni otvorenih obračuna.';
      } catch (er) { porI.style.color = ''; porI.textContent = 'Tablica se nije preuzela.'; }
      b.disabled = false;
    });
    g.querySelector('#spremiRazine').addEventListener('click', async (e) => {
      const b = e.currentTarget; const po = {};
      for (const inp of g.querySelectorAll('input[data-r]')) {
        const n = broj(inp.value); if (n !== null && !(n >= 0)) return (porR.textContent = 'Upišite broj od 0 naviše.');
        if (inp.dataset.k === 'po_bocici' && n === null) return (porR.textContent = 'Iznos po bočici mora biti upisan za svaku razinu.');
        (po[inp.dataset.r] = po[inp.dataset.r] || {})[inp.dataset.k] = n;
      }
      b.disabled = true;
      for (const r of Object.keys(po)) {
        const { error } = await sb.from('razine').update(Object.assign(po[r], { izmijenjeno: new Date().toISOString() })).eq('redni', Number(r));
        if (error) { b.disabled = false; porR.textContent = 'Razine nisu spremljene.'; return; }
      }
      prikazi();
    });
    g.querySelector('#uvjeti').addEventListener('submit', async (e) => {
      e.preventDefault(); const pr = {};
      for (const inp of g.querySelectorAll('input[data-p]')) { const n = broj(inp.value); if (n !== null && !(n >= 0)) return (porU.textContent = 'Upišite broj od 0 naviše.'); pr[inp.dataset.p] = n; }
      for (const k of ['dan_obracuna', 'dan_isplate']) if (pr[k] !== null && !(Number.isInteger(pr[k]) && pr[k] >= 1 && pr[k] <= 28)) return (porU.textContent = 'Dan u mjesecu mora biti od 1 do 28.');
      for (const k of ['bod_bocica', 'bod_veleprodaja', 'bod_novi_partner', 'bod_aktivni_partner', 'razdoblje_mjeseci', 'veleprodaja_po_bocici', 'dana_izmedu_racuna', 'doprinosi_iz_posto', 'porez_posto', 'zdravstveno_na_posto']) if (pr[k] === null) return (porU.textContent = 'Sva polja bodova, veleprodaje, razmaka računa i stopa moraju biti upisana.');
      const b = e.submitter; b.disabled = true;
      const { error } = await sb.from('agent_postavke').update(Object.assign(pr, { izmijenjeno: new Date().toISOString() })).eq('id', 1);
      b.disabled = false;
      if (error) { porU.textContent = 'Nije spremljeno. Provjerite brojeve.'; return; }
      prikazi();
    });
    g.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.a; const tr = b.closest('tr');
      if (a === 'obrt-vidi') return otvoriDatoteku(b.dataset.put, porP);
      if (a === 'obrt-ne' && !b.dataset.potvrda) {
        b.dataset.potvrda = '1'; b.insertAdjacentHTML('beforebegin', '<input type="text" class="razlog" maxlength="200" aria-label="Razlog vraćanja rješenja"> '); b.textContent = 'Potvrdi vraćanje'; return;
      }
      if (a !== 'obrt-ne' && !b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = { isplati: 'Potvrdi: isplaćeno danas', ponisti: 'Potvrdi poništenje', obracun: 'Potvrdi obračun', 'obrt-da': 'Potvrdi obrt' }[a]; return; }
      b.disabled = true;
      try {
        if (a === 'obracun') await rpc('mozon_obracunaj', { agent: tr.dataset.id });
        else if (a === 'obrt-da') await rpc('mozon_obrt', { agent: tr.dataset.id, potvrdi: true });
        else if (a === 'obrt-ne') await rpc('mozon_obrt', { agent: tr.dataset.id, potvrdi: false, napomena: (tr.querySelector('.razlog') || {}).value || '' });
        else await rpc(a === 'isplati' ? 'mozon_isplati' : 'mozon_ponisti_obracun', { isplata: Number(tr.dataset.isp) });
        prikazi();
      } catch (er3) {
        b.disabled = false; const m = er3.message || '';
        porP.textContent = /ispod najmanje/.test(m) ? 'Iznos je manji od najmanje isplate; prenosi se dalje.' : /nema iznosa/.test(m) ? 'Nema iznosa za obračun.' : /salje racun/.test(m) ? 'Agent s obrtom sam šalje račun.' : 'Radnja nije uspjela.';
      }
    }));
  }

  /* ---------- Zahtjevi za isplatu (agenti s obrtom) ---------- */
  async function zahtjevi(g) {
    const d = await rpc('mozon_zahtjevi');
    const ST = { poslano: '<span class="oznakaS ceka">Čeka isplatu</span>', isplaceno: 'Isplaćeno', vraceno: 'Vraćeno' };
    g.innerHTML = naslov('Zahtjevi za isplatu', 'Agent s obrtom šalje račun za saldo kad želi, najranije tjedan dana nakon prethodne isplate. Platite račun u banci, zatim kliknite „Isplaćeno”.') +
      (d.length ? `<table><thead><tr><th>Agent</th><th class="br">Bruto</th><th>Prodaje do</th><th>Poslano</th><th>Stanje</th><th></th></tr></thead><tbody>
        ${d.map((q) => `<tr data-id="${q.id}"><td><b>${esc(q.ime_prezime)}</b> · ${esc(q.kod)}</td><td class="br"><b>${eur(q.iznos_eur)}</b></td><td>${dan(q.do_datuma)}</td><td>${datum(q.poslano)}</td>
          <td>${ST[q.stanje] || ''}${q.stanje === 'vraceno' && q.razlog ? `<br><span class="sitno">${esc(q.razlog)}</span>` : ''}</td>
          <td><button class="mali" data-a="vidi" data-put="${esc(q.racun)}">Pogledaj račun</button>${q.stanje === 'poslano' ? ' <button class="mali glavni" data-a="isplati">Isplaćeno</button> <button class="mali" data-a="vrati">Vrati</button>' : ''}</td></tr>`).join('')}</tbody></table>`
        : '<p class="sitno">Još nema zahtjeva.</p>') + '<p class="poruka" id="porZ" role="alert"></p>';
    const por = g.querySelector('#porZ');
    g.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.a; const tr = b.closest('tr');
      if (a === 'vidi') return otvoriDatoteku(b.dataset.put, por);
      if (!b.dataset.potvrda) {
        b.dataset.potvrda = '1';
        if (a === 'vrati') { b.insertAdjacentHTML('beforebegin', '<input type="text" class="razlog" maxlength="200" aria-label="Razlog vraćanja računa"> '); b.textContent = 'Potvrdi vraćanje'; }
        else b.textContent = 'Potvrdi: isplaćeno danas';
        return;
      }
      b.disabled = true;
      try { await rpc('mozon_zahtjev', { zahtjev: Number(tr.dataset.id), isplati: a === 'isplati', razlog_vracanja: (tr.querySelector('.razlog') || {}).value || null }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Radnja nije uspjela.'; }
    }));
  }

  /* ---------- Provizija partnera (neto, bez PDV-a; mjesečni obračun, plaćanje po računu partnera) ---------- */
  async function ppartneri(g) {
    const [{ data: s, error: es }, d, isp] = await Promise.all([
      sb.from('agent_postavke').select('partner_po_bocici, partner_po_trilogy').eq('id', 1).maybeSingle(),
      rpc('mozon_partner_provizija'), rpc('mozon_partner_isplate')]);
    if (es) throw es;
    const v = (x) => x === null || x === undefined ? '' : Number(x).toFixed(2);
    g.innerHTML = naslov('Provizija partnera', 'Partner zarađuje po bočici prodanoj s njegovim kodom. Iznosi su bez PDV-a i to je ono što partner vidi u aplikaciji. Obračun jednom mjesečno; partner u aplikaciji šalje račun, vi ga platite u banci i kliknete „Isplaćeno”. Partner bez obrta (drugi dohodak) ne šalje račun: platite neto iznos i kliknite „Isplaćeno”.') + `
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">IZNOSI</span>
        <form id="pu" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end">
          <label class="polje">Po bočici (€)<input type="number" id="pb" min="0" step="0.01" inputmode="decimal" value="${v(s && s.partner_po_bocici)}"></label>
          <label class="polje">TRILOGY po paketu (€)<input type="number" id="pt" min="0" step="0.01" inputmode="decimal" value="${v(s && s.partner_po_trilogy)}"></label>
          <button class="mali glavni" type="submit" style="justify-self:start">Spremi</button>
        </form>
        <p class="sitno">Promjena vrijedi i za prodaje koje još nisu obračunate.</p>
        <p class="poruka" id="porPU" role="alert"></p>
      </section>
      <h2>Stanje po partneru</h2>
      ${d.length ? `<table><thead><tr><th>Partner</th><th>Agent</th><th class="br">U čekanju</th><th class="br">Za obračun</th><th class="br">Obračunato, neisplaćeno</th><th class="br">Isplaćeno</th><th></th></tr></thead><tbody>
        ${d.map((x) => `<tr data-id="${x.id}"><td><b>${esc(x.naziv)}</b> · ${esc(x.kod)}</td><td>${esc(x.agent || '')}</td><td class="br">${eur(x.u_cekanju)}</td><td class="br"><b>${eur(x.za_obracun)}</b></td>
          <td class="br">${eur(x.obracunato_neisplaceno)}</td><td class="br">${eur(x.isplaceno)}</td><td>${!x.ugovor ? '<span class="sitno">Bez ugovora</span>' : Number(x.za_obracun) > 0 ? '<button class="mali" data-a="obracun">Mjesečni obračun</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema odobrenih partnera s kodom.</p>'}
      <h2>Obračuni i isplate</h2>
      ${isp.length ? `<table><thead><tr><th>Partner</th><th>Razdoblje</th><th class="br">Iznos</th><th>Račun</th><th>Isplaćeno</th><th></th></tr></thead><tbody>
        ${isp.map((i) => `<tr data-isp="${i.id}"><td><b>${esc(i.naziv)}</b> · ${esc(i.kod)}</td><td>${dan(i.obracun_od)} – ${dan(i.obracun_do)}</td><td class="br"><b>${eur(i.iznos_eur)}</b></td>
          <td>${i.racun ? `<button class="mali" data-a="vidi" data-put="${esc(i.racun)}">Pogledaj račun</button>` : i.drugi ? `Drugi dohodak · neto <b>${eur(i.neto_eur)}</b>` : '<span class="oznakaS ceka">Čeka račun</span>'}</td>
          <td>${i.isplaceno ? dan(i.isplaceno) : ''}</td>
          <td>${i.isplaceno ? '' : (i.racun || i.drugi ? '<button class="mali glavni" data-a="isplati">Isplaćeno</button>' : '') + (i.isplaceno || i.racun ? '' : ' <button class="mali" data-a="ponisti">Poništi obračun</button>')}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema obračuna.</p>'}
      <p class="poruka" id="porPP" role="alert"></p>`;
    const por = g.querySelector('#porPP'); const porU = g.querySelector('#porPU');
    g.querySelector('#pu').addEventListener('submit', async (e) => {
      e.preventDefault();
      const pb = broj(g.querySelector('#pb').value); const pt = broj(g.querySelector('#pt').value);
      if (!(pb >= 0) || !(pt >= 0) || pb === null || pt === null) { porU.textContent = 'Upišite oba iznosa, od 0 naviše.'; return; }
      const b = e.submitter; b.disabled = true;
      const { error } = await sb.from('agent_postavke').update({ partner_po_bocici: pb, partner_po_trilogy: pt, izmijenjeno: new Date().toISOString() }).eq('id', 1);
      b.disabled = false;
      if (error) { porU.textContent = 'Nije spremljeno.'; return; }
      prikazi();
    });
    g.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      const a = b.dataset.a; const tr = b.closest('tr');
      if (a === 'vidi') return otvoriDatoteku(b.dataset.put, por);
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = { obracun: 'Potvrdi obračun', isplati: 'Potvrdi: isplaćeno danas', ponisti: 'Potvrdi poništenje' }[a]; return; }
      b.disabled = true;
      try {
        if (a === 'obracun') await rpc('mozon_partner_obracunaj', { partner: tr.dataset.id });
        else await rpc(a === 'isplati' ? 'mozon_partner_isplati' : 'mozon_partner_ponisti', { isplata: Number(tr.dataset.isp) });
        prikazi();
      } catch (er) { b.disabled = false; por.textContent = /nema iznosa/.test(er.message || '') ? 'Nema iznosa za obračun.' : 'Radnja nije uspjela.'; }
    }));
  }

  /* ---------- Uzorci (zapisnik o predanim uzorcima za knjigovođu) ---------- */
  async function uzorci(g) {
    const sad = new Date(); const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    const od0 = g.dataset.od || iso(new Date(sad.getFullYear(), sad.getMonth(), 1)); const do0 = g.dataset.do || iso(sad);
    const d = await rpc('mozon_uzorci', { od_: od0, do_: do0 });
    const st = (u) => [['SVEN', u.sven], ['MARCY', u.marcy], ['FLUFFY', u.fluffy], ['TRILOGY', u.trilogy]].filter((x) => x[1] > 0).map((x) => `${x[0]} ${x[1]}`).join(' · ');
    g.innerHTML = naslov('Uzorci', 'Agent upisuje predane uzorke u svojoj aplikaciji, partner potvrđuje primitak u svojoj. Tablica je zapisnik za knjigovođu.') + `
      <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:14px">
        <label class="polje">Od<input type="date" id="uod" value="${od0}"></label><label class="polje">Do<input type="date" id="udo" value="${do0}"></label>
        <button class="mali" type="button" id="uPrikazi">Prikaži</button><button class="mali glavni" type="button" id="uIzvoz">Preuzmi tablicu</button></div>
      ${d.length ? `<table><thead><tr><th>Predano</th><th>Partner</th><th>OIB</th><th>Adresa</th><th>Predao</th><th>Uzorci</th><th>Primitak potvrđen</th></tr></thead><tbody>
        ${d.map((u) => `<tr><td>${datum(u.predano)}</td><td><b>${esc(u.partner)}</b></td><td>${esc(u.oib)}</td><td>${esc(u.adresa)}</td><td>${esc(u.predao)}</td><td>${st(u)}</td><td>${u.potvrdeno ? datum(u.potvrdeno) : '<span class="oznakaS ceka">Čeka</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">U tom razdoblju nema predanih uzoraka.</p>'}
      <p class="poruka" id="porUz" role="alert"></p>`;
    g.querySelector('#uPrikazi').addEventListener('click', () => { g.dataset.od = g.querySelector('#uod').value; g.dataset.do = g.querySelector('#udo').value; uzorci(g).catch(() => {}); });
    g.querySelector('#uIzvoz').addEventListener('click', () => {
      const pol = (x) => { const s = x === null || x === undefined ? '' : String(x); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
      const dt = (x) => x ? new Date(x).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
      const zag = ['Predano', 'Partner', 'OIB', 'Adresa', 'Predao', 'SVEN', 'MARCY', 'FLUFFY', 'TRILOGY', 'Primitak potvrđen'];
      const linije = [zag.join(';')].concat(d.map((u) => [dt(u.predano), u.partner, u.oib ? `="${u.oib}"` : '', u.adresa, u.predao, u.sven, u.marcy, u.fluffy, u.trilogy, dt(u.potvrdeno)].map(pol).join(';')));
      const blob = new Blob(['\ufeff' + linije.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `animolio_uzorci_${od0}_${do0}.csv`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    });
  }

  /* ---------- Veleprodaja (izravna kupnja partnera od MOZON-a) ---------- */
  async function veleprodaja(g) {
    const [pa, d] = await Promise.all([rpc('mozon_partneri'), rpc('mozon_veleprodaja')]);
    const aktivni = pa.filter((x) => x.stanje === 'odobren');
    const danas = new Date(); const iso = `${danas.getFullYear()}-${String(danas.getMonth() + 1).padStart(2, '0')}-${String(danas.getDate()).padStart(2, '0')}`;
    g.innerHTML = naslov('Veleprodaja', 'Upišite svaku izravnu kupnju partnera od MOZON-a. Agent partnera dobiva proviziju po bočici iz veleprodaje i bodove; TRILOGY se broji kao tri bočice. Upis se može obrisati 7 dana.') + `
      <section class="plocica" style="gap:12px;max-width:860px">
        <form id="vf" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:12px;align-items:end">
          <label class="polje">Partner<select id="vp">${aktivni.map((x) => `<option value="${x.id}">${esc(x.naziv)}${x.agent ? ' · ' + esc(x.agent) : ''}</option>`).join('')}</select></label>
          <label class="polje">Serum<select id="vs"><option>SVEN</option><option>MARCY</option><option>FLUFFY</option><option>TRILOGY</option></select></label>
          <label class="polje">Komada<input type="number" id="vk" min="1" max="10000" step="1" inputmode="numeric"></label>
          <label class="polje">Datum<input type="date" id="vd" value="${iso}" max="${iso}"></label>
          <button class="mali glavni" type="submit" style="grid-column:1/-1;justify-self:start"${aktivni.length ? '' : ' disabled'}>Upiši</button>
        </form>
        ${aktivni.length ? '' : '<p class="sitno">Još nema odobrenih partnera.</p>'}
        <p class="poruka" id="porV" role="alert"></p>
      </section>
      ${d.length ? `<table><thead><tr><th>Datum</th><th>Partner</th><th>Agent</th><th>Serum</th><th class="br">Komada</th><th></th></tr></thead><tbody>
        ${d.map((x) => `<tr data-id="${x.id}"><td>${dan(x.datum)}</td><td><b>${esc(x.partner)}</b></td><td>${esc(x.agent || '—')}</td><td>${esc(x.proizvod)}</td><td class="br">${x.kolicina}</td>
          <td>${x.moze_brisati ? '<button class="mali" data-a="brisi">Obriši</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema upisa.</p>'}`;
    const por = g.querySelector('#porV');
    g.querySelector('#vf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const k = Number(g.querySelector('#vk').value); const dd = g.querySelector('#vd').value;
      if (!Number.isInteger(k) || k < 1) return (por.textContent = 'Upišite broj komada.');
      if (!dd) return (por.textContent = 'Upišite datum.');
      const b = e.submitter; b.disabled = true;
      try { await rpc('mozon_veleprodaja_dodaj', { partner: g.querySelector('#vp').value, dan: dd, serum: g.querySelector('#vs').value, komada: k }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Upis nije uspio.'; }
    });
    g.querySelectorAll('[data-a="brisi"]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = 'Potvrdi brisanje'; return; }
      b.disabled = true;
      try { await rpc('mozon_veleprodaja_brisi', { stavka: Number(b.closest('tr').dataset.id) }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Brisanje nije uspjelo.'; }
    }));
  }

  /* ---------- Obavijesti i ankete (4.11.2026.) — jednosmjerno, bez poruka natrag ---------- */
  const KOMU = [['klub', 'Klub'], ['partner', 'Partneri'], ['agent', 'Agenti']];
  const komuIme = (z) => (Array.isArray(z) ? z : [z]).map((x) => (KOMU.find((k) => k[0] === x) || [x, x])[1]).join(', ');
  async function obavijesti(g) {
    const [ob, an] = await Promise.all([rpc('mozon_obavijesti'), rpc('mozon_ankete')]);
    const danas = new Date(); const iso = `${danas.getFullYear()}-${String(danas.getMonth() + 1).padStart(2, '0')}-${String(danas.getDate()).padStart(2, '0')}`;
    const kvacice = (pre) => KOMU.map(([k, n]) => `<label class="kvacica"><input type="checkbox" name="${pre}" value="${k}"> ${n}</label>`).join('');
    g.innerHTML = naslov('Obavijesti i ankete', 'Jednosmjerno: korisnici vide obavijest u aplikaciji, a na anketu odgovaraju samo ponuđenim odgovorima. Rezultati ankete prikazuju se samo zbirno. Odobreni blog članci sami se pojavljuju kao obavijest na dan objave.') + `
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">NOVA OBAVIJEST</span>
        <form id="of" style="display:flex;flex-direction:column;gap:12px">
          <div class="red-kvacica"><span class="sitno">Komu:</span>${kvacice('ok')}</div>
          <label class="polje">Naslov<input type="text" id="on" maxlength="80"></label>
          <label class="polje">Tekst<textarea id="ot" rows="4" maxlength="600"></textarea></label>
          <label class="polje">Poveznica (nije obavezno, mora počinjati s https://)<input type="url" id="op" maxlength="300"></label>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
            <label class="polje">Vidljivo od<input type="date" id="ood" value="${iso}"></label>
            <label class="polje">Vidljivo do (nije obavezno)<input type="date" id="odo"></label>
          </div>
          <label class="kvacica"><input type="checkbox" id="okl"> Ključna obavijest: partner i agent moraju potvrditi da su je pročitali (Klubu ide kao obična)</label>
          <button class="mali glavni" type="submit" style="align-self:flex-start">Objavi obavijest</button>
        </form>
        <p class="poruka" id="porO" role="alert"></p>
      </section>
      <section class="plocica" style="gap:12px;max-width:860px">
        <span class="oznaka">NOVA ANKETA</span>
        <form id="af" style="display:flex;flex-direction:column;gap:12px">
          <div class="red-kvacica"><span class="sitno">Komu:</span>${kvacice('ak')}</div>
          <label class="polje">Pitanje<input type="text" id="ap" maxlength="300"></label>
          <label class="polje">Ponuđeni odgovori, svaki u svom retku (2 do 8)<textarea id="ao" rows="5"></textarea></label>
          <label class="kvacica"><input type="checkbox" id="av"> Može se odabrati više odgovora</label>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
            <label class="polje">Otvorena od<input type="date" id="aod" value="${iso}"></label>
            <label class="polje">Otvorena do (nije obavezno)<input type="date" id="ado"></label>
          </div>
          <button class="mali glavni" type="submit" style="align-self:flex-start">Objavi anketu</button>
        </form>
        <p class="poruka" id="porA" role="alert"></p>
      </section>
      <h2>Ankete</h2>
      ${an.length ? an.map((a) => { const uk = Number(a.odgovora) || 0; return `<section class="plocica" data-anketa="${a.id}" style="gap:8px;max-width:860px">
        <div class="red-oznaka"><span class="oznaka">${esc(komuIme(a.za))} · OD ${dan(a.od)}${a.vrijedi_do ? ' DO ' + dan(a.vrijedi_do) : ''}</span><span class="oznakaS${a.aktivna ? ' ceka' : ''}">${a.aktivna ? 'Otvorena' : 'Zatvorena'}</span></div>
        <b style="font-family:inherit;font-size:16px">${esc(a.pitanje)}</b><span class="sitno">Odgovora: ${uk}</span>
        ${(a.opcije || []).map((o, i) => { const c = Number((a.po_opciji || [])[i] || 0); const pct = uk ? Math.round(c / uk * 100) : 0; return `<div class="rez"><span>${esc(o)}</span><span class="rez-traka"><span style="width:${pct}%"></span></span><span class="br">${c} (${pct} %)</span></div>`; }).join('')}
        ${a.aktivna ? '<button class="mali" data-a="zatvori-anketu" style="align-self:flex-start">Zatvori anketu</button>' : ''}
      </section>`; }).join('') : '<p class="sitno">Još nema anketa.</p>'}
      <h2>Obavijesti</h2>
      ${ob.length ? `<table><thead><tr><th>Od</th><th>Komu</th><th>Naslov</th><th class="br">Potvrdilo / zatvorilo</th><th>Stanje</th><th></th></tr></thead><tbody>
        ${ob.map((o) => `<tr data-ob="${o.id}"><td>${dan(o.od)}</td><td>${esc(komuIme(o.za))}</td><td><b>${esc(o.naslov)}</b>${o.kljucna ? ' <span class="oznakaS">ključna</span>' : ''}<br><span class="sitno">${esc(o.tekst)}</span></td>
          <td class="br">${o.potvrdilo}</td><td>${o.aktivna ? 'Vidljiva' + (o.vrijedi_do ? ' do ' + dan(o.vrijedi_do) : '') : 'Završena'}</td>
          <td>${o.aktivna ? '<button class="mali" data-a="zavrsi-obavijest">Završi</button>' : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="sitno">Još nema obavijesti.</p>'}
      <p class="poruka" id="porL" role="alert"></p>`;
    const odabrano = (pre) => [...g.querySelectorAll(`input[name="${pre}"]:checked`)].map((x) => x.value);
    g.querySelector('#of').addEventListener('submit', async (e) => {
      e.preventDefault(); const por = g.querySelector('#porO');
      const komu = odabrano('ok'); const na = g.querySelector('#on').value.trim(); const te = g.querySelector('#ot').value.trim(); const po = g.querySelector('#op').value.trim();
      if (!komu.length) return (por.textContent = 'Odaberite komu ide obavijest.');
      if (na.length < 3) return (por.textContent = 'Upišite naslov.');
      if (te.length < 10) return (por.textContent = 'Upišite tekst obavijesti.');
      if (po && !/^https:\/\//.test(po)) return (por.textContent = 'Poveznica mora počinjati s https://');
      const b = e.submitter;
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = `Potvrdi objavu: ${komuIme(komu)}`; return; }
      b.disabled = true;
      try { await rpc('mozon_obavijest_dodaj', { komu, naslov_: na, tekst_: te, poveznica_: po || null, kljucna_: g.querySelector('#okl').checked, od_: g.querySelector('#ood').value || null, do_: g.querySelector('#odo').value || null }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Obavijest nije objavljena.'; }
    });
    g.querySelector('#af').addEventListener('submit', async (e) => {
      e.preventDefault(); const por = g.querySelector('#porA');
      const komu = odabrano('ak'); const pi = g.querySelector('#ap').value.trim();
      const opc = g.querySelector('#ao').value.split('\n').map((x) => x.trim()).filter(Boolean);
      if (!komu.length) return (por.textContent = 'Odaberite komu ide anketa.');
      if (pi.length < 5) return (por.textContent = 'Upišite pitanje.');
      if (opc.length < 2 || opc.length > 8) return (por.textContent = 'Upišite od 2 do 8 odgovora, svaki u svom retku.');
      if (opc.some((x) => x.length > 120)) return (por.textContent = 'Odgovor može imati najviše 120 znakova.');
      const b = e.submitter;
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = `Potvrdi anketu: ${komuIme(komu)}`; return; }
      b.disabled = true;
      try { await rpc('mozon_anketa_dodaj', { komu, pitanje_: pi, opcije_: opc, vise_: g.querySelector('#av').checked, od_: g.querySelector('#aod').value || null, do_: g.querySelector('#ado').value || null }); prikazi(); }
      catch (er) { b.disabled = false; por.textContent = 'Anketa nije objavljena.'; }
    });
    g.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
      if (!b.dataset.potvrda) { b.dataset.potvrda = '1'; b.textContent = 'Potvrdi'; return; }
      b.disabled = true;
      try {
        if (b.dataset.a === 'zatvori-anketu') await rpc('mozon_anketa_zavrsi', { anketa: Number(b.closest('[data-anketa]').dataset.anketa) });
        else await rpc('mozon_obavijest_zavrsi', { obavijest: Number(b.closest('tr').dataset.ob) });
        prikazi();
      } catch (er) { b.disabled = false; g.querySelector('#porL').textContent = 'Radnja nije uspjela.'; }
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
