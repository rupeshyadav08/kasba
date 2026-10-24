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
  sports: ['खेल', 'Sports', '#b3410e'],
  nation: ['देश', 'Nation', '#3d434a'],
  up: ['उत्तर प्रदेश', 'Uttar Pradesh', '#22305a'],
  bihar: ['बिहार', 'Bihar', '#22305a'],
  mp: ['मध्य प्रदेश', 'Madhya Pradesh', '#22305a'],
  delhi: ['दिल्ली', 'Delhi', '#22305a'],
};

// Kasba's mark: a map pin ("your town"), drawn over the word or the letter.
const RED = '#c8102e';
const pin = (fill, dot) => `<svg viewBox="0 0 32 44" xmlns="http://www.w3.org/2000/svg"><path d="M16 1C7.7 1 1 7.7 1 16c0 11.3 15 27 15 27s15-15.7 15-27C31 7.7 24.3 1 16 1Z" fill="${fill}"/><circle cx="16" cy="16" r="6" fill="${dot}"/></svg>`;

// 1200x630 share card: dark band, section colour stripe, logo and promise.
const card = (label, colour) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:1200px;height:630px;background:#1f2328;color:#fff;font-family:Mukta,sans-serif;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;padding:72px 80px;border-top:24px solid ${colour}}
.logo{font-family:'Noto Serif Devanagari',serif;font-weight:700;font-size:150px;line-height:1;display:inline-flex;align-items:flex-start}
.logo svg{width:52px;height:72px;margin:-6px 0 0 8px}
.tag{font-size:46px;font-weight:600;color:#e8eaed;margin-top:18px}
.foot{display:flex;justify-content:space-between;align-items:center;font-size:34px;color:#c3c8ce}
.pill{background:${colour};color:#fff;font-weight:800;padding:10px 28px;border-radius:999px;font-size:38px}
</style></head><body><div><div class="logo">कस्बा${pin('#ff4d5e', '#1f2328')}</div><div class="tag">छोटे शहरों की बड़ी ख़बरें, आधिकारिक स्रोतों से</div></div>
<div class="foot"><span>kasba.co.in</span>${label ? `<span class="pill">${label}</span>` : ''}</div></body></html>`;

// Square icon: white क with the pin on Kasba red. "pad" leaves room for Android's maskable crop.
const icon = (size, pad) => `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:${size}px;height:${size}px;background:${RED};display:flex;align-items:center;justify-content:center}
i{position:relative;display:block;width:${Math.round(size * (pad ? 0.6 : 0.82))}px;height:${Math.round(size * (pad ? 0.6 : 0.82))}px}
b{position:absolute;left:0;bottom:0;font-family:'Noto Serif Devanagari',serif;font-weight:700;color:#fff;font-size:${Math.round(size * (pad ? 0.48 : 0.66))}px;line-height:1}
svg{position:absolute;right:0;top:0;width:${Math.round(size * (pad ? 0.18 : 0.24))}px}
</style></head><body><i><b>क</b>${pin('#fff', RED)}</i></body></html>`;

// Wide publisher logo for Google (600x60 box).
const logo = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>
body{margin:0;width:600px;height:60px;background:#fff;display:flex;align-items:center}
b{font-family:'Noto Serif Devanagari',serif;font-weight:700;font-size:44px;color:#1f2328;line-height:1;display:inline-flex;align-items:flex-start}
svg{width:16px;height:22px;margin:-2px 0 0 3px}
</style></head><body><b>कस्बा${pin(RED, '#fff')}</b></body></html>`;

(async () => {
  const browser = await pw.chromium.launch();
  const shot = async (html, w, h, file) => {
    const p = await browser.newPage({ viewport: { width: w, height: h } });
    await p.setContent(html, { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(out, file) });
    await p.close();
  };
  await shot(card('', RED), 1200, 630, 'og/default.png');
  for (const [key, [hi, , colour]] of Object.entries(sections)) await shot(card(hi, colour), 1200, 630, `og/${key}.png`);
  await shot(icon(192, false), 192, 192, 'icon-192.png');
  await shot(icon(512, false), 512, 512, 'icon-512.png');
  await shot(icon(512, true), 512, 512, 'icon-maskable-512.png');
  await shot(icon(180, false), 180, 180, 'apple-touch-icon.png');
  await shot(logo, 600, 60, 'logo-600x60.png');
  await browser.close();
})();
