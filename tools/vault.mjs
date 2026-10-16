#!/usr/bin/env node
// vault — the deterministic side of the author vault. Agents understand and write prose; this does the rest.
//
//   vault plan        <World> <story> [next|all|C05|C03-C09]     chapters to do, words, token estimate
//   vault context     <World> <story> <Cxx> [--for world|characters] [--events-from <patch-a.json>]
//   vault apply       <World> <patch.json> [--story B1 --chapter B1-C03 --canon book|expansion] [--date 1880 (genealogy)]
//   vault lint        <World> [--json] [--touched <file>…]         mechanical continuity checks
//   vault briefing    <World> <Character> --at B1/C05 [--cont main]   /become briefing, cut off exactly
//   vault done        <World> <story> <Cxx> "<summary>"            mark extracted + commit the world repo
//   vault init-world  <World> [--kind genealogy]                    new world (folders, notes, local repo)
//   vault add-story   <World> <id> [--from <dir>] [--title …] [--order N] [--continuity c] [--canon book]
//   vault import-books <World> <convert-output-dir> [B1,B3…]       add stories from an omnibus books.tsv
//   vault add-archive <World> <folder|file…>                        genealogy: add new .txt/.docx/.rtf/.md/.pdf research files
//   vault add-media   <World> <file|folder…> [--depicts "A, B"] [--date 1931] [--place P] [--event E] [--caption …] [--source arkiv-C03]
//                                                                  photos → compressed WebP + tagged Media notes, commits
//   vault merge       <World> <keep> <drop> [--why …]               one entity under two notes: fold drop into keep, relink, commit
//   vault export-gedcom <World> [out.ged] [--include-living]       genealogy: GEDCOM 5.5.1 for Disgen, MyHeritage…
//
// Needs the viewer's dependencies once:  npm install --prefix site
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VAULT = join(ROOT, 'book-universe');
const TEMPLATES = join(VAULT, '_system', 'templates');
const lib = (m) => import(join(ROOT, 'site/src', m));

const argv = process.argv.slice(2);
const flag = (k, d = null) => { const i = argv.indexOf(`--${k}`); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const bool = (k) => { const i = argv.indexOf(`--${k}`); if (i < 0) return false; argv.splice(i, 1); return true; };
const die = (m) => { console.error(m); process.exit(1); };
const worldDir = (w) => { const d = join(VAULT, w ?? die('World name required')); if (!existsSync(join(d, 'World.md'))) die(`No world "${w}" (expected ${d}/World.md)`); return d; };
const cmd = argv.shift();

if (cmd === 'plan') {
  const { plan } = await lib('vault/plan.js');
  const p = plan(worldDir(argv[0]), argv[1] ?? die('story id'), argv[2] ?? 'next');
  console.log(`${p.story}: ${p.total} ${p.archive ? 'source files' : 'chapters'} · extracted through ${p.extractedThrough ?? '—'}`);
  for (const c of p.chapters) console.log(`  ${c.cid}  ${String(c.words).padStart(6)} words${c.redo ? '  (re-extract)' : ''}`);
  console.log(`${p.chapters.length} chapter(s), ${p.words.toLocaleString()} words ≈ ${(p.tokens / 1e6).toFixed(2)} M tokens`);
} else if (cmd === 'context') {
  const { readWorld } = await lib('vault/apply.js');
  const { parseWorld } = await lib('parser/parse.js');
  const { contextPack, chapterSource } = await lib('vault/context.js');
  const forWho = flag('for', 'characters');
  const eventsFrom = flag('events-from');
  const [w, story, c] = argv;
  const dir = worldDir(w);
  const cid = `${story}-${c.replace(/^.*-/, '').toUpperCase()}`;
  const src = chapterSource(dir, story, cid) ?? die(`No source for ${cid}`);
  const model = parseWorld({ world: w, ...readWorld(dir) });
  const n = +cid.match(/C(\d+)$/)[1];
  const prevCid = n > 1 ? `${story}-C${String(n - 1).padStart(2, '0')}` : null;
  let pack = contextPack(model, { cid, sourcePath: src.path.slice(ROOT.length + 1), sourceText: src.text, forWho, prevCid });
  if (eventsFrom && existsSync(eventsFrom)) {
    const a = JSON.parse(readFileSync(eventsFrom, 'utf8'));
    const ev = [...new Set([...(a.chapter?.events ?? []), ...(a.entities ?? []).filter((e) => e.type === 'event').map((e) => e.name)])];
    const cast = a.chapter?.characters ?? [];
    pack = pack.replace(/^(# Context for .*\n.*\n)/, `$1\n## From the chronicler (this chapter)\n- events (link memories to these exact names): ${ev.join(' · ') || '—'}\n- cast: ${cast.join(' · ') || '—'}\n`);
  }
  console.log(pack);
} else if (cmd === 'apply') {
  const { World, applyPatch } = await lib('vault/apply.js');
  const { chapterSource } = await lib('vault/context.js');
  const [w, file] = argv;
  const dir = worldDir(w);
  const patch = JSON.parse(readFileSync(file ?? die('patch file'), 'utf8'));
  const cid = flag('chapter', patch.cid) ?? die('--chapter required (or "cid" in the patch)');
  const story = flag('story', patch.story ?? cid.replace(/-C\d+$/, ''));
  const canon = flag('canon', patch.canon ?? 'book');
  const date = flag('date', patch.date ?? '');
  const src = chapterSource(dir, story, cid);
  const world = new World(dir, TEMPLATES);
  const r = applyPatch(world, patch, { cid, story, canon, date, source: canon === 'book' ? src?.text ?? null : null });
  console.log(`✓ ${cid}: ${r.created.length} created, ${r.updated.length} updated${r.rejectedQuotes.length ? `, ${r.rejectedQuotes.length} quote(s) rejected (not verbatim)` : ''}`);
  for (const q of r.rejectedQuotes) console.log(`  ✗ ${q.where} · ${q.who}: "${String(q.text).slice(0, 80)}"`);
  for (const w of r.warnings ?? []) console.log(`  ! ${w}`);
} else if (cmd === 'lint') {
  const { readWorld } = await lib('vault/apply.js');
  const { parseWorld } = await lib('parser/parse.js');
  const { lint } = await lib('vault/lint.js');
  const json = bool('json');
  const ti = argv.indexOf('--touched');
  const touched = ti >= 0 ? new Set(argv.splice(ti).slice(1)) : null;
  const res = lint(parseWorld({ world: argv[0], ...readWorld(worldDir(argv[0])) }), { touched });
  if (json) console.log(JSON.stringify(res, null, 1));
  else {
    const by = (list) => Object.entries(list.reduce((a, i) => ((a[i.kind] = (a[i.kind] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none';
    console.log(`mechanical: ${by(res.mechanical)}\njudgment:   ${by(res.judgment)}`);
    for (const i of res.judgment.slice(0, 30)) console.log(`  ? ${i.kind} · ${i.path} — ${i.msg}`);
  }
} else if (cmd === 'briefing') {
  const { readWorld } = await lib('vault/apply.js');
  const { parseWorld } = await lib('parser/parse.js');
  const { briefing } = await lib('vault/briefing.js');
  const at = flag('at'), cont = flag('cont', 'main');
  console.log(briefing(parseWorld({ world: argv[0], ...readWorld(worldDir(argv[0])) }), argv[1] ?? die('character'), { at, cont }));
} else if (cmd === 'done') {
  const { setField } = await lib('lib/frontmatter.js');
  const [w, story, c, msg] = argv;
  const dir = worldDir(w);
  const cid = `${story}-${c.replace(/^.*-/, '').toUpperCase()}`;
  const note = join(dir, 'Stories', story, 'Story.md');
  writeFileSync(note, setField(readFileSync(note, 'utf8'), 'extracted_through', cid.replace(/^.*-/, '')));
  execFileSync(join(ROOT, 'tools/world-repo.sh'), ['commit', w, `${cid} extracted${msg ? `: ${msg}` : ''}`], { stdio: 'inherit' });
} else if (cmd === 'init-world') {
  const { initWorld } = await lib('vault/scaffold.js');
  const w = argv[0] ?? die('World name');
  const r = initWorld(VAULT, TEMPLATES, w, { kind: flag('kind', '') });
  console.log(`✓ ${w}: ${r.created.length} notes created`);
  execFileSync(join(ROOT, 'tools/world-repo.sh'), ['init', w], { stdio: 'inherit' });
} else if (cmd === 'add-story') {
  const { addStory } = await lib('vault/scaffold.js');
  const [w, id] = argv;
  const r = addStory(worldDir(w), TEMPLATES, id ?? die('story id'), { from: flag('from'), title: flag('title', id), order: +flag('order', 1), continuity: flag('continuity', 'main'), canon: flag('canon', 'book'), placement: flag('placement', ''), language: flag('language', '') });
  console.log(`✓ ${w} › ${r.id}: ${r.chapters} chapter source(s)${r.moved ? ` (${r.moved} files moved in)` : ''}`);
} else if (cmd === 'import-books') {
  const { addStory, readBooks } = await lib('vault/scaffold.js');
  const [w, out, only] = argv;
  const dir = worldDir(w);
  const books = readBooks(join(out ?? die('convert output dir'), 'books.tsv')).filter((b) => !only || only.split(',').includes(b.id));
  books.forEach((b, i) => { const r = addStory(dir, TEMPLATES, b.id, { from: join(out, b.id), title: b.title, order: i + 1 }); console.log(`✓ ${b.id} ${b.title}: ${r.chapters} chapters`); });
} else if (cmd === 'add-archive') {
  const { addArchive } = await lib('vault/scaffold.js');
  const [w, ...inputs] = argv;
  const dir = worldDir(w);
  const OK = /\.(txt|md|docx|rtf|pdf)$/i;
  const walk = (p) => (statSync(p).isDirectory() ? readdirSync(p).sort().filter((n) => !n.startsWith('.')).flatMap((n) => walk(join(p, n))) : [p]);
  const paths = (inputs.length ? inputs : die('folder or files')).flatMap((p) => walk(resolve(p)));
  for (const p of paths.filter((p) => !OK.test(p))) console.log(`  ! skipped ${p} (${/\.doc$/i.test(p) ? 'old .doc: save it as .docx' : 'not .txt/.md/.docx/.rtf/.pdf'})`);
  const tmp = mkdtempSync(join(tmpdir(), 'archive-'));
  const files = paths.filter((p) => OK.test(p)).map((p, i) => {
    const out = join(tmp, String(i));
    execFileSync('python3', ['-I', join(ROOT, '.claude/skills/import-book/convert.py'), p, out, '--whole'], { stdio: ['ignore', 'ignore', 'pipe'] }); // stderr is in the error if it fails
    const media = existsSync(join(out, 'media')) ? readdirSync(join(out, 'media')).map((n) => join(out, 'media', n)) : [];
    return { path: p, text: readFileSync(join(out, '_full.md'), 'utf8'), media };
  });
  const r = addArchive(dir, TEMPLATES, files);
  rmSync(tmp, { recursive: true, force: true });
  for (const a of r.added) console.log(`✓ ${a.cid}  ${a.file}${a.images ? `  · ${a.images} image(s)` : ''}${a.replaces ? `  (new version of ${a.replaces})` : ''}`);
  console.log(`${r.added.length} added, ${r.skipped.length} already in the archive`);
} else if (cmd === 'add-media') {
  const { addMedia, collectMedia } = await lib('vault/media.js');
  const { createRequire } = await import('node:module');
  const sharp = createRequire(join(ROOT, 'site/package.json'))('sharp');
  const opts = {
    depicts: (flag('depicts', '') ?? '').split(/\s*[,;]\s*/).filter(Boolean), date: flag('date'), place: flag('place'), event: flag('event'),
    caption: flag('caption', ''), source: flag('source'), canon: flag('canon', 'book'), sharp,
  };
  const noCommit = bool('no-commit');
  const [w, ...paths] = argv;
  const dir = worldDir(w);
  const files = collectMedia(paths.length ? paths : die('file or folder required'));
  if (!files.length) die('No pictures found (jpg, png, webp, gif, avif, tif, heic)');
  let bin = 0, bout = 0;
  for (const f of files) {
    const r = await addMedia(dir, f, opts);
    bin += r.bytesIn; bout += r.bytesOut;
    console.log(`  + ${r.note}${r.date ? ` · ${r.date}` : ''} · ${(r.bytesIn / 1024).toFixed(0)} → ${(r.bytesOut / 1024).toFixed(0)} KB`);
  }
  console.log(`${files.length} photo(s), ${(bin / 1048576).toFixed(1)} → ${(bout / 1048576).toFixed(1)} MB. Tag who is in each: edit \`depicts:\` in the Media notes.`);
  if (!noCommit) execFileSync(join(ROOT, 'tools/world-repo.sh'), ['commit', w, `${files.length} photo(s) added`], { stdio: 'inherit' });
} else if (cmd === 'merge') {
  const { World } = await lib('vault/apply.js');
  const { mergeNotes } = await lib('vault/merge.js');
  const [w, keep, drop] = argv;
  if (!drop) die('usage: vault merge <World> "<keep>" "<drop>" [--why "…"] [--no-commit]');
  const r = mergeNotes(new World(worldDir(w), TEMPLATES), keep, drop, { why: flag('why', '') });
  console.log(`✓ ${r.drop} → ${r.keep}: ${r.relinked} note(s) relinked${r.contradictions ? `, ${r.contradictions} contradiction(s) recorded` : ''}`);
  if (!bool('no-commit')) execFileSync(join(ROOT, 'tools/world-repo.sh'), ['commit', w, `merge: ${r.drop} → ${r.keep}`], { stdio: 'inherit' });
} else if (cmd === 'export-gedcom') {
  const { readWorld } = await lib('vault/apply.js');
  const { parseWorld } = await lib('parser/parse.js');
  const { toGedcom } = await lib('vault/gedcom.js');
  const includeLiving = bool('include-living');
  const [w, out] = argv;
  const model = parseWorld({ world: w, ...readWorld(worldDir(w)) });
  if (!model.genealogy) die(`${w} is not a genealogy world (World.md kind: genealogy)`);
  const ged = toGedcom(model, { includeLiving });
  const file = out ?? `${w}.ged`;
  writeFileSync(file, ged);
  const n = (rx) => (ged.match(rx) ?? []).length;
  console.log(`✓ ${file}: ${n(/^0 @I\d+@ INDI$/gm)} people, ${n(/^0 @F\d+@ FAM$/gm)} families, ${n(/^0 @S\d+@ SOUR$/gm)} sources${includeLiving ? '' : ' (living people left out)'}`);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 17).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
  process.exit(cmd ? 1 : 0);
}
