/* Animolio — ugovor s partnerom (Verzija A, tvrtke i obrti; pravno provjeren tekst, za 2026.) — isti tekst u aplikaciji partnera i u MOZON-desku */
(function () {
  'use strict';
  const VERZIJA = 'A-2026-11';
  function clanci(p) {
    const s = p || {};
    return [
      ['Ugovorne strane', `Naručitelj: MOZON d.o.o., brend Animolio, Malo Budaševo 86, 44202 Budaševo, OIB 90016851974, zastupano po Zdravku Medvedu, direktoru.\nSuradnik: ${s.naziv || ''}, ${s.adresa || ''}, OIB ${s.oib || ''}, zastupano po: ${s.potpisnik || ''}.`],
      ['Članak 1. — Predmet ugovora', 'Ovim Ugovorom uređuju se uvjeti poslovne suradnje na temelju koje Suradnik pruža usluge preporuke i promocije proizvoda marke Animolio krajnjim kupcima, a Naručitelj se obvezuje platiti Suradniku novčanu proviziju sukladno uvjetima utvrđenim ovim Ugovorom.'],
      ['Članak 2. — Obveze Suradnika', 'Suradnik se obvezuje:\n– Aktivno preporučivati proizvode marke Animolio svojim klijentima i široj publici\n– Koristiti personalizirani promo kod dodijeljen od strane Naručitelja\n– Slobodno promovirati proizvode putem vlastitih kanala (ordinacija, salon, društvene mreže, vlastita web stranica, newsletteri i sl.)\n– Ne objavljivati promo kod na kuponskim platformama, popust-agregatorima i sličnim stranicama na kojima kod postaje anonimno dostupan javnosti bez vezanosti uz Suradnika\n– Iznositi točne i istinite informacije o proizvodima\n– Postupati u skladu s vrijednostima brenda Animolio\nNaručitelj se obvezuje:\n– Dostaviti Suradniku dobrodošli paket s uzorcima proizvoda\n– Dodijeliti Suradniku jedinstveni personalizirani promo kod\n– Redovito isplaćivati proviziju sukladno ovom Ugovoru\n– Pružati Suradniku potrebne informacije i materijale o proizvodima'],
      ['Članak 3. — Provizija i uvjeti isplate', '3.1 Provizija. Za svaku prodaju ostvarenu putem Suradnikovog promo koda Suradnik ostvaruje proviziju od 1,00 € po serumu (SVEN, MARCY, FLUFFY) i 3,00 € po Trilogiji.\n3.2 Popust za kupce. Svaki kupac koji koristi Suradnikov promo kod ostvaruje 10% popusta na cijenu proizvoda.\n3.3 Isplata provizije.\n– Provizija se obračunava mjesečno, na temelju prodaja ostvarenih u kalendarskom mjesecu\n– Suradnik ispostavlja račun za uslugu promocije/preporuke do 5. u tekućem mjesecu za prethodni mjesec\n– Naručitelj plaća račun u roku od 15 dana od primitka urednog računa\n– Isplata se vrši na poslovni račun Suradnika\n3.4 Minimalni prag isplate. Provizija se isplaćuje samo ako ukupni iznos u obračunskom mjesecu iznosi najmanje 5,00 €. Iznosi ispod praga prenose se u sljedeći obračunski period.'],
      ['Članak 4. — Promo kod', '– Naručitelj dodjeljuje Suradniku jedinstveni promo kod\n– Promo kod je namijenjen za korištenje isključivo od strane Suradnika i njegove publike (klijenti, pratitelji, posjetitelji)\n– Zabranjena je objava promo koda na kuponskim platformama i popust-agregatorima gdje kod postaje javno dostupan anonimnoj javnosti\n– U slučaju zlouporabe, Naručitelj zadržava pravo poništavanja promo koda i raskida Ugovora'],
      ['Članak 5. — Dobrodošli paket', 'Po potpisivanju Ugovora, Naručitelj dostavlja Suradniku:\n– 1x uzorak seruma SVEN\n– 1x uzorak seruma MARCY\n– 1x uzorak seruma FLUFFY\n– Informativni materijal o proizvodima'],
      ['Članak 6. — Zahvale i nagrade top partnerima', 'Naručitelj može, prema vlastitoj procjeni, nagraditi Suradnike s izvanrednim rezultatima putem:\n– Javnog isticanja na društvenim mrežama Animolio\n– Certifikata Animolio partnera\n– Bonus proizvoda ili povećane provizije\nOve nagrade nisu ugovorna obveza Naručitelja i ne stvaraju pravna potraživanja.'],
      ['Članak 7. — Trajanje i raskid ugovora', '– Ugovor se sklapa na neodređeno vrijeme i stupa na snagu danom potpisivanja\n– Svaka strana može raskinuti Ugovor uz pisanu obavijest 30 dana unaprijed\n– Naručitelj može trenutno raskinuti Ugovor u slučaju zlouporabe promo koda, kršenja uvjeta ili nanošenja štete brendu Animolio'],
      ['Članak 8. — Povjerljivost', 'Suradnik se obvezuje čuvati kao poslovnu tajnu sve informacije o uvjetima suradnje, provizijama i poslovnoj strategiji Naručitelja.'],
      ['Članak 9. — Ostale odredbe', '– Ugovor je sastavljen u skladu s važećim propisima Republike Hrvatske\n– Za sve sporove nadležan je sud u Sisku\n– Sve izmjene moraju biti pisane i potpisane od obje strane']
    ];
  }
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // HTML ugovora: naslovi podebljani, retci kao zasebni odlomci
  function html(p) {
    return `<b style="color:var(--tekst,#3A2A21);text-align:center">UGOVOR O POSLOVNOJ SURADNJI</b><span style="text-align:center">Verzija A — za tvrtke i obrte (novčana provizija)</span>`
      + clanci(p).map(([n, t]) => `<b style="color:var(--tekst,#3A2A21);margin-top:6px">${esc(n)}</b>${t.split('\n').map((r) => `<span>${esc(r)}</span>`).join('')}`).join('');
  }
  async function sazetak(p) {
    const t = VERZIJA + '\n' + clanci(p).map((u) => u.join('\n')).join('\n');
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  window.AnimolioUgovorPartner = { VERZIJA, clanci, html, sazetak };
})();
