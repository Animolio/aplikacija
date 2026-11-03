/* Animolio aplikacija — agent na terenu: Početna, Partneri, Plan, Zarada (3.11.2026.)
   Po odobrenom zaslonu „Agent: početna". Agent vidi samo svoju proviziju (u čekanju, za isplatu, isplate po obračunima)
   te broj bočica i gdje su prodane. Iznos prodaje (prihod MOZON-a) agentu se ne šalje. */
(function () {
  'use strict';
  const MJESECI = ['siječnju', 'veljači', 'ožujku', 'travnju', 'svibnju', 'lipnju', 'srpnju', 'kolovozu', 'rujnu', 'listopadu', 'studenom', 'prosincu'];
  const MJ_NOM = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];
  const DAN = 864e5;
  const eur = (n) => Number(n || 0).toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const danaOd = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / DAN) : null;
  const datum = (d) => { const x = new Date(d); return `${x.getDate()}. ${x.getMonth() + 1}.`; };
  const mjesto = (adr) => { const d = String(adr || '').split(',').map((s) => s.trim()).filter(Boolean); return d.length > 1 ? d[d.length - 1].replace(/^\d{5}\s*/, '') : ''; };

  const IK = {
    pocetna: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    partneri: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c.6-3.4 3-5.4 6-5.4s5.4 2 6 5.4"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.6c2.6.2 4.4 2 5 5.4"/>',
    plan: '<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    zarada: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>'
  };
  const svg = (p, s) => `<svg width="${s || 22}" height="${s || 22}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${p}</svg>`;

  // Stanje partnera iz stvarnih narudžbi: zadnjih 30 dana prema 30 dana prije toga.
  function stanjePartnera(p) {
    if (p.stanje === 'prijava') return { k: 'ceka', t: 'Čeka odobrenje', red: 9 };
    if (p.stanje === 'raskinut') return { k: 'kraj', t: 'Završeno', red: 10 };
    const odobrenPrije = danaOd(p.odobreno) ?? 0;
    const zadnja = danaOd(p.zadnja_prodaja);
    if (zadnja === null && odobrenPrije < 30) return { k: 'novi', t: 'Novi', red: 2 };
    if (zadnja === null || zadnja > 45) return { k: 'uspavan', t: 'Uspavan', red: 0 };
    if (Number(p.narudzbi_30) > Number(p.narudzbi_pret_30)) return { k: 'raste', t: 'Raste', red: 4 };
    if (Number(p.narudzbi_30) < Number(p.narudzbi_pret_30)) return { k: 'pada', t: 'Pada', red: 1 };
    return { k: 'stabilno', t: 'Stabilno', red: 3 };
  }
  function razlog(p) {
    const v = danaOd(p.zadnji_posjet);
    if (p.posjet_danas) return 'Posjet zabilježen danas';
    if (v === null) return 'Posjet još nije zabilježen';
    return `Zadnji posjet prije ${v} ${v === 1 ? 'dan' : 'dana'}`;
  }
  function planRed(partneri) {
    return partneri.filter((p) => p.stanje === 'odobren')
      .map((p) => Object.assign({}, p, { st: stanjePartnera(p) }))
      .sort((a, b) => (a.posjet_danas - b.posjet_danas) || (a.st.red - b.st.red)
        || ((danaOd(b.zadnji_posjet) ?? 1e6) - (danaOd(a.zadnji_posjet) ?? 1e6)));
  }
  function rutaUrl(plan) {
    const adr = plan.filter((p) => !p.posjet_danas).slice(0, 9).map((p) => p.adresa);
    if (!adr.length) return '';
    const cilj = adr.pop();
    return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + encodeURIComponent(cilj)
      + (adr.length ? '&waypoints=' + adr.map(encodeURIComponent).join('%7C') : '');
  }
  const znak = (st) => `<span class="znak-st ${st.k}">${st.t}</span>`;

  const T = { kartica: 'pocetna' };

  async function ucitaj(A) {
    const [po, pr, pd, ob, pt, zr, is] = await Promise.all([
      A.sb.from('agent_postavke').select('provizija_posto, dana_cekanja, dan_isplate, akademija_postoji').maybeSingle(),
      A.sb.rpc('agent_pregled'),
      A.sb.rpc('agent_prodaje'),
      A.sb.from('obavijesti').select('id, naslov, tekst, kljucna, od').eq('za', 'agent').order('od', { ascending: false }),
      A.sb.from('obavijesti_potvrde').select('obavijest_id'),
      A.sb.rpc('agent_zarada'),
      A.sb.from('isplate').select('obracun_od, obracun_do, iznos_eur, isplaceno').order('obracun_do', { ascending: false })
    ]);
    const potvrdeno = new Set((pt.data || []).map((x) => x.obavijest_id));
    return {
      greska: !!(pr.error || pd.error || zr.error),
      postavke: po.data || {},
      partneri: pr.data || [],
      prodaje: pd.data || [],
      zarada: (Array.isArray(zr.data) ? zr.data[0] : zr.data) || {},
      isplate: is.data || [],
      obavijesti: (ob.data || []).filter((o) => !potvrdeno.has(o.id))
    };
  }

  function izbornik(akt) {
    return `<nav class="donji-izbornik" aria-label="Glavni izbornik">${[['pocetna', 'Početna'], ['partneri', 'Partneri'], ['plan', 'Plan'], ['zarada', 'Zarada']]
      .map(([k, t]) => `<button type="button" data-kartica="${k}" ${k === akt ? 'aria-current="page"' : ''}>${svg(IK[k])}<span>${t}</span></button>`).join('')}</nav>`;
  }

  function obavijestiHtml(A, d) {
    return d.obavijesti.filter((o) => o.kljucna).map((o) => `<div class="obavijest" data-obavijest="${o.id}">
        <div class="obavijest-red">${svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>')}<b>${A.esc(o.naslov)}</b></div>
        <span>${A.esc(o.tekst)}</span>
        <button class="gumb naglaseni mali" type="button" data-potvrdi="${o.id}">Pročitao sam i potvrđujem</button>
      </div>`).join('');
  }

  const iznos = (v) => eur(v || 0);
  const bocice = (n) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'bočica' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'bočice' : 'bočica'}`;
  function bociceMj(d) {
    const sad = new Date(); const poc = new Date(sad.getFullYear(), sad.getMonth(), 1).getTime();
    return d.prodaje.filter((p) => new Date(p.datum).getTime() >= poc).reduce((z, p) => z + Number(p.bocica || 0), 0);
  }
  // Agent vidi samo svoju proviziju i bočice, nikad iznos prodaje.
  function zaradaKartica(d) {
    const s = d.postavke; const z = d.zarada; const sad = new Date();
    let isplata = 'za isplatu';
    if (s.dan_isplate) { const x = new Date(sad.getFullYear(), sad.getMonth() + (sad.getDate() > s.dan_isplate ? 1 : 0), Number(s.dan_isplate)); isplata = `za isplatu do ${x.getDate()}. ${x.getMonth() + 1}.`; }
    return `<div class="zarada-kartica"><span class="zk-oznaka">Vaša zarada u ${MJESECI[sad.getMonth()]}</span>
      <span class="zk-broj">${iznos(z.mjesec)} <small>€</small></span>
      <div class="zk-dno"><div><b>${iznos(z.u_cekanju)} €</b><span>u čekanju${s.dana_cekanja ? ` (${s.dana_cekanja} dana)` : ''}</span></div><div><b>${iznos(z.za_isplatu)} €</b><span>${isplata}</span></div></div>
      <span class="zk-oznaka">${bocice(bociceMj(d))} prodano preko vaših partnera ovaj mjesec</span></div>`;
  }

  function planLista(A, plan, sGumbom) {
    return `<div class="kartica lista">${plan.map((p, i) => `<div class="stavka">
        <span class="redni">${i + 1}</span>
        <div class="stavka-tekst"><b>${A.esc(p.naziv)}${mjesto(p.adresa) ? ' · ' + A.esc(mjesto(p.adresa)) : ''}</b><span class="sitno">${razlog(p)}</span>
          ${sGumbom ? `<span class="sitno">${A.esc(p.adresa)}</span>${p.posjet_danas ? '' : `<button class="gumb drugi mali posjet" type="button" data-posjet="${p.id}">Zabilježi posjet</button>`}` : ''}</div>
        ${znak(p.st)}</div>`).join('')}</div>`;
  }

  function prazanPlan() {
    return `<div class="okvir">Kad MOZON odobri vašeg prvog partnera, ovdje se pojavljuje plan obilaska.</div>`;
  }

  function sadrzaj(A, a, d) {
    const plan = planRed(d.partneri);
    const ruta = rutaUrl(plan);
    if (T.kartica === 'partneri') {
      return `<h1>Partneri</h1>
        <button class="gumb" type="button" id="noviPartner">Novi partner</button>
        ${d.partneri.length ? `<div class="kartica lista">${d.partneri.map((p) => { const st = stanjePartnera(p); return `<div class="stavka">
          <div class="stavka-tekst"><b>${A.esc(p.naziv)}</b><span class="sitno">${p.stanje === 'odobren'
            ? `${bocice(Number(p.bocica_30))} u 30 dana · ${razlog(p).toLowerCase()}`
            : p.stanje === 'prijava' ? 'Prijava čeka odobrenje MOZON-a' : 'Suradnja završena'}</span>${p.kod ? `<span class="sitno">Kod ${A.esc(p.kod)}</span>` : ''}</div>
          ${znak(st)}</div>`; }).join('')}</div>` : '<div class="okvir">Još nemate partnera. Kod dogovora s partnerom pokažite mu QR kod pod „Novi partner“.</div>'}`;
    }
    if (T.kartica === 'plan') {
      return `<h1>Plan obilaska</h1>
        ${plan.length ? `${ruta ? `<a class="gumb" href="${ruta}" target="_blank" rel="noopener">Otvori rutu u kartama</a>` : ''}
        <p class="sitno">Redoslijed: prvo uspavani partneri i oni kojima narudžbe padaju, zatim oni koje najdulje niste posjetili. Aplikacija ne prati vašu lokaciju.</p>
        ${planLista(A, plan, true)}` : prazanPlan()}`;
    }
    if (T.kartica === 'zarada') {
      const poP = {};
      const sad = new Date(); const poc = new Date(sad.getFullYear(), sad.getMonth(), 1).getTime();
      d.prodaje.filter((p) => new Date(p.datum).getTime() >= poc).forEach((p) => { const k = p.partner; poP[k] = poP[k] || { naziv: k, adresa: p.adresa, boc: 0, prov: 0, ima: false }; poP[k].boc += Number(p.bocica || 0); if (p.provizija_eur !== null) { poP[k].prov += Number(p.provizija_eur); poP[k].ima = true; } });
      const partneriMj = Object.values(poP).sort((x, y) => y.boc - x.boc);
      return `<h1>Zarada</h1>
        ${d.greska ? '<div class="okvir">Podaci o zaradi trenutno se ne mogu učitati.</div>' : zaradaKartica(d)}
        <span class="oznaka">OVAJ MJESEC PO PARTNERIMA</span>
        ${partneriMj.length ? `<div class="kartica lista">${partneriMj.map((p) => `<div class="stavka"><div class="stavka-tekst"><b>${A.esc(p.naziv)}${mjesto(p.adresa) ? ' · ' + A.esc(mjesto(p.adresa)) : ''}</b><span class="sitno">${bocice(p.boc)}</span></div><b>${eur(p.prov)} €</b></div>`).join('')}</div>` : '<div class="okvir">Ovaj mjesec još nema prodaja preko kodova vaših partnera.</div>'}
        <span class="oznaka">OBRAČUNI I ISPLATE</span>
        ${d.isplate.length ? `<div class="kartica lista">${d.isplate.map((i) => `<div class="stavka"><div class="stavka-tekst"><b>Obračun ${datum(i.obracun_od)} – ${datum(i.obracun_do)} ${new Date(i.obracun_do).getFullYear()}.</b><span class="sitno">${i.isplaceno ? `Isplaćeno ${datum(i.isplaceno)} ${new Date(i.isplaceno).getFullYear()}.` : 'Čeka isplatu'}</span></div><b>${eur(i.iznos_eur)} €</b></div>`).join('')}</div>` : '<div class="okvir">Još nema obračuna.</div>'}
        ${d.prodaje.length ? `<span class="oznaka">ZADNJE PRODAJE</span>
        <div class="kartica lista">${d.prodaje.slice(0, 30).map((p) => `<div class="stavka"><div class="stavka-tekst"><b>${A.esc(p.proizvod || '')} · ${bocice(Number(p.bocica))}</b><span class="sitno">${datum(p.datum)} · ${A.esc(p.partner)}${mjesto(p.adresa) ? ', ' + A.esc(mjesto(p.adresa)) : ''}</span></div><span>${eur(p.provizija_eur)} €</span></div>`).join('')}</div>` : ''}`;
    }
    // Početna
    const sat = new Date().getHours();
    const pozdrav = sat < 10 ? 'Dobro jutro' : sat < 18 ? 'Dobar dan' : 'Dobra večer';
    const ime = String(a.ime_prezime || '').split(' ')[0];
    const inic = String(a.ime_prezime || '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
    const proba = !d.postavke.akademija_postoji;
    return `<div class="agent-glava"><span class="inicijali">${A.esc(inic)}</span><div class="stavka-tekst"><b>${pozdrav}, ${A.esc(ime)}</b><span class="sitno">Kod ${A.esc(a.kod)}${proba ? ' · proba: Akademija označena ručno' : ''}</span></div></div>
      ${obavijestiHtml(A, d)}
      ${d.greska ? '<div class="okvir">Podaci o partnerima i prodajama trenutno se ne mogu učitati.</div>' : zaradaKartica(d)}
      <div class="red-oznaka"><span class="oznaka">PLAN ZA DANAS</span>${ruta ? `<a class="veza mala" href="${ruta}" target="_blank" rel="noopener">Otvori rutu</a>` : ''}</div>
      ${plan.length ? planLista(A, plan.slice(0, 3), false) : prazanPlan()}`;
  }

  async function prikazi(A, a, natrag) {
    const d = await ucitaj(A);
    A.prikazi(`${A.zaglavlje('ANIMOLIO AGENT')}<div class="teren">${sadrzaj(A, a, d)}<p class="poruka" role="alert"></p></div>${izbornik(T.kartica)}`);
    A.app.classList.add('s-izbornikom');
    A.vezPostavke(() => prikazi(A, a, natrag));
    A.app.querySelectorAll('[data-kartica]').forEach((b) => b.addEventListener('click', () => { T.kartica = b.dataset.kartica; prikazi(A, a, natrag); window.scrollTo(0, 0); }));
    const np = A.app.querySelector('#noviPartner');
    if (np && window.AnimolioPartner) np.addEventListener('click', () => { A.app.classList.remove('s-izbornikom'); window.AnimolioPartner.agentQR(A, a, () => prikazi(A, a, natrag)); });
    A.app.querySelectorAll('[data-potvrdi]').forEach((b) => b.addEventListener('click', async () => {
      A.zauzeto(b, true);
      const { error } = await A.sb.from('obavijesti_potvrde').insert({ obavijest_id: Number(b.dataset.potvrdi) });
      A.zauzeto(b, false);
      if (error) return A.greska('Potvrda nije spremljena. Pokušajte ponovno.');
      prikazi(A, a, natrag);
    }));
    A.app.querySelectorAll('[data-posjet]').forEach((b) => b.addEventListener('click', async () => {
      A.zauzeto(b, true);
      const { error } = await A.sb.from('posjeti').insert({ partner_id: b.dataset.posjet });
      A.zauzeto(b, false);
      if (error) return A.greska('Posjet nije zabilježen. Pokušajte ponovno.');
      prikazi(A, a, natrag);
    }));
  }

  window.AnimolioTeren = { prikazi: (A, a, natrag) => prikazi(A, a, natrag) };
})();
