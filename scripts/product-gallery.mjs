import { mkdirSync, writeFileSync } from "node:fs";
const directory = "artifacts/product-upgrade";
mkdirSync(directory, { recursive: true });
const pages = [
  "landing",
  "dashboard",
  "forecasts",
  "alerts",
  "history",
  "performance",
  "regions",
  "subscriptions",
  "settings",
  "login",
  "navigation",
];
writeFileSync(
  `${directory}/review.html`,
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ThermaTwin AI — ürün tasarımı incelemesi</title><style>body{margin:0;padding:32px;background:#071826;color:#eaf7f6;font:15px/1.6 system-ui}h1{font-size:28px}label{display:inline-flex;gap:10px;align-items:center;margin:0 20px 20px 0}select{padding:10px;background:#153344;color:#fff;border:1px solid #3e6976;border-radius:8px}main{display:grid;grid-template-columns:1fr 1fr;gap:24px}article{min-width:0}img{display:block;width:100%;height:auto;border:1px solid #2d4a59}p{color:#b2cbd5;max-width:80ch}@media(max-width:700px){body{padding:16px}main{grid-template-columns:1fr}}</style></head><body><h1>ThermaTwin AI · Önce / sonra</h1><p>Yalnız kayıtlı gerçek veri ve izole demo bağlantısı. Görseller sabit bir anda alınmıştır; veri güncelliği canlı uygulamada ayrıca tarihlenir. Production yayını yapılmamıştır.</p><label>Sayfa<select id="page">${pages.map((p) => `<option>${p}</option>`).join("")}</select></label><label>Genişlik<select id="width">${[390, 768, 1366, 1920].map((w) => `<option ${w === 1366 ? "selected" : ""}>${w}</option>`).join("")}</select></label><label>Tema<select id="theme"><option>light</option><option>dark</option></select></label><main><article><h2>Önce · a805fb5</h2><img id="before" alt="Önceki ürün tasarımı"></article><article><h2>Sonra · PR A</h2><img id="after" alt="Yeni ocean ürün tasarımı"></article></main><script>function update(){const p=document.getElementById('page').value;const w=p==='navigation'?'390':document.getElementById('width').value;const t=document.getElementById('theme').value;for(const stage of ['before','after'])document.getElementById(stage).src=stage+'/'+p+'-'+w+'-'+t+'.png'}for(const e of document.querySelectorAll('select'))e.addEventListener('change',update);update();</script></body></html>`,
  "utf8",
);
console.log(`Review gallery: ${directory}/review.html`);
