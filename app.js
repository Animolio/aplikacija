/* Animolio aplikacija — prva verzija: Animolio Klub (3.11.2026.) */
(function () {
  'use strict';
  const C = window.ANIMOLIO;
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const app = document.getElementById('app');

  // Kod iz QR-a (?kod=GROOM01) pamti se dok se kupac ne prijavi.
  try {
    const qk = new URLSearchParams(location.search).get('kod');
    if (qk) { localStorage.setItem('animolio_kod', qk.trim().toUpperCase()); history.replaceState(null, '', location.pathname); }
  } catch (e) { /* bez spremanja */ }
  const kodIzQr = () => { try { return localStorage.getItem('animolio_kod') || ''; } catch (e) { return ''; } };
  const zaboraviQr = () => { try { localStorage.removeItem('animolio_kod'); } catch (e) {} };

  const S = { email: '', korisnik: null, profil: null, ljubimci: [], cijene: {} };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const strelica = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  function vrh(natrag) {
    return `<div class="vrh">${natrag ? `<button class="natrag" data-natrag aria-label="Natrag">${strelica}</button>` : '<span class="prazno"></span>'}<span class="marka">ANIMOLIO</span><span class="prazno"></span></div>`;
  }
  function prikazi(html, onNatrag) {
    app.innerHTML = html;
    const n = app.querySelector('[data-natrag]');
    if (n && onNatrag) n.addEventListener('click', onNatrag);
    const f = app.querySelector('input'); if (f) f.focus({ preventScroll: true });
  }
  function zauzeto(gumb, da) { if (!gumb) return; gumb.disabled = da; app.classList.toggle('ucitavanje', da); }
  function greska(tekst) { const p = app.querySelector('.poruka'); if (p) p.textContent = tekst; }

  /* ---------- Prijava ---------- */
  function zaslonUlaz() {
    let partner = false; try { partner = !!localStorage.getItem('animolio_agent_kod'); } catch (e) {}
    prikazi(`${vrh(false)}
      <form class="sredina" id="f">
        <h1 class="veliki">${partner ? 'Prijava partnera' : 'Animolio Klub'}</h1>
        <p>${partner ? 'Upišite e-poštu. Na nju stiže kod za prijavu.' : 'Profil ljubimca, preporuka seruma i savjeti za njegu.'}</p>
        <label class="polje">E-pošta<input type="email" id="mail" autocomplete="email" inputmode="email" required value="${esc(S.email)}"></label>
        <p class="poruka" role="alert"></p>
        <button class="gumb" type="submit">Pošalji kod za prijavu</button>
        ${window.AnimolioAgent && !partner ? window.AnimolioAgent.vezaUlaz() : ''}
      </form>`);
    app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = e.submitter; const email = app.querySelector('#mail').value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return greska('Upišite ispravnu adresu e-pošte.');
      zauzeto(b, true);
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      zauzeto(b, false);
      if (error) return greska(error.status === 429 ? 'Previše pokušaja. Pričekajte nekoliko minuta pa pokušajte ponovno.' : 'Kod nije poslan. Pokušajte ponovno za minutu.');
      S.email = email; zaslonPotvrda();
    });
  }

  function zaslonPotvrda() {
    prikazi(`${vrh(true)}
      <h1>Kod iz e-pošte</h1>
      <p class="sitno">Poslan na ${esc(S.email)}. Ako ga ne vidite, pogledajte i neželjenu poštu.</p>
      <form id="f" style="display:flex;flex-direction:column;gap:14px;flex:1">
        <input type="text" id="kod" class="kod" inputmode="numeric" autocomplete="one-time-code" maxlength="10" aria-label="Kod iz e-pošte" required>
        <p class="poruka" role="alert"></p>
        <button class="veza" type="button" id="ponovno">Pošalji ponovno</button>
        <div class="dno"><button class="gumb" type="submit">Prijava</button></div>
      </form>`, zaslonUlaz);
    app.querySelector('#ponovno').addEventListener('click', async (e) => {
      zauzeto(e.target, true);
      const { error } = await sb.auth.signInWithOtp({ email: S.email, options: { shouldCreateUser: true } });
      zauzeto(e.target, false);
      greska(error ? 'Novi kod nije poslan. Pričekajte minutu.' : 'Novi kod je poslan.');
    });
    app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = e.submitter; const token = app.querySelector('#kod').value.replace(/\D/g, '');
      if (token.length < 6) return greska('Upišite cijeli kod iz poruke.');
      zauzeto(b, true);
      const { data, error } = await sb.auth.verifyOtp({ email: S.email, token, type: 'email' });
      zauzeto(b, false);
      if (error) return greska('Kod nije ispravan ili je istekao. Zatražite novi.');
      S.korisnik = data.user; await nakonPrijave();
    });
  }

  /* ---------- Nakon prijave ---------- */
  async function nakonPrijave() {
    if (window.AnimolioMozon && await window.AnimolioMozon.preuzmi(A)) return;
    if (window.AnimolioPartner && await window.AnimolioPartner.preuzmi(A)) return;
    if (window.AnimolioAgent && await window.AnimolioAgent.preuzmi(A)) return;
    let { data: p } = await sb.from('profili').select('id, uloga, kod_popusta').eq('id', S.korisnik.id).maybeSingle();
    if (!p) {
      const ins = await sb.from('profili').insert({ id: S.korisnik.id }).select('id, uloga, kod_popusta').single();
      p = ins.data;
      S.profil = p; S.prviPut = true;
    } else { S.profil = p; }
    const { data: lj } = await sb.from('ljubimci').select('id, ime, vrsta').order('id');
    S.ljubimci = lj || [];
    if (S.profil && !S.profil.kod_popusta && (S.prviPut || kodIzQr())) return zaslonPopust();
    if (S.prviPut && !S.ljubimci.length) return zaslonLjubimac();
    zaslonPocetna();
  }

  async function zaslonPopust() {
    const pocetni = kodIzQr();
    prikazi(`${vrh(false)}
      <h1>Kod za popust</h1>
      <form id="f" style="display:flex;flex-direction:column;gap:14px;flex:1">
        <label class="polje">S letka ili naljepnice<input type="text" id="kp" autocapitalize="characters" value="${esc(pocetni)}"></label>
        <div id="potvrda"></div>
        <p class="poruka" role="alert"></p>
        <div class="dno"><button class="gumb" type="submit">Uključi</button><button class="veza" type="button" id="nemam">Nemam kod</button></div>
      </form>`);
    const dalje = () => { zaboraviQr(); if (S.prviPut && !S.ljubimci.length) zaslonLjubimac(); else zaslonPocetna(); };
    app.querySelector('#nemam').addEventListener('click', dalje);
    app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = e.submitter; const k = app.querySelector('#kp').value.trim().toUpperCase();
      if (!k) return greska('Upišite kod ili odaberite „Nemam kod”.');
      zauzeto(b, true);
      const { data, error } = await sb.rpc('provjeri_kod', { k });
      if (error || !data || !data.length) { zauzeto(b, false); return greska('Taj kod ne postoji ili više ne vrijedi.'); }
      const up = await sb.from('profili').update({ kod_popusta: data[0].kod }).eq('id', S.korisnik.id);
      zauzeto(b, false);
      if (up.error) return greska('Kod nije spremljen. Pokušajte ponovno.');
      S.profil.kod_popusta = data[0].kod;
      const tko = data[0].naziv ? `Kod partnera ${esc(data[0].naziv)} je uključen.` : 'Kod je uključen.';
      app.querySelector('#potvrda').innerHTML = `<div class="okvir">✓ <span>${tko} Vidjet ćete ga opet na blagajni animolio.eu.</span></div>`;
      b.textContent = 'Dalje'; b.type = 'button'; b.onclick = dalje;
      app.querySelector('#nemam').remove();
    });
  }

  function zaslonLjubimac() {
    let vrsta = '';
    prikazi(`${vrh(false)}
      <h1>Vaš ljubimac</h1>
      <form id="f" style="display:flex;flex-direction:column;gap:16px;flex:1">
        <label class="polje">Ime<input type="text" id="ime" maxlength="40" autocomplete="off"></label>
        <div class="izbor" role="group" aria-label="Vrsta"><button type="button" data-v="pas" aria-pressed="false">Pas</button><button type="button" data-v="macka" aria-pressed="false">Mačka</button></div>
        <p class="sitno">Preporuke vrijede za pse i mačke.</p>
        <p class="poruka" role="alert"></p>
        <div class="dno"><button class="gumb" type="submit">Spremi</button><button class="veza" type="button" id="preskoci">Preskoči</button></div>
      </form>`);
    app.querySelectorAll('[data-v]').forEach((x) => x.addEventListener('click', () => {
      vrsta = x.dataset.v; app.querySelectorAll('[data-v]').forEach((y) => y.setAttribute('aria-pressed', String(y === x)));
    }));
    app.querySelector('#preskoci').addEventListener('click', zaslonPocetna);
    app.querySelector('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const b = e.submitter; const ime = app.querySelector('#ime').value.trim();
      if (!ime || !vrsta) return greska('Upišite ime i odaberite psa ili mačku.');
      zauzeto(b, true);
      const { data, error } = await sb.from('ljubimci').insert({ ime, vrsta }).select('id, ime, vrsta').single();
      zauzeto(b, false);
      if (error) return greska('Nije spremljeno. Pokušajte ponovno.');
      S.ljubimci.push(data); zaslonPocetna();
    });
  }

  /* ---------- Početna ---------- */
  const SERUMI = {
    SVEN: { opis: 'Za suhe i ispucane šape i njuškicu. Jedini s lavandom.' },
    MARCY: { opis: 'Za šape i njuškicu. Bez eteričnih ulja, najblaži od tri.' },
    FLUFFY: { opis: 'Za suhu kožu sklonu svrbežu i dlaku bez sjaja.', upozorenje: 'Sadrži eterično ulje čajevca. Nije za mačke.' }
  };
  function serumHtml(naziv) {
    const s = SERUMI[naziv]; const c = S.cijene[naziv];
    return `<div class="serum"><b>${naziv}${c ? ' · ' + esc(c) : ''}</b><span class="sitno">${s.opis}</span>${s.upozorenje ? `<span class="upozorenje">${s.upozorenje}</span>` : ''}<button class="gumb mali" data-kupi="${naziv}">Kupi na animolio.eu</button></div>`;
  }
  function preporuka() {
    const lj = S.ljubimci[0];
    if (!lj) return `<div class="kartica"><span class="oznaka">SERUMI</span>${serumHtml('SVEN')}${serumHtml('MARCY')}${serumHtml('FLUFFY')}</div>`;
    if (lj.vrsta === 'macka') {
      return `<div class="kartica"><span class="oznaka">PREPORUKA · ${esc(lj.ime.toUpperCase())}</span>${serumHtml('MARCY')}<span class="sitno">Za kožu i dlaku mačaka Animolio nema serum.</span></div>`;
    }
    return `<div class="kartica"><span class="oznaka">PREPORUKA · ${esc(lj.ime.toUpperCase())}</span>${serumHtml('SVEN')}${serumHtml('FLUFFY')}</div>`;
  }
  async function zaslonPocetna() {
    const lj = S.ljubimci[0];
    prikazi(`<div class="vrh"><span class="prazno"></span><span class="marka">ANIMOLIO KLUB</span><span class="prazno"></span></div>
      ${lj ? `<div class="kartica ljubimac"><div><div class="ime">${esc(lj.ime)}</div><span class="sitno">${lj.vrsta === 'pas' ? 'Pas' : 'Mačka'}</span></div></div>` : `<button class="gumb drugi" id="dodaj">Dodajte svog ljubimca</button>`}
      <div id="prep">${preporuka()}</div>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="veza" id="odjava">Odjava</button></div>`);
    const d = app.querySelector('#dodaj'); if (d) d.addEventListener('click', zaslonLjubimac);
    app.querySelector('#odjava').addEventListener('click', async () => { await sb.auth.signOut(); S.korisnik = null; S.profil = null; S.ljubimci = []; zaslonUlaz(); });
    app.querySelector('#prep').addEventListener('click', (e) => { const k = e.target.closest('[data-kupi]'); if (k) kupi(k.dataset.kupi, k); });
    if (!Object.keys(S.cijene).length) { await ucitajCijene(); app.querySelector('#prep').innerHTML = preporuka(); }
  }

  /* ---------- Wix: cijene i blagajna s kodom ---------- */
  const WIX = 'https://www.wixapis.com';
  async function wixToken() {
    const r = await fetch(WIX + '/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: C.wixClientId, grantType: 'anonymous' }) });
    if (!r.ok) throw new Error('token'); return (await r.json()).access_token;
  }
  async function wix(tok, metoda, put, tijelo) {
    const r = await fetch(WIX + put, { method: metoda, headers: { 'Content-Type': 'application/json', Authorization: tok }, body: tijelo ? JSON.stringify(tijelo) : undefined });
    const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch (e) {}
    if (!r.ok) { const er = new Error(put); er.status = r.status; throw er; } return j;
  }
  async function ucitajCijene() {
    try {
      const tok = await wixToken();
      const p = await wix(tok, 'POST', '/stores-reader/v1/products/query', { query: { paging: { limit: 20 } } });
      for (const [naziv, id] of Object.entries(C.proizvodi)) {
        const x = (p.products || []).find((y) => y.id === id);
        if (x && x.price && x.price.formatted) S.cijene[naziv] = x.price.formatted.price;
      }
    } catch (e) { /* bez cijena; kupnja i dalje radi */ }
  }
  async function kupi(naziv, gumb) {
    zauzeto(gumb, true); gumb.textContent = 'Otvaram blagajnu…';
    try {
      const tok = await wixToken();
      await wix(tok, 'POST', '/ecom/v1/carts/current/add-to-cart', { lineItems: [{ catalogReference: { appId: C.wixStoresAppId, catalogItemId: C.proizvodi[naziv] }, quantity: 1 }] });
      if (S.profil && S.profil.kod_popusta) {
        try { await wix(tok, 'PATCH', '/ecom/v1/carts/current', { couponCode: S.profil.kod_popusta }); } catch (e) { /* kod ne vrijedi: blagajna bez popusta */ }
      }
      const k = await wix(tok, 'POST', '/ecom/v1/carts/current/create-checkout', { channelType: 'WEB' });
      const r = await wix(tok, 'POST', '/redirect-session/v1/redirect-session', { ecomCheckout: { checkoutId: k.checkoutId }, callbacks: { postFlowUrl: C.povratak } });
      location.href = r.redirectSession.fullUrl;
    } catch (e) {
      zauzeto(gumb, false); gumb.textContent = 'Kupi na animolio.eu';
      greska('Blagajna se nije otvorila. Pokušajte ponovno ili kupite izravno na animolio.eu.');
    }
  }

  const A = { sb, S, app, prikazi, vrh, esc, greska, zauzeto, zaslonUlaz, zaslonPocetna };

  /* ---------- Pokretanje ---------- */
  (async function start() {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      const u = await sb.auth.getUser();
      if (u.error || !u.data.user) { await sb.auth.signOut({ scope: 'local' }); zaslonUlaz(); return; }
      S.korisnik = u.data.user; S.email = u.data.user.email; await nakonPrijave(); }
    else zaslonUlaz();
  })();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
