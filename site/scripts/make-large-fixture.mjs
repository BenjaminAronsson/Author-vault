// Generates a large synthetic world for scale testing (deterministic).
// usage: node scripts/make-large-fixture.mjs <out-dir>   e.g. fixtures/Large/Longsaga
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const out = argv.find((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--')) ?? 'fixtures/Large/Longsaga';
const NBOOKS = opt('books', 0), NCH = opt('chapters', 0), NCHARS = opt('chars', 140), NMEM = opt('memories', 0), NIMG = opt('images', 0), NVOICE = opt('voice', 0), NPLACES = opt('places', 60);
rmSync(out, { recursive: true, force: true });
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pickN = (a, n) => { const c = [...a], r = []; while (r.length < n && c.length) r.push(c.splice(Math.floor(rnd() * c.length), 1)[0]); return r; };
const w = (rel, s) => { const p = join(out, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, s.trim() + '\n'); };
const L = (xs) => `[${xs.map((x) => `"[[${x}]]"`).join(', ')}]`;

const syl = ['ka', 'ren', 'mor', 'lia', 'tes', 'dun', 'vel', 'ath', 'sor', 'ine', 'bra', 'col', 'mir', 'osh', 'tal', 'wen', 'gar', 'ely', 'fin', 'rho'];
const nameOf = (i) => { const n = syl[i % 20] + syl[Math.floor(i / 20) % 20] + (i % 3 ? syl[(i * 7 + 3) % 20] : '') + (i >= 400 ? syl[Math.floor(i / 400) % 20] : ''); return n[0].toUpperCase() + n.slice(1); };
const chars = Array.from({ length: NCHARS }, (_, i) => nameOf(i + 1)).filter((v, i, a) => a.indexOf(v) === i);
const places = Array.from({ length: NPLACES }, (_, i) => `${['Fort', 'Vale of', 'Port', 'House', 'Tower of', 'Ford of'][i % 6]} ${nameOf(i + 2000)}`).filter((v, i, a) => a.indexOf(v) === i);
const regions = ['The North', 'The Coast', 'The Waste', 'The Capital'];
const TITLES = ['The Salt Crown', 'Ashes of Morrow', 'The Long Winter', 'Tidebreaker', 'The Last Ford', 'Embers', 'The Iron Tide', 'A Crown of Gulls', 'Black Water', 'The Ninth Bell', 'Saltborn', 'The Drowned King'];
const books = NBOOKS ? Array.from({ length: NBOOKS }, (_, i) => [`B${i + 1}`, TITLES[i % TITLES.length] + (i >= TITLES.length ? ` ${Math.floor(i / TITLES.length) + 1}` : ''), NCH || 40])
  : [['B1', 'The Salt Crown', 28], ['B2', 'Ashes of Morrow', 34], ['B3', 'The Long Winter', 40], ['B4', 'Tidebreaker', 31], ['B5', 'The Last Ford', 37], ['B6', 'Embers', 22]];
const core = chars.slice(0, Math.max(18, Math.round(chars.length / 8)));
const events = [];
const appear = {};
const bonds = [['love', 2], ['ally', 1], ['friend', 1], ['rival', -1], ['enemy', -2], ['kin', 2], ['distrust', -1], ['mentor', 1]];

w('World.md', `---\ntype: world\ncanon: book\n---\n# Longsaga\n\n## Overview\nA synthetic six-book saga for scale testing.`);
regions.forEach((r) => w(`Places/${r}.md`, `---\ntype: location\ncanon: book\n---\n# ${r}`));
places.forEach((p, i) => w(`Places/${p}.md`, `---\ntype: location\ncanon: book\npart_of: "[[${regions[i % 4]}]]"\nmap: {x: ${(0.05 + rnd() * 0.9).toFixed(3)}, y: ${(0.05 + rnd() * 0.9).toFixed(3)}}\n---\n# ${p}`));

// Characters: a core cast that recurs, plus many minor ones per book
const tl = Object.fromEntries(chars.map((c) => [c, []]));
const firstSeen = {};
let order = 1;
const chapterIds = [];
for (const [bid, title, n] of books) {
  w(`Stories/${bid}/Story.md`, `---\ntype: story\nstory_id: ${bid}\ntitle: "${title}"\norder: ${order++}\ncontinuity: main\ncanon: book\n---\n# ${title}`);
  const minor = pickN(chars.slice(core.length), Math.max(22, Math.round((chars.length - core.length) / books.length * 1.5)));
  for (let c = 1; c <= n; c++) {
    const cid = `${bid}-C${String(c).padStart(2, '0')}`;
    chapterIds.push(cid);
    const cast = [...pickN(core, 3 + Math.floor(rnd() * 3)), ...pickN(minor, NBOOKS ? 2 + Math.floor(rnd() * 5) : Math.floor(rnd() * 4))];
    for (const ch of cast) (appear[ch] ??= []).push(cid);
    const pls = pickN(places, 1 + Math.floor(rnd() * 2));
    const pov = cast[0];
    for (const ch of cast) {
      firstSeen[ch] ??= cid;
      const tags = [`\`at:[[${pls[0]}]]\``];
      if (rnd() < 0.3) { const other = pick(cast.filter((x) => x !== ch)) ?? pick(core); const [b, v] = pick(bonds); if (other) tags.push(`\`rel:[[${other}]]=${b}/${v}\``); }
      if (rnd() < 0.02 && !core.slice(0, 4).includes(ch)) tags.push('`status:dead`');
      tl[ch].push(`- **${cid}** · \`pov:objective\` · ${tags.join(' · ')} · Something happens to ${ch}. ([[${cid}]])`);
    }
    const ev = rnd() < 0.35 ? [`Event ${cid}`] : [];
    if (ev.length) events.push({ name: ev[0], cid, cast: cast.slice(0, 3) });
    if (ev.length) w(`Events/${ev[0]}.md`, `---\ntype: event\nwhen: ${bid}/C${String(c).padStart(2, '0')}\ncanon: book\nparticipants: ${L(cast.slice(0, 2))}\n---\n# ${ev[0]}\n\n## What happened (objective)\nA turning point in ${title}.`);
    w(`Stories/${bid}/Chapters/${cid}.md`, `---\ntype: chapter\nwhen: ${bid}/C${String(c).padStart(2, '0')}\npov: "[[${pov}]]"\ncanon: book\ncontinuity: main\ncharacters: ${L(cast)}\nplaces: ${L(pls)}\nevents: ${L(ev)}\n---\n# ${cid} — ${pick(['The', 'A'])} ${pick(['Ford', 'Crown', 'Letter', 'Storm', 'Oath', 'Fire', 'Bridge', 'Debt', 'Winter', 'Return'])} ${pick(['at Dusk', 'Broken', 'of Salt', 'Unspoken', 'Again', ''])}\n\n## Summary\n${pov} and ${cast.length - 1} others meet at ${pls[0]}. Chapter ${c} of ${title}.`);
  }
}
// Side stories and a what-if
const sides = [['side-wolves', 'Wolves of the Waste', 'B2-C10', 3], ['side-letters', 'Letters Home', 'B3-C20', 4], ['side-ford', 'Before the Ford', 'B5-C02', 2], ['side-ash', 'Ash and Bone', 'B4-C15', 3]];
for (const [sid, title, after, n] of sides) {
  w(`Stories/${sid}/Story.md`, `---\ntype: story\nstory_id: ${sid}\ntitle: "${title}"\norder: ${order++}\ncontinuity: main\ncanon: expansion\nplacement: "after ${after}"\n---\n# ${title}`);
  for (let c = 1; c <= n; c++) {
    const cid = `${sid}-C${String(c).padStart(2, '0')}`; const cast = pickN(core, 2); const pl = pick(places);
    w(`Stories/${sid}/Chapters/${cid}.md`, `---\ntype: chapter\nwhen: ${sid}/C${String(c).padStart(2, '0')}\npov: "[[${cast[0]}]]"\ncanon: expansion\ncharacters: ${L(cast)}\nplaces: ${L([pl])}\n---\n# ${cid} — ${title} ${c}\n\n## Summary\nA side story.`);
  }
}
w('Stories/what-if-crown/Story.md', `---\ntype: story\nstory_id: what-if-crown\ntitle: "If the Crown Fell"\norder: ${order++}\ncontinuity: what-if-crown\ncanon: expansion\nplacement: "after B2-C20"\n---\n# If the Crown Fell`);
for (let c = 1; c <= 6; c++) {
  const cid = `what-if-crown-C${String(c).padStart(2, '0')}`; const cast = pickN(core, 3);
  w(`Stories/what-if-crown/Chapters/${cid}.md`, `---\ntype: chapter\nwhen: what-if-crown/C${String(c).padStart(2, '0')}\npov: "[[${cast[0]}]]"\ncanon: expansion\ncontinuity: what-if-crown\ncharacters: ${L(cast)}\nplaces: ${L([pick(places)])}\n---\n# ${cid} — Fallen Crown ${c}\n\n## Summary\nWhat if.`);
}
for (const c of chars) {
  if (!firstSeen[c]) continue;
  const img = NIMG && Object.keys(firstSeen).indexOf(c) < NIMG ? `\nimage: "[[${c.toLowerCase()}.svg]]"` : '';
  w(`Characters/${c}/${c}.md`, `---\ntype: character\ncanon: book\nfirst_seen: "[[${firstSeen[c]}]]"\nstatus: alive${img}\n---\n# ${c}\n\n## Goals\n| Goal | Horizon | Status | Since | Source |\n|---|---|---|---|---|\n| Survive the saga | long-term | active | ${firstSeen[c]} | [[${firstSeen[c]}]] |\n\n## Timeline\n${tl[c].join('\n')}`);
}
// Voice files and memories (the bulk of a real extracted vault)
const withVoice = Object.keys(firstSeen).slice(0, NVOICE);
for (const c of withVoice) w(`Characters/${c}/voice.md`, `---\ntype: voice\ncharacter: "[[${c}]]"\n---\n# ${c} — voice\n\n## Quote bank (verbatim, from the book)\n### Angry\n> "Not again, not here." — [[${firstSeen[c]}]]\n### Everyday\n> "Pass the salt." — [[${firstSeen[c]}]]\n\n## Diction\n- **Register:** plain`);
let memCount = 0;
const evNames = new Set(events.map((e) => e.name));
if (NMEM) for (const c of Object.keys(firstSeen)) for (const cid of pickN(appear[c] ?? [], NMEM)) {
  const ev = { name: `Event ${cid}`, cid };
  if (!evNames.has(ev.name)) { evNames.add(ev.name); events.push({ ...ev, cast: [c] }); w(`Events/${ev.name}.md`, `---\ntype: event\nwhen: ${cid.replace(/-C/, '/C')}\ncanon: book\nparticipants: ${L([c])}\n---\n# ${ev.name}\n\n## What happened (objective)\nSomething happened.`); }
  memCount++;
  w(`Characters/${c}/memories/${c} - ${ev.name}.md`, `---\ntype: memory\ncharacter: "[[${c}]]"\nevent: "[[${ev.name}]]"\nwhen: ${ev.cid.replace(/-C/, '/C')}\naccuracy: ${pick(['faithful', 'partial', 'distorted'])}\nemotional_charge: ${pick(['fear', 'shame', 'warmth', 'rage'])}\ncanon: book\n---\n# ${c} remembers: ${ev.name}\n\nI remember the cold, and the shouting, and how nobody looked at me. ${'It went on. '.repeat(20)}\n\n## Divergence from objective\nThey misremember who spoke first.`);
}
// Images: small generated portraits as tiny SVG files (size of real files doesn't matter for parsing)
for (let i = 0; i < NIMG; i++) {
  const c = Object.keys(firstSeen)[i % Object.keys(firstSeen).length];
  w(`_assets/characters/${c}/${c.toLowerCase()}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="hsl(${(i * 37) % 360} 40% 60%)"/></svg>`);
}
// Threads and plots spread across books
for (let i = 0; i < Math.max(45, Math.round(chapterIds.length / 3)); i++) {
  const a = Math.floor(rnd() * (chapterIds.length - 10)); const b = a + 2 + Math.floor(rnd() * 60);
  const closed = rnd() < 0.6 && b < chapterIds.length;
  const kind = rnd() < 0.5 ? 'plot' : 'thread';
  w(`${kind === 'plot' ? 'Plots' : 'Threads'}/${kind === 'plot' ? 'Plot' : 'Thread'} ${nameOf(i + 400)}.md`, `---\ntype: ${kind}\ncanon: ${kind === 'plot' ? 'book' : 'expansion'}\nopened_at: ${chapterIds[a]}\n${closed ? `closed_at: ${chapterIds[b]}\nstatus: resolved` : 'status: open'}\npotential: ${1 + Math.floor(rnd() * 5)}\ncharacters: ${L(pickN(core, 2))}\n---\n# ${kind === 'plot' ? 'Plot' : 'Thread'} ${nameOf(i + 400)}`);
}
console.log(`${out}: ${books.length} books, ${chapterIds.length} book chapters, ${Object.keys(firstSeen).length} characters, ${places.length} places, ${events.length} events, ${withVoice.length} voice files, ${memCount} memories, ${NIMG} images`);
