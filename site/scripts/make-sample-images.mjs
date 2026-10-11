// Regenerates the placeholder images of the Sample fixture world.
// usage: node scripts/make-sample-images.mjs fixtures/Sample/Saltmarrow
//        node scripts/make-sample-images.mjs fixtures/Sample/Norrgården
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
const root = process.argv[2];
const face = (bg, hair, skin, extra='') => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
<defs><radialGradient id="g" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs>
<rect width="512" height="512" fill="url(#g)"/>
<ellipse cx="256" cy="520" rx="190" ry="150" fill="#2b2a33"/>
<path d="M150 250 Q150 110 256 105 Q362 110 362 250 L370 380 Q256 330 142 380Z" fill="${hair}"/>
<ellipse cx="256" cy="245" rx="92" ry="112" fill="${skin}"/>
<ellipse cx="222" cy="240" rx="9" ry="6" fill="#222"/><ellipse cx="290" cy="240" rx="9" ry="6" fill="#222"/>
<path d="M230 300 Q256 312 282 300" stroke="#7a4a3a" stroke-width="5" fill="none"/>${extra}</svg>`;
const saltmarrow = {
  'characters/Mara/mara.webp': face(['#7fa6b8','#2d4a5a'], '#5a3a22', '#e8c4a0'),
  'characters/Mara/mara-ash.webp': face(['#b86a3c','#3a1a10'], '#3a2416', '#d9b08c', '<path d="M200 270 l30 18 M300 200 l25 10" stroke="#555" stroke-width="7"/>'),
  'characters/Tobin/tobin.webp': face(['#9bb38a','#33452a'], '#c48a3a', '#f0cfa8'),
  'places/Old Mill/old-mill.webp': `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="432"><rect width="768" height="432" fill="#8fb0bf"/><rect y="300" width="768" height="132" fill="#3c5e6b"/><rect x="250" y="150" width="220" height="170" fill="#6b5240"/><path d="M230 150 L360 70 L490 150Z" fill="#3b2a20"/><circle cx="520" cy="300" r="80" fill="none" stroke="#2b1d14" stroke-width="16"/></svg>`,
  'world/saltmarrow-map.webp': `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000"><rect width="1600" height="1000" fill="#d9cfb4"/>
<path d="M0 620 C 300 560, 420 700, 700 640 S 1100 520, 1600 600 L1600 1000 L0 1000Z" fill="#8fb0bf"/>
<path d="M380 0 C 420 200, 520 380, 470 560 S 520 760, 640 1000" stroke="#7fa3b3" stroke-width="38" fill="none"/>
<g fill="#b9ad8c" opacity=".6"><circle cx="1200" cy="250" r="140"/><circle cx="1350" cy="380" r="100"/><circle cx="250" cy="200" r="90"/></g>
<g stroke="#8a7d5d" stroke-width="3" fill="none" opacity=".5"><path d="M700 300 h300 v220 h-300z"/><path d="M820 300 v220 M700 410 h300"/></g>
<text x="1440" y="940" font-family="Georgia" font-size="40" fill="#3c5e6b" font-style="italic">the Marrow Sea</text></svg>`,
};

// Norrgården (genealogy example): a falu-red farm in summer, and portraits styled as old cabinet photographs
const farm = (w, h, sepia = false) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 1600 900">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc2dc"/><stop offset=".55" stop-color="#e7eef0"/><stop offset="1" stop-color="#f4ead2"/></linearGradient>
  <linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9b45a"/><stop offset="1" stop-color="#8d8a3c"/></linearGradient>
  <linearGradient id="hill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f6b45"/><stop offset="1" stop-color="#2f4a33"/></linearGradient>
  <radialGradient id="vig" cx="50%" cy="50%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2a1a0a" stop-opacity=".55"/></radialGradient>
  <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .2  0 0 0 .18 0"/></filter>
</defs>
<rect width="1600" height="900" fill="url(#sky)"/>
<g fill="#fff" opacity=".85"><ellipse cx="300" cy="170" rx="150" ry="34"/><ellipse cx="390" cy="150" rx="110" ry="38"/><ellipse cx="1150" cy="120" rx="170" ry="30"/><ellipse cx="1250" cy="105" rx="90" ry="28"/></g>
<path d="M0 470 C 220 400, 420 430, 640 410 S 1100 380, 1600 430 L1600 620 L0 620Z" fill="#6f8a63" opacity=".7"/>
<path d="M0 520 C 300 470, 520 500, 820 480 S 1300 460, 1600 500 L1600 700 L0 700Z" fill="url(#hill)"/>
<g fill="#24392a">${Array.from({ length: 34 }, (_, i) => { const x = i * 50 - 10, y = 500 - (i % 5) * 8; return `<path d="M${x} ${y + 40} L${x + 22} ${y - 40 - (i % 3) * 14} L${x + 44} ${y + 40}Z"/>`; }).join('')}</g>
<path d="M0 640 C 400 600, 900 620, 1600 590 L1600 900 L0 900Z" fill="url(#field)"/>
<g stroke="#a8963f" stroke-width="3" opacity=".6">${Array.from({ length: 40 }, (_, i) => `<path d="M${i * 42} 900 L${700 + i * 6} 640"/>`).join('')}</g>
<!-- barn -->
<g transform="translate(1040 470)"><rect width="330" height="160" fill="#8e2a1c"/><path d="M-20 0 L165 -95 L350 0Z" fill="#3a2e28"/><rect x="130" y="60" width="70" height="100" fill="#5a1a12"/><path d="M130 60 L200 160 M200 60 L130 160" stroke="#e9e1d0" stroke-width="5"/><rect x="0" y="0" width="8" height="160" fill="#efe8da"/><rect x="322" y="0" width="8" height="160" fill="#efe8da"/></g>
<!-- farmhouse: falu red, white corners and windows -->
<g transform="translate(520 400)">
  <rect width="420" height="230" fill="#9b2f1f"/>
  <g stroke="#7d2417" stroke-width="2">${Array.from({ length: 22 }, (_, i) => `<path d="M${10 + i * 19} 0 V230"/>`).join('')}</g>
  <path d="M-30 4 L210 -120 L450 4Z" fill="#2f2b2a"/><rect x="300" y="-110" width="34" height="70" fill="#7a6a5c"/>
  <rect x="0" y="0" width="12" height="230" fill="#f2ede2"/><rect x="408" y="0" width="12" height="230" fill="#f2ede2"/>
  <g fill="#f2ede2">${[40, 130, 290, 360].map((x) => `<rect x="${x}" y="50" width="52" height="66"/><rect x="${x}" y="140" width="52" height="66"/>`).join('')}</g>
  <g fill="#3b4a55">${[40, 130, 290, 360].map((x) => `<rect x="${x + 6}" y="56" width="18" height="26"/><rect x="${x + 28}" y="56" width="18" height="26"/><rect x="${x + 6}" y="86" width="18" height="24"/><rect x="${x + 28}" y="86" width="18" height="24"/><rect x="${x + 6}" y="146" width="18" height="26"/><rect x="${x + 28}" y="146" width="18" height="26"/><rect x="${x + 6}" y="176" width="18" height="24"/><rect x="${x + 28}" y="176" width="18" height="24"/>`).join('')}</g>
  <rect x="195" y="120" width="60" height="110" fill="#f2ede2"/><rect x="203" y="128" width="44" height="102" fill="#5c3b26"/>
  <path d="M185 120 L225 92 L265 120Z" fill="#f2ede2"/><rect x="175" y="226" width="100" height="10" fill="#9a958a"/>
</g>
<!-- birches -->
${[[360, 380], [430, 420], [1460, 360]].map(([x, y]) => `<g><rect x="${x}" y="${y}" width="14" height="${660 - y}" fill="#f1efe8"/><g stroke="#2a2a2a" stroke-width="4">${Array.from({ length: 8 }, (_, i) => `<path d="M${x} ${y + 30 + i * 30} h${6 + (i % 3) * 3}"/>`).join('')}</g><g fill="#6e9a4c" opacity=".92"><ellipse cx="${x + 7}" cy="${y - 10}" rx="70" ry="95"/><ellipse cx="${x - 25}" cy="${y + 40}" rx="45" ry="60"/><ellipse cx="${x + 40}" cy="${y + 30}" rx="45" ry="65"/></g></g>`).join('')}
<!-- fence -->
<g stroke="#8b7a62" stroke-width="5">${Array.from({ length: 28 }, (_, i) => `<path d="M${i * 60} 700 l40 -46"/>`).join('')}<path d="M0 680 L1600 655" stroke-width="4"/></g>
<rect width="1600" height="900" filter="url(#grain)"/>
<rect width="1600" height="900" fill="url(#vig)"/>
${sepia ? '<rect width="1600" height="900" fill="#704214" opacity=".28" style="mix-blend-mode:color"/>' : ''}
</svg>`;
const photo = (hair, skin, dress, opts = {}) => `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
<defs><radialGradient id="bg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#d8c4a0"/><stop offset="1" stop-color="#6e5434"/></radialGradient>
<radialGradient id="v" cx="50%" cy="45%" r="62%"><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#2b1a08" stop-opacity=".7"/></radialGradient>
<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .3  0 0 0 0 .22  0 0 0 0 .12  0 0 0 .22 0"/></filter></defs>
<rect width="512" height="512" fill="url(#bg)"/>
<path d="M96 512 C 110 400, 180 360, 256 356 C 332 360, 402 400, 416 512Z" fill="${dress}"/>
${opts.collar ? `<path d="M210 372 L256 420 L302 372" fill="none" stroke="#efe6d2" stroke-width="12"/>` : ''}
${opts.scarf ? `<path d="M150 190 Q256 70 362 190 L372 300 Q256 250 140 300Z" fill="${opts.scarf}"/>` : `<path d="M165 230 Q160 120 256 112 Q352 120 347 230 L340 200 Q256 150 172 200Z" fill="${hair}"/>`}
<rect x="232" y="318" width="48" height="50" fill="${skin}"/>
<ellipse cx="256" cy="245" rx="82" ry="100" fill="${skin}"/>
${opts.scarf ? '' : `<path d="M176 205 Q256 140 336 205 Q300 168 256 166 Q212 168 176 205Z" fill="${hair}"/>`}
${opts.beard ? `<path d="M182 265 Q190 350 256 360 Q322 350 330 265 Q300 300 256 302 Q212 300 182 265Z" fill="${hair}"/>` : ''}
<ellipse cx="226" cy="240" rx="8" ry="5" fill="#2a2018"/><ellipse cx="286" cy="240" rx="8" ry="5" fill="#2a2018"/>
<path d="M213 222 q13 -7 26 0 M273 222 q13 -7 26 0" stroke="#3a2a1c" stroke-width="4" fill="none"/>
<path d="M256 250 l-6 30 h12" stroke="#a07a5a" stroke-width="3" fill="none"/>
<path d="M234 ${opts.beard ? 318 : 304} q22 6 44 0" stroke="#7a4a36" stroke-width="4" fill="none"/>
<rect width="512" height="512" filter="url(#n)"/><rect width="512" height="512" fill="url(#v)"/>
<rect width="512" height="512" fill="#704214" opacity=".35" style="mix-blend-mode:color"/>
<rect x="10" y="10" width="492" height="492" fill="none" stroke="#efe3c8" stroke-width="10" opacity=".55"/>
</svg>`;
const norrgarden = {
  'world/norrgarden.webp': farm(1600, 900),
  'places/Norrgården/norrgarden-1890.webp': farm(1200, 675, true),
  'characters/Anna Persdotter/anna.webp': photo('#4a3424', '#e6cfae', '#2c2a2e', { collar: true }),
  'characters/Per Andersson (ca 1812–1867)/per.webp': photo('#8a8278', '#dcc09c', '#3a3330', { beard: true }),
  'characters/Kajsa Jansdotter (1815)/kajsa.webp': photo('#5a4430', '#e2c8a6', '#33302c', { scarf: '#3d3530' }),
  'characters/Johan Persson (1841)/johan.webp': photo('#6b4a2c', '#e4c9a5', '#2e2b28', { collar: true }),
  'characters/Anders Persson (ca 1780)/anders.webp': photo('#b8b0a4', '#d6b996', '#2f2a26', { beard: true }),
  'characters/Erik Svensson/erik.webp': photo('#3a2a1e', '#dcbf98', '#2a2826', { beard: true }),
  'characters/Gustaf Lind (1838)/gustaf.webp': photo('#7a7268', '#dec29e', '#34302c', { collar: true }),
  'characters/Maria Eriksdotter (1870)/maria.webp': photo('#4e3826', '#e8d0b0', '#36302e', { collar: true }),
  'characters/Karl Eriksson (1867)/karl.webp': photo('#5a3e28', '#e0c4a0', '#2c2a28', { collar: true }),
  'characters/Lisa Karlsdotter (ca 1858)/lisa.webp': photo('#6a4e34', '#ecd4b4', '#3a3330', { scarf: '#4a3e36' }),
  'characters/Elsa Maria Berg (1905)/elsa.webp': photo('#3e2c20', '#ecd6b8', '#24303a', { collar: true }),
};
const out = /norrg/i.test(root) ? norrgarden : saltmarrow;
for (const [rel, svg] of Object.entries(out)) {
  const p = `${root}/_assets/${rel}`; mkdirSync(p.replace(/\/[^/]+$/, ''), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(p);
  console.log(p);
}
