/* Animolio — A4 letak partnera s njegovim kodom i QR-om (za ispis: stol, blagajna, čekaonica) */
(function () {
  'use strict';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const qr = (tekst) => { const q = window.qrcode(0, 'M'); q.addData(tekst); q.make(); return q.createSvgTag({ cellSize: 8, margin: 0, scalable: true }); };
  function html(o) {
    const baza = o.baza || '';
    return `<!doctype html><html lang="hr"><head><meta charset="utf-8"><title>Animolio · ${esc(o.kod)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4;margin:0}*{box-sizing:border-box}html,body{margin:0}
body{width:210mm;height:297mm;background:#FFFFFF;color:#3A2A21;font-family:Inter,Arial,sans-serif;position:relative;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.vrh{text-align:center;padding:16mm 18mm 0}.vrh img{height:28mm}
h1{font-family:Fraunces,Georgia,serif;font-weight:400;font-size:30pt;line-height:1.08;text-align:center;margin:10mm 16mm 4mm}
.pod{text-align:center;font-size:12pt;color:#6B5445;margin:0 24mm}
.motivi{display:flex;justify-content:center;gap:8mm;margin:13mm 0 0}
.m{width:52mm;text-align:center}.m img{width:48mm;height:48mm;object-fit:cover;border-radius:50%}
.m b{display:block;font-size:12pt;letter-spacing:2px;margin-top:2.5mm;color:#8B6B3D}.m span{display:block;font-size:9.5pt;line-height:1.35;margin-top:1mm}
.kod{margin:16mm 16mm 0;background:#F7E1D7;border-radius:7mm;padding:8mm 10mm;display:flex;align-items:center;gap:9mm}
.kod .q{width:44mm;height:44mm;background:#fff;padding:3mm;border-radius:3mm;flex:none}.kod .q svg{width:100%;height:100%;display:block}
.kod .t{flex:1}.kod .n{font-size:11pt;letter-spacing:2.5px;font-weight:600;color:#8B6B3D}
.kod .k{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:38pt;line-height:1.05;margin:2mm 0 3mm;letter-spacing:1px}
.kod .u{font-size:12pt;line-height:1.4}
.prep{text-align:center;font-size:13pt;margin:10mm 0 0}.prep b{font-weight:700}
.upoz{position:absolute;left:18mm;right:18mm;bottom:22mm;text-align:center;font-size:9.5pt;color:#6B5445}
.dno{position:absolute;left:18mm;right:18mm;bottom:11mm;border-top:0.3mm solid #E4D9CF;padding-top:3mm;display:flex;justify-content:space-between;font-size:9pt;color:#8A7666}
</style></head><body>
<div class="vrh"><img src="${baza}logo-animolio.png" alt="Animolio"></div>
<h1>Njega za šape, kožu i dlaku</h1>
<p class="pod">Uljni serumi iz našeg laboratorija u Budaševu. Brzo se upijaju i smiju se polizati.</p>
<div class="motivi">
  <div class="m"><img src="${baza}motiv-sven.jpg" alt=""><b>SVEN</b><span>šape i njuškica</span></div>
  <div class="m"><img src="${baza}motiv-marcy.jpg" alt=""><b>MARCY</b><span>šape i njuškica, bez eteričnih ulja</span></div>
  <div class="m"><img src="${baza}motiv-fluffy.jpg" alt=""><b>FLUFFY</b><span>koža i dlaka, samo za pse</span></div>
</div>
<div class="kod"><div class="q">${qr(o.link)}</div><div class="t"><div class="n">POPUST UZ KOD</div><div class="k">${esc(o.kod)}</div><div class="u">Skenirajte i kupite na animolio.eu</div></div></div>
<p class="prep">Preporučuje: <b>${esc(o.naziv)}</b></p>
<p class="upoz">FLUFFY sadrži eterično ulje čajevca. Nije za mačke.</p>
<div class="dno"><span>animolio.eu</span><span>MOZON d.o.o. · Malo Budaševo 86, 44202 Budaševo</span></div>
</body></html>`;
  }
  // Otvori letak za ispis (novi prozor; na mobitelu: Dijeli → Ispis ili Spremi kao PDF)
  function otvori(o) {
    const w = window.open('', '_blank');
    const baza = location.origin + location.pathname.replace(/[^/]*$/, '');
    const h = html(Object.assign({ baza }, o));
    if (!w) { const b = new Blob([h], { type: 'text/html' }); location.href = URL.createObjectURL(b); return; }
    w.document.open(); w.document.write(h); w.document.close();
    w.onload = () => setTimeout(() => { try { w.print(); } catch (e) {} }, 400);
  }
  window.AnimolioLetak = { html, otvori };
})();
