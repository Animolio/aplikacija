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
    const [po, pr, pd, ob, pt, zr, is, rz] = await Promise.all([
      A.sb.from('agent_postavke').select('dana_cekanja, dan_isplate, dana_izmedu_racuna, doprinosi_iz_posto, porez_posto, akademija_postoji, bod_bocica, bod_veleprodaja, bod_novi_partner, bod_aktivni_partner').maybeSingle(),
      A.sb.rpc('agent_pregled'),
      A.sb.rpc('agent_prodaje'),
      A.sb.from('obavijesti').select('id, naslov, tekst, kljucna, od').eq('za', 'agent').order('od', { ascending: false }),
      A.sb.from('obavijesti_potvrde').select('obavijest_id'),
      A.sb.rpc('agent_zarada'),
      A.sb.from('isplate').select('obracun_od, obracun_do, iznos_eur, isplaceno').order('obracun_do', { ascending: false }),
      A.sb.rpc('agent_stanje')
    ]);
    const potvrdeno = new Set((pt.data || []).map((x) => x.obavijest_id));
    // Agent vidi samo neto (Zdravko 5.11.2026.). Bez obrta: bruto umanjen za doprinose i porez drugog dohotka; s obrtom: iznos njegova računa.
    const kl = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
    rz.data = kl(rz.data); pd.data = kl(pd.data); is.data = kl(is.data); zr.data = kl(zr.data);
    const st0 = rz.data || {}; const s0 = po.data || {};
    const obrt = st0.obrt === 'potvrdeno' && st0.razina && st0.razina.redni >= 2;
    const k = obrt ? 1 : (1 - Number(s0.doprinosi_iz_posto || 0) / 100) * (1 - Number(s0.porez_posto || 0) / 100);
    const n = (v) => (v === null || v === undefined ? v : Math.round(Number(v) * k * 100) / 100);
    const zr0 = (Array.isArray(zr.data) ? zr.data[0] : zr.data) || {};
    ['mjesec', 'u_cekanju', 'za_isplatu', 'isplaceno'].forEach((x) => { if (x in zr0) zr0[x] = n(zr0[x]); });
    (pd.data || []).forEach((x) => { x.provizija_eur = n(x.provizija_eur); });
    if (!obrt) (is.data || []).forEach((x) => { x.iznos_eur = n(x.iznos_eur); });
    if (st0.razina) st0.razina.po_bocici = n(st0.razina.po_bocici);
    if (st0.iduca && st0.iduca.po_bocici !== undefined) st0.iduca.po_bocici = n(st0.iduca.po_bocici);
    return {
      greska: !!(pr.error || pd.error || zr.error),
      postavke: po.data || {},
      partneri: pr.data || [],
      prodaje: pd.data || [],
      zarada: zr0,
      isplate: is.data || [],
      stanje: rz.data || null,
      razina: (rz.data && rz.data.razina) || null,
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
  const dat = (d) => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T12:00:00' : d); return `${x.getDate()}. ${x.getMonth() + 1}.`; };
  // Agent vidi samo svoju proviziju i bočice, nikad iznos prodaje.
  function zaradaKartica(d) {
    const s = d.postavke; const z = d.zarada; const st = d.stanje || {}; const rc = st.racun || {}; const sad = new Date();
    const obrt = st.obrt === 'potvrdeno' && st.razina && st.razina.redni >= 2;
    let desno;
    if (obrt) {
      desno = `<div><b>${iznos(rc.saldo)} €</b><span>za isplatu, na vaš račun</span></div>`;
    } else {
      let isplata = 'za isplatu';
      if (s.dan_isplate) { const x = new Date(sad.getFullYear(), sad.getMonth() + (sad.getDate() > s.dan_isplate ? 1 : 0), Number(s.dan_isplate)); isplata = `za isplatu do ${x.getDate()}. ${x.getMonth() + 1}.`; }
      desno = `<div><b>${iznos(z.za_isplatu)} €</b><span>${isplata}</span></div>`;
    }
    return `<div class="zarada-kartica"><span class="zk-oznaka">Vaša ${obrt ? 'zarada' : 'neto zarada'} u ${MJESECI[sad.getMonth()]}${obrt ? ', bez PDV-a' : ''}</span>
      <span class="zk-broj">${iznos(z.mjesec)} <small>€</small></span>
      <div class="zk-dno"><div><b>${iznos(z.u_cekanju)} €</b><span>u čekanju${s.dana_cekanja ? ` (${s.dana_cekanja} dana)` : ''}</span></div>${desno}</div>
      <span class="zk-oznaka">${bocice(bociceMj(d))} prodano preko vaših partnera ovaj mjesec</span></div>
${isplataHtml(d)}`;
  }
  // Isplata: s obrtom agent šalje račun kad želi (najranije tjedan dana nakon zadnje isplate); Početak mjesečno.
  function isplataHtml(d) {
    const st = d.stanje; if (!st) return '';
    const rc = st.racun || {};
    if (st.obrt === 'potvrdeno' && st.razina && st.razina.redni >= 2) {
      if (st.zahtjev) return `<div class="okvir">Račun na ${iznos(st.zahtjev.iznos)} € poslan ${dat(st.zahtjev.poslano)}. Čeka isplatu.</div>`;
      let h = st.vraceno ? `<div class="okvir">Račun na ${iznos(st.vraceno.iznos)} € je vraćen: ${esc0(st.vraceno.razlog)}</div>` : '';
      if (rc.moze) {
        const dugo = rc.zadnja_isplata && (Date.now() - new Date(rc.zadnja_isplata + 'T12:00:00').getTime()) > 30 * DAN;
        h += `${dugo ? '<p class="sitno">Od zadnje isplate prošlo je više od mjesec dana.</p>' : ''}<button class="gumb" type="button" id="posaljiRacun">Pošalji račun na ${iznos(rc.saldo)} €</button>`;
      } else if (rc.razlog === 'prerano') h += `<p class="sitno">Idući račun možete poslati od ${dat(rc.najranije)}.</p>`;
      else if (rc.razlog === 'ispod najmanje') h += `<p class="sitno">Račun možete poslati kad je za isplatu najmanje ${iznos(rc.najmanja)} €.</p>`;
      return h;
    }
    if (st.obrt === 'poslano') return '<div class="okvir">Rješenje o obrtu čeka potvrdu MOZON-a.</div>';
    return `<div class="kartica"><span class="oznaka">AKO IMATE OBRT</span>
      ${st.obrt === 'vraceno' && st.obrt_napomena ? `<span class="sitno">Rješenje je vraćeno: ${esc0(st.obrt_napomena)}</span>` : ''}
      <button class="gumb drugi mali" type="button" id="imamObrt">Pošalji rješenje o obrtu</button></div>`;
  }
  const esc0 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bn = (x) => Number(x || 0).toLocaleString('hr-HR');
  function razinaHtml(d) {
    const st = d.stanje; if (!st || !st.razina) return '';
    const s = d.postavke; const r = st.razina; const nx = st.iduca; const b = Number(st.bodovi || 0);
    let napredak = '';
    if (nx && nx.prag_ulaz) {
      const pct = Math.max(0, Math.min(100, Math.round(b / Number(nx.prag_ulaz) * 100)));
      napredak = `<div class="red-oznaka"><span class="sitno">Do razine ${esc0(nx.naziv)} (${eur(nx.po_bocici)} € po bočici)</span><b>${Math.max(0, Number(nx.prag_ulaz) - b).toLocaleString('hr-HR')} bodova</b></div>
        <div class="traka-bodova" role="img" aria-label="${pct} % do iduće razine"><span style="width:${pct}%"></span></div>`;
    } else if (nx) napredak = `<span class="sitno">Razina ${esc0(nx.naziv)} vrijedi za agente s registriranim obrtom.</span>`;
    return `<div class="kartica"><span class="oznaka">RAZINA I BODOVI</span>
      <div class="red-oznaka"><b>${esc0(r.naziv)} · ${eur(r.po_bocici)} € po bočici</b><span class="znak-st">${b.toLocaleString('hr-HR')} bodova</span></div>
      ${napredak}
      ${r.prag_odrzavanje ? `<span class="sitno">Za održavanje razine treba ${Number(r.prag_odrzavanje).toLocaleString('hr-HR')} bodova u ${st.razdoblje_mjeseci} mjeseca.</span>` : ''}
      <span class="sitno">Bodovi zadnja ${st.razdoblje_mjeseci} mjeseca. Iduća provjera razine ${dat(st.iduca_provjera)}</span>
      <span class="sitno">Bodovi: ${bn(s.bod_bocica)} po bočici preko koda · ${bn(s.bod_veleprodaja)} po bočici iz veleprodaje · ${bn(s.bod_novi_partner)} za novog partnera nakon njegove druge narudžbe · ${bn(s.bod_aktivni_partner)} mjesečno za svakog partnera koji je naručio.</span></div>`;
  }

  // Učitavanje datoteke (račun ili rješenje o obrtu) u agentovu mapu
  function zaslonDatoteka(A, a, vrsta, natrag) {
    const st = T.d.stanje || {}; const rc = st.racun || {};
    const racun = vrsta === 'racun';
    const podaci = racun ? `<div class="kartica"><span class="oznaka">NA RAČUNU MORA PISATI</span>
        <span>Kupac: <b>MOZON d.o.o.</b>, Malo Budaševo 86, 44202 Budaševo, OIB 90016851974</span>
        <span>Opis: <b>Provizija za prodaje do ${dat(rc.do_datuma)}${rc.do_datuma ? new Date(rc.do_datuma).getFullYear() + '.' : ''}</b></span>
        <span>Iznos: <b>${iznos(rc.saldo)} €</b></span></div>` : '<p>Učitajte rješenje o upisu obrta (PDF ili fotografija). MOZON ga pregleda i potvrdi.</p>';
    A.prikazi(`${A.vrh(true).replace('>ANIMOLIO<', '>ANIMOLIO AGENT<')}
      <h1>${racun ? 'Pošalji račun' : 'Rješenje o obrtu'}</h1>
      ${podaci}
      <label class="polje">${racun ? 'Račun' : 'Rješenje'} (PDF ili fotografija, do 10 MB)<input type="file" id="dat" accept="application/pdf,image/jpeg,image/png,image/heic,image/webp"></label>
      <p class="poruka" role="alert"></p>
      <div class="dno"><button class="gumb" type="button" id="salji">Pošalji</button></div>`, natrag);
    A.app.querySelector('#salji').addEventListener('click', async (e) => {
      const f = A.app.querySelector('#dat').files[0];
      if (!f) return A.greska('Odaberite datoteku.');
      if (f.size > 10485760) return A.greska('Datoteka je veća od 10 MB.');
      const ext = ((f.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '')) || 'pdf';
      const put = `${A.S.korisnik.id}/${racun ? 'racuni' : 'obrt'}/${Date.now()}.${ext}`;
      const b = e.currentTarget; A.zauzeto(b, true);
      const up = await A.sb.storage.from('agenti').upload(put, f, { contentType: f.type || undefined, upsert: false });
      if (up.error) { A.zauzeto(b, false); return A.greska('Datoteka nije učitana. Pokušajte ponovno.'); }
      const r = racun ? await A.sb.rpc('agent_posalji_racun', { putanja: put, iznos: Number(rc.saldo) }) : await A.sb.rpc('agent_posalji_obrt', { putanja: put });
      A.zauzeto(b, false);
      if (r.error) return A.greska(/iznos promijenjen/.test(r.error.message || '') ? 'Iznos za isplatu se promijenio. Vratite se i pošaljite račun na novi iznos.' : 'Slanje nije uspjelo. Pokušajte ponovno.');
      natrag();
    });
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
        ${razinaHtml(d)}
        <span class="oznaka">OVAJ MJESEC PO PARTNERIMA</span>
        ${partneriMj.length ? `<div class="kartica lista">${partneriMj.map((p) => `<div class="stavka"><div class="stavka-tekst"><b>${A.esc(p.naziv)}${mjesto(p.adresa) ? ' · ' + A.esc(mjesto(p.adresa)) : ''}</b><span class="sitno">${bocice(p.boc)}</span></div><b>${eur(p.prov)} €</b></div>`).join('')}</div>` : '<div class="okvir">Ovaj mjesec još nema prodaja preko kodova vaših partnera.</div>'}
        <span class="oznaka">OBRAČUNI I ISPLATE</span>
        ${d.isplate.length ? `<div class="kartica lista">${d.isplate.map((i) => `<div class="stavka"><div class="stavka-tekst"><b>Obračun ${datum(i.obracun_od)} – ${datum(i.obracun_do)} ${new Date(i.obracun_do).getFullYear()}.</b><span class="sitno">${i.isplaceno ? `Isplaćeno ${datum(i.isplaceno)} ${new Date(i.isplaceno).getFullYear()}.` : 'Čeka isplatu'}</span></div><b>${eur(i.iznos_eur)} €</b></div>`).join('')}</div>` : '<div class="okvir">Još nema obračuna.</div>'}
        ${d.prodaje.length ? `<span class="oznaka">ZADNJE PRODAJE</span>
        <div class="kartica lista">${d.prodaje.slice(0, 30).map((p) => `<div class="stavka"><div class="stavka-tekst"><b>${A.esc(p.proizvod || '')} · ${bocice(Number(p.bocica))}${p.vrsta === 'veleprodaja' ? ' · veleprodaja' : ''}</b><span class="sitno">${datum(p.datum)} · ${A.esc(p.partner)}${mjesto(p.adresa) ? ', ' + A.esc(mjesto(p.adresa)) : ''}</span></div><span>${eur(p.provizija_eur)} €</span></div>`).join('')}</div>` : ''}`;
    }
    // Početna
    const sat = new Date().getHours();
    const pozdrav = sat < 10 ? 'Dobro jutro' : sat < 18 ? 'Dobar dan' : 'Dobra večer';
    const ime = String(a.ime_prezime || '').split(' ')[0];
    const inic = String(a.ime_prezime || '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
    const proba = !d.postavke.akademija_postoji;
    return `<div class="agent-glava"><span class="inicijali">${A.esc(inic)}</span><div class="stavka-tekst"><b>${pozdrav}, ${A.esc(ime)}</b><span class="sitno">Kod ${A.esc(a.kod)}${proba ? ' · proba: Akademija označena ručno' : ''}</span>${d.razina ? `<span class="sitno">Razina ${A.esc(d.razina.naziv)} · ${eur(d.razina.po_bocici)} € po bočici</span>` : ''}</div></div>
      <div id="novo"></div>
      ${d.greska ? '<div class="okvir">Podaci o partnerima i prodajama trenutno se ne mogu učitati.</div>' : zaradaKartica(d)}
      <div class="red-oznaka"><span class="oznaka">PLAN ZA DANAS</span>${ruta ? `<a class="veza mala" href="${ruta}" target="_blank" rel="noopener">Otvori rutu</a>` : ''}</div>
      ${plan.length ? planLista(A, plan.slice(0, 3), false) : prazanPlan()}`;
  }

  async function prikazi(A, a, natrag) {
    const d = await ucitaj(A); T.d = d;
    A.prikazi(`${A.zaglavlje('ANIMOLIO AGENT')}<div class="teren">${sadrzaj(A, a, d)}<p class="poruka" role="alert"></p></div>${izbornik(T.kartica)}`);
    A.app.classList.add('s-izbornikom');
    A.vezPostavke(() => prikazi(A, a, natrag));
    if (window.AnimolioNovo) window.AnimolioNovo.u(A, 'agent', A.app.querySelector('#novo'), () => prikazi(A, a, natrag));
    A.app.querySelectorAll('[data-kartica]').forEach((b) => b.addEventListener('click', () => { T.kartica = b.dataset.kartica; prikazi(A, a, natrag); window.scrollTo(0, 0); }));
    const pr = A.app.querySelector('#posaljiRacun'); if (pr) pr.addEventListener('click', () => zaslonDatoteka(A, a, 'racun', () => prikazi(A, a, natrag)));
    const io = A.app.querySelector('#imamObrt'); if (io) io.addEventListener('click', () => zaslonDatoteka(A, a, 'obrt', () => prikazi(A, a, natrag)));
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
