/* Animolio aplikacija — urednica: blog objave i savjeti tjedna (3.11.2026.)
   Claude upisuje prijedloge; urednica ih mijenja i odobrava. Kupci vide samo odobren savjet od početka njegova tjedna. */
(function () {
  'use strict';
  const datum = (d) => { const [g, m, dan] = d.split('-'); return `${Number(dan)}. ${Number(m)}. ${g}.`; };
  const kratko = (d) => { const [, m, dan] = d.split('-'); return `${Number(dan)}. ${Number(m)}.`; };

  async function zaslon(A) {
    const { sb, app, prikazi, vrh, esc, greska, zauzeto } = A;
    const od = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const [s1, s2] = await Promise.all([
      sb.from('blog_objave').select('id, objava, pregled_do, naslov, uvod, tekst, opis, napomena, odobreno').gte('objava', od).order('objava'),
      sb.from('savjeti').select('id, od, tekst, odobreno').gte('od', od).order('od')
    ]);
    const stanje = (o) => `<span class="stanje ${o ? 'da' : ''}">${o ? 'Odobreno' : 'Čeka odobrenje'}</span>`;
    const gumbi = (o) => `<div class="red-gumbi"><button class="gumb naglaseni mali" type="button" data-radnja="odobri">${o ? 'Spremi izmjene' : 'Spremi i odobri'}</button>${o ? '<button class="veza" type="button" data-radnja="povuci">Povuci odobrenje</button>' : ''}</div>`;
    const blog = (s1.data || []).map((b) => `<details class="kartica blog" data-tablica="blog_objave" data-id="${b.id}">
        <summary><div class="red-oznaka"><span class="oznaka">OBJAVA ${esc(datum(b.objava))} · PREGLED DO ${esc(kratko(b.pregled_do))}</span>${stanje(b.odobreno)}</div><span class="naslov-sazetak">${esc(b.naslov)}</span></summary>
        <label class="polje">Naslov<input type="text" data-polje="naslov" maxlength="120" value="${esc(b.naslov)}"></label>
        <label class="polje">Uvod<textarea data-polje="uvod" rows="3">${esc(b.uvod)}</textarea></label>
        <label class="polje">Tekst<textarea data-polje="tekst" rows="18">${esc(b.tekst)}</textarea></label>
        <label class="polje">Opis za tražilice<textarea data-polje="opis" rows="2" maxlength="200">${esc(b.opis)}</textarea></label>
        ${b.napomena ? `<p class="sitno"><b>Napomena:</b> ${esc(b.napomena)}</p>` : ''}
        ${gumbi(b.odobreno)}
      </details>`).join('');
    const savjeti = (s2.data || []).map((s) => `<section class="kartica" data-tablica="savjeti" data-id="${s.id}">
        <div class="red-oznaka"><span class="oznaka">TJEDAN OD ${esc(datum(s.od))}</span>${stanje(s.odobreno)}</div>
        <textarea data-polje="tekst" rows="5" maxlength="600" aria-label="Tekst savjeta za tjedan od ${esc(datum(s.od))}">${esc(s.tekst)}</textarea>
        ${gumbi(s.odobreno)}
      </section>`).join('');
    const prazno = '<div class="okvir">Trenutno nema prijedloga za pregled.</div>';
    const greskaUcitavanja = s1.error || s2.error;
    prikazi(`${vrh(false)}
      <h1>Na pregledu</h1>
      <p class="sitno">Prijedloge piše Claude. Tekst možete izmijeniti i odobriti. Blog objava treba biti odobrena do datuma pregleda; savjet tjedna kupci vide od ponedjeljka svog tjedna.</p>
      <h2>Blog objave</h2>
      ${blog || prazno}
      <h2>Savjeti tjedna</h2>
      ${savjeti || prazno}
      <p class="poruka" role="alert">${greskaUcitavanja ? 'Dio prijedloga se nije učitao. Pokušajte ponovno.' : ''}</p>
      <div class="dno"><button class="veza" type="button" id="odjava">Odjava</button></div>`);
    app.querySelector('#odjava').addEventListener('click', A.odjava);
    app.querySelectorAll('[data-radnja]').forEach((b) => b.addEventListener('click', async () => {
      const k = b.closest('[data-id]'); const odobri = b.dataset.radnja === 'odobri';
      const promjena = {};
      k.querySelectorAll('[data-polje]').forEach((p) => { promjena[p.dataset.polje] = p.value.trim(); });
      if (odobri && (promjena.tekst || '').length < 20) return greska('Tekst je prekratak.');
      if (odobri && k.dataset.tablica === 'blog_objave' && !promjena.naslov) return greska('Upišite naslov.');
      zauzeto(b, true);
      const { error: e } = await sb.from(k.dataset.tablica).update(odobri ? Object.assign(promjena, { odobreno: true }) : { odobreno: false }).eq('id', Number(k.dataset.id));
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
