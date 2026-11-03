/* Animolio aplikacija — urednica savjeta tjedna (3.11.2026.)
   Claude upisuje prijedloge; urednica ih mijenja i odobrava. Kupci vide samo odobren savjet od početka njegova tjedna. */
(function () {
  'use strict';
  const datum = (d) => { const [g, m, dan] = d.split('-'); return `${Number(dan)}. ${Number(m)}. ${g}.`; };

  async function zaslon(A) {
    const { sb, app, prikazi, vrh, esc, greska, zauzeto } = A;
    const od = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await sb.from('savjeti').select('id, od, tekst, odobreno').gte('od', od).order('od');
    const lista = (data || []).map((s) => `<section class="kartica" data-id="${s.id}">
        <div class="red-oznaka"><span class="oznaka">TJEDAN OD ${esc(datum(s.od))}</span><span class="stanje ${s.odobreno ? 'da' : ''}">${s.odobreno ? 'Odobreno' : 'Čeka odobrenje'}</span></div>
        <textarea rows="5" maxlength="600" aria-label="Tekst savjeta za tjedan od ${esc(datum(s.od))}">${esc(s.tekst)}</textarea>
        <div class="red-gumbi"><button class="gumb naglaseni mali" type="button" data-radnja="odobri">${s.odobreno ? 'Spremi izmjene' : 'Spremi i odobri'}</button>${s.odobreno ? '<button class="veza" type="button" data-radnja="povuci">Povuci odobrenje</button>' : ''}</div>
      </section>`).join('');
    prikazi(`${vrh(false)}
      <h1>Savjeti tjedna</h1>
      <p class="sitno">Ovdje su prijedlozi savjeta za iduće tjedne. Tekst možete izmijeniti. Kupci u aplikaciji vide samo odobren savjet, od ponedjeljka njegova tjedna.</p>
      ${error ? '' : (lista || '<div class="okvir">Trenutno nema prijedloga za pregled.</div>')}
      <p class="poruka" role="alert">${error ? 'Savjeti se nisu učitali. Pokušajte ponovno.' : ''}</p>
      <div class="dno"><button class="veza" type="button" id="odjava">Odjava</button></div>`);
    app.querySelector('#odjava').addEventListener('click', A.odjava);
    app.querySelectorAll('[data-radnja]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.closest('[data-id]'); const tekst = k.querySelector('textarea').value.trim();
      const odobri = b.dataset.radnja === 'odobri';
      if (odobri && tekst.length < 20) return greska('Savjet je prekratak.');
      zauzeto(b, true);
      const { error: e } = await sb.from('savjeti').update(odobri ? { tekst, odobreno: true } : { odobreno: false }).eq('id', Number(k.dataset.id));
      zauzeto(b, false);
      if (e) return greska('Nije spremljeno. Pokušajte ponovno.');
      zaslon(A);
    }));
  }

  window.AnimolioUrednica = {
    async preuzmi(A) {
      const { data } = await A.sb.rpc('je_urednik');
      if (data !== true) return false;
      await zaslon(A); return true;
    }
  };
})();
