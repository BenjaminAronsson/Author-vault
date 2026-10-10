// Regenerates the placeholder images of the Sample fixture world.
// usage: node scripts/make-sample-images.mjs fixtures/Sample/Saltmarrow
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
const out = {
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
for (const [rel, svg] of Object.entries(out)) {
  const p = `${root}/_assets/${rel}`; mkdirSync(p.replace(/\/[^/]+$/, ''), { recursive: true });
  await sharp(Buffer.from(svg)).webp({ quality: 80 }).toFile(p);
  console.log(p);
}
