// Renders Kasba's share images and app icons into public/ with Playwright.
// Run once after changing the design: node scripts/make-images.cjs
// (needs Playwright with Chromium; the site itself does not depend on it).
const path = require('path');
let pw;
try { pw = require('playwright'); } catch { pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }

const out = path.join(__dirname, '..', 'public');
const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mukta:wght@600;800&family=Noto+Serif+Devanagari:wght@700&display=block">';
const sections = {
  schemes: ['योजनाएँ', 'Schemes', '#0b6e4f'],
  'jobs-exams': ['नौकरी-परीक्षा', 'Jobs & Exams', '#1f4e9c'],
  farming: ['खेती', 'Farming', '#7a5200'],
  money: ['पैसा', 'Money', '#5b2c83'],
  weather: ['मौसम', 'Weather', '#00677f'],
  health: ['सेहत', 'Health', '#a4262c'],
  nation: ['देश', 'Nation', '#3d434a'],
};

// 1200x630 share card: dark band, section colour stripe, logo and promise.
const card = (label, colour) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:1200px;height:630px;background:#1f2328;color:#fff;font-family:Mukta,sans-serif;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;padding:72px 80px;border-top:24px solid ${colour}}
.logo{font-family:'Noto Serif Devanagari',serif;font-weight:700;font-size:150px;line-height:1}
.logo span{color:#5fc79e}
.tag{font-size:46px;font-weight:600;color:#e8eaed;margin-top:18px}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:34px;color:#c3c8ce}
.pill{background:${colour};color:#fff;font-weight:800;padding:10px 28px;border-radius:999px;font-size:38px}
</style></head><body><div><div class="logo">कस्बा<span>.</span></div><div class="tag">छोटे शहरों की बड़ी ख़बरें, आधिकारिक स्रोतों से</div></div>
<div class="foot"><span>kasba.co.in</span>${label ? `<span class="pill">${label}</span>` : ''}</div></body></html>`;

// Square icon: the logo letter on the band colour. "pad" leaves room for Android's maskable crop.
const icon = (size, pad) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:${size}px;height:${size}px;background:#1e6b52;display:flex;align-items:center;justify-content:center}
b{font-family:'Noto Serif Devanagari',serif;font-weight:700;color:#fff;font-size:${Math.round(size * (pad ? 0.5 : 0.66))}px;line-height:1;transform:translateY(${Math.round(size * 0.04)}px)}
</style></head><body><b>क</b></body></html>`;

// Wide publisher logo for Google (600x60 box).
const logo = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:600px;height:60px;background:#fff;display:flex;align-items:center}
b{font-family:'Noto Serif Devanagari',serif;font-weight:700;font-size:44px;color:#1f2328;line-height:1}b span{color:#1e6b52}
</style></head><body><b>कस्बा<span>.</span></b></body></html>`;

(async () => {
  const browser = await pw.chromium.launch();
  const shot = async (html, w, h, file) => {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, file) });
    await p.close();
  };
  await shot(card('', '#1e6b52'), 1200, 630, 'og/default.png');
  for (const [key, [hi, , colour]] of Object.entries(sections)) await shot(card(hi, colour), 1200, 630, `og/${key}.png`);
  await shot(icon(192, false), 192, 192, 'icon-192.png');
  await shot(icon(512, false), 512, 512, 'icon-512.png');
  await shot(icon(512, true), 512, 512, 'icon-maskable-512.png');
  await shot(icon(180, false), 180, 180, 'apple-touch-icon.png');
  await shot(logo, 600, 60, 'logo-600x60.png');
  await browser.close();
})();
