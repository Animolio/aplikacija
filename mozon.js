/* Animolio aplikacija — MOZON pregled: prijave agenata (3.11.2026.) */
(function () {
  'use strict';
  const STANJE = { prijava: 'Nije potpisao', potpisano: 'Čeka odobrenje', odobren: 'Odobren', odbijen: 'Odbijen', raskinut: 'Raskinut' };
  const datum = (d) => d ? new Date(d).toLocaleString('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const MZ = { lista: [] };

  MZ.preuzmi = async function (A) {
    const { data, error } = await A.sb.rpc('je_mozon');
    if (error || data !== true) return false;
    MZ.A = A; await popis(); return true;
  };

  const vrh = (A, natrag) => A.vrh(natrag).replace('>ANIMOLIO<', '>ANIMOLIO · MOZON<');

  async function popis() {
    const A = MZ.A;
    A.prikazi(`${vrh(A, false)}<h1>Prijave agenata</h1><div id="lista" class="sitno">Učitavam…</div>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="gumb drugi" id="osvjezi">Osvježi</button><button class="veza" id="odjava">Odjava</button></div>`);
    A.app.querySelector('#osvjezi').addEventListener('click', popis);
    A.app.querySelector('#odjava').addEventListener('click', async () => { await A.sb.auth.signOut(); location.reload(); });
    const { data, error } = await A.sb.rpc('mozon_prijave');
    const l = A.app.querySelector('#lista');
    if (error) { l.textContent = ''; return A.greska('Prijave se nisu učitale. Pokušajte ponovno.'); }
    MZ.lista = data || [];
    if (!MZ.lista.length) { l.textContent = 'Nema prijava.'; return; }
    l.className = ''; l.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    l.innerHTML = MZ.lista.map((p, i) => `<button class="kartica" data-i="${i}" style="text-align:left;cursor:pointer;font:inherit;color:inherit;${p.stanje === 'potpisano' ? 'border:2px solid var(--tekst)' : ''}">
        <b style="font-size:17px">${A.esc(p.ime_prezime)}</b>
        <span class="sitno">${STANJE[p.stanje] || A.esc(p.stanje)}${p.kod ? ' · ' + A.esc(p.kod) : ''} · ${datum(p.potpisano || p.stvoreno)}</span>
      </button>`).join('');
    l.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) detalj(MZ.lista[Number(b.dataset.i)]); });
  }

  function red(naziv, vrijednost) { return `<div style="display:flex;flex-direction:column;gap:2px"><span class="oznaka">${naziv}</span><span style="font-size:16px;word-break:break-all">${vrijednost}</span></div>`; }

  function detalj(p) {
    const A = MZ.A;
    const moze = p.stanje === 'potpisano';
    A.prikazi(`${vrh(A, true)}
      <h1 style="font-size:26px">${A.esc(p.ime_prezime)}</h1>
      <div class="kartica">
        ${red('STANJE', STANJE[p.stanje] || A.esc(p.stanje))}
        ${red('E-POŠTA', A.esc(p.email))}
        ${red('OIB', A.esc(p.oib))}
        ${red('IBAN', A.esc(p.iban))}
        ${p.potpisano ? red('POTPISANO', datum(p.potpisano) + (p.ugovor_verzija ? ' · ugovor ' + A.esc(p.ugovor_verzija) : '')) : ''}
        ${p.kod ? red('KOD', A.esc(p.kod)) : ''}
        ${p.potpis && /^data:image\/png;base64,/.test(p.potpis) ? `<div style="display:flex;flex-direction:column;gap:4px"><span class="oznaka">POTPIS</span><img src="${p.potpis}" alt="Potpis" style="width:100%;max-height:150px;object-fit:contain;border:1px solid var(--rub);border-radius:12px;background:#fff"></div>` : ''}
      </div>
      <p class="poruka" role="alert"></p>
      <div class="dno">${moze ? '<button class="gumb" id="odobri">Odobri</button><button class="veza" id="odbij">Odbij i obriši podatke</button>' : ''}</div>`, popis);
    if (!moze) return;
    let potvrdaOdbij = false;
    A.app.querySelector('#odobri').addEventListener('click', async (e) => {
      A.zauzeto(e.target, true);
      const { data, error } = await A.sb.rpc('mozon_odobri', { agent: p.id });
      A.zauzeto(e.target, false);
      if (error) return A.greska('Odobrenje nije uspjelo. Pokušajte ponovno.');
      p.stanje = 'odobren'; p.kod = data; detalj(p);
      const por = A.app.querySelector('.poruka'); por.textContent = `Odobreno. Kod agenta: ${data}.`; por.style.color = 'var(--tekst)';
    });
    A.app.querySelector('#odbij').addEventListener('click', async (e) => {
      if (!potvrdaOdbij) { potvrdaOdbij = true; e.target.textContent = 'Dodirnite ponovno za brisanje prijave'; return; }
      A.zauzeto(e.target, true);
      const { error } = await A.sb.rpc('mozon_odbij', { agent: p.id });
      A.zauzeto(e.target, false);
      if (error) return A.greska('Brisanje nije uspjelo. Pokušajte ponovno.');
      popis();
    });
  }

  window.AnimolioMozon = MZ;
})();
