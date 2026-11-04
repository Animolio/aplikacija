/* Animolio aplikacija — „Novo": jednosmjerne obavijesti, ankete i blog (4.11.2026.)
   Isti blok za Klub, partnera i agenta. Nema slobodnog teksta ni poruka natrag: ankete imaju samo ponuđene odgovore. */
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dat = (d) => { const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return `${x.getDate()}. ${x.getMonth() + 1}.`; };
  const PROCITANO = 'animolio_blog_procitano';
  const procitano = () => { try { return JSON.parse(localStorage.getItem(PROCITANO) || '[]'); } catch (e) { return []; } };
  const oznaci = (id) => { try { const p = procitano(); if (!p.includes(id)) { p.push(id); localStorage.setItem(PROCITANO, JSON.stringify(p.slice(-50))); } } catch (e) {} };
  const UPOZORENJE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/></svg>';

  // Jednostavan prikaz teksta bloga: ## naslov, popisi s - ili 1., prazni redak = novi odlomak
  function tekstBloga(t) {
    const out = []; let lista = null;
    const zatvori = () => { if (lista) { out.push(`</${lista}>`); lista = null; } };
    String(t || '').split('\n').forEach((red) => {
      const r = red.trim();
      if (!r) { zatvori(); return; }
      let m;
      if ((m = r.match(/^##\s+(.*)/))) { zatvori(); out.push(`<h2>${esc(m[1])}</h2>`); return; }
      if ((m = r.match(/^-\s+(.*)/))) { if (lista !== 'ul') { zatvori(); out.push('<ul>'); lista = 'ul'; } out.push(`<li>${esc(m[1])}</li>`); return; }
      if ((m = r.match(/^\d+\.\s+(.*)/))) { if (lista !== 'ol') { zatvori(); out.push('<ol>'); lista = 'ol'; } out.push(`<li>${esc(m[1])}</li>`); return; }
      zatvori(); out.push(`<p>${esc(r)}</p>`);
    });
    zatvori();
    return out.join('');
  }

  async function prikaziBlog(A, b, natrag) {
    oznaci(b.id);
    A.prikazi(`${A.vrh(true)}<article class="clanak"><span class="oznaka">BLOG · ${dat(b.objava)}</span><h1>${esc(b.naslov)}</h1>
      ${b.uvod ? `<p class="uvod">${esc(b.uvod)}</p>` : ''}${tekstBloga(b.tekst)}</article>`, natrag);
    window.scrollTo(0, 0);
  }

  // Ucitaj i nacrtaj blok „Novo" u zadani element. uloga: 'klub' | 'partner' | 'agent'
  async function u(A, uloga, el, osvjezi) {
    if (!el) return;
    const [ob, pt, an, bl] = await Promise.all([
      A.sb.from('obavijesti').select('id, naslov, tekst, kljucna, od, poveznica').eq('za', uloga).order('kljucna', { ascending: false }).order('od', { ascending: false }),
      A.sb.from('obavijesti_potvrde').select('obavijest_id'),
      A.sb.rpc('moje_ankete'),
      A.sb.rpc('objave_bloga')
    ]);
    const vidjeno = new Set((pt.data || []).map((x) => x.obavijest_id));
    const obavijesti = (ob.data || []).filter((o) => !vidjeno.has(o.id));
    const ankete = an.data || [];
    const pr = procitano();
    const blog = (bl.data || []).filter((b) => !pr.includes(b.id)).slice(0, 2);
    if (!obavijesti.length && !ankete.length && !blog.length) { el.innerHTML = ''; return; }
    el.innerHTML = `<div class="novo">
      ${obavijesti.map((o) => `<div class="obavijest${o.kljucna ? '' : ' blaga'}" data-ob="${o.id}">
        <div class="obavijest-red">${o.kljucna ? UPOZORENJE : ''}<b>${esc(o.naslov)}</b></div>
        <span>${esc(o.tekst)}</span>
        ${o.poveznica ? `<a class="veza mala" href="${esc(o.poveznica)}" target="_blank" rel="noopener">Otvori poveznicu</a>` : ''}
        <button class="gumb ${o.kljucna ? 'naglaseni' : 'drugi'} mali" type="button" data-potvrdi="${o.id}">${o.kljucna ? 'Pročitao sam i potvrđujem' : 'U redu'}</button>
      </div>`).join('')}
      ${ankete.map((a) => `<form class="kartica anketa" data-anketa="${a.id}" data-vise="${a.vise ? 1 : 0}">
        <span class="oznaka">KRATKA ANKETA</span><b>${esc(a.pitanje)}</b>
        ${a.vise ? '<span class="sitno">Možete odabrati više odgovora.</span>' : ''}
        <div class="opcije">${(a.opcije || []).map((t, i) => `<label class="opcija"><input type="${a.vise ? 'checkbox' : 'radio'}" name="a${a.id}" value="${i}"><span>${esc(t)}</span></label>`).join('')}</div>
        <button class="gumb mali" type="submit">Pošalji odgovor</button>
      </form>`).join('')}
      ${blog.map((b) => `<div class="kartica blog-novo"><span class="oznaka">NOVO NA BLOGU · ${dat(b.objava)}</span><b>${esc(b.naslov)}</b>
        ${b.uvod ? `<span class="sitno">${esc(b.uvod)}</span>` : ''}<button class="gumb drugi mali" type="button" data-blog="${b.id}">Pročitaj</button></div>`).join('')}
      <p class="poruka" role="alert"></p></div>`;
    const por = el.querySelector('.poruka');
    el.querySelectorAll('[data-potvrdi]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await A.sb.from('obavijesti_potvrde').insert({ obavijest_id: Number(b.dataset.potvrdi) });
      if (error) { b.disabled = false; por.textContent = 'Nije spremljeno. Pokušajte ponovno.'; return; }
      u(A, uloga, el, osvjezi);
    }));
    el.querySelectorAll('form.anketa').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const izbor = [...f.querySelectorAll('input:checked')].map((x) => Number(x.value));
      if (!izbor.length) { por.textContent = 'Odaberite odgovor.'; return; }
      const b = e.submitter; b.disabled = true;
      const { error } = await A.sb.rpc('odgovori_anketu', { anketa: Number(f.dataset.anketa), izbor });
      if (error) { b.disabled = false; por.textContent = 'Odgovor nije poslan. Pokušajte ponovno.'; return; }
      f.outerHTML = '<div class="okvir">Hvala na odgovoru.</div>';
    }));
    el.querySelectorAll('[data-blog]').forEach((b) => b.addEventListener('click', () => {
      const clanak = (bl.data || []).find((x) => x.id === Number(b.dataset.blog));
      if (clanak) prikaziBlog(A, clanak, osvjezi);
    }));
  }

  window.AnimolioNovo = { u };
})();
