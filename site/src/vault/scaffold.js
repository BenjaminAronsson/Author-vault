// New worlds, stories and notes from the templates.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { setField, setRaw } from '../lib/frontmatter.js';

const FOLDERS = ['Characters', 'Places', 'Factions', 'Items', 'Concepts', 'Events', 'History', 'Plots', 'Threads', 'Expansions', 'Cultures', 'Languages', 'Religions', 'Creatures', 'Magic', 'Technology', 'Stories', '_sources', '_assets'];
const fill = (t, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), t);

export function initWorld(vaultDir, templatesDir, world, { kind = '' } = {}) {
  const dir = join(vaultDir, world);
  for (const f of FOLDERS) { mkdirSync(join(dir, f), { recursive: true }); if (!existsSync(join(dir, f, '.gitkeep'))) writeFileSync(join(dir, f, '.gitkeep'), ''); } // git keeps empty folders
  const created = [];
  const put = (rel, text) => { const p = join(dir, rel); if (!existsSync(p)) { writeFileSync(p, text); created.push(rel); } };
  let wt = fill(readFileSync(join(templatesDir, 'world.md'), 'utf8'), { World: world });
  if (kind) wt = setRaw(wt, 'kind', kind); // genealogy: steps are dates, sources are an archive (SCHEMA › Archive & kinship)
  put('World.md', wt);
  put('Concepts/Glossary.md', `---\ntype: concept\nkind: other\nworld: "[[World]]"\ncanon: book\n---\n# Glossary\n\n## Terms\n| Term | Meaning | Source |\n|---|---|---|\n`);
  put('History/Chronology.md', fill(readFileSync(join(templatesDir, 'chronology.md'), 'utf8'), { World: world }));
  put('.gitignore', '.DS_Store\n.obsidian/workspace*.json\n.vault/\n');
  // each world is its own Obsidian vault: shared default settings (hide _sources/ and .vault/, colours, _assets/)
  const ob = join(templatesDir, '..', 'obsidian');
  if (existsSync(ob)) {
    mkdirSync(join(dir, '.obsidian'), { recursive: true });
    for (const f of readdirSync(ob)) if (!existsSync(join(dir, '.obsidian', f))) { copyFileSync(join(ob, f), join(dir, '.obsidian', f)); created.push(`.obsidian/${f}`); }
  }
  if (kind === 'genealogy') { addStory(dir, templatesDir, ARCHIVE, { title: 'Arkiv', order: 0 }); if (!created.includes('Stories/arkiv/Story.md')) created.push('Stories/arkiv/Story.md'); }
  return { dir, created };
}

export const ARCHIVE = 'arkiv';
const sha = (b) => createHash('sha1').update(b).digest('hex').slice(0, 12);
const INDEX = (worldDir) => join(worldDir, '_sources', ARCHIVE, 'index.tsv');

/** The archive's file index: [{ cid: 'arkiv-C03', num: 'C03', file, hash }] */
export function readArchive(worldDir) {
  if (!existsSync(INDEX(worldDir))) return [];
  return readFileSync(INDEX(worldDir), 'utf8').trim().split('\n').slice(1).filter(Boolean).map((l) => { const [num, file, hash] = l.split('\t'); return { cid: `${ARCHIVE}-${num}`, num, file, hash }; });
}

/**
 * Adds research files to a genealogy world's archive (append-only). Each new or changed file becomes the next
 * source C<nn>.md, starting with "# <file name>"; the original is kept in _sources/arkiv/original/.
 * Identical content already in the archive is skipped, so re-running on a growing folder only adds what's new.
 * files = [{ path: original file, text: converted markdown, media?: [image paths embedded in it] }]
 */
export function addArchive(worldDir, templatesDir, files) {
  const src = join(worldDir, '_sources', ARCHIVE);
  mkdirSync(join(src, 'original'), { recursive: true });
  if (!existsSync(join(worldDir, 'Stories', ARCHIVE, 'Story.md'))) addStory(worldDir, templatesDir, ARCHIVE, { title: 'Arkiv', order: 0 });
  const index = readArchive(worldDir);
  const known = new Set(index.map((x) => x.hash));
  let n = index.reduce((a, x) => Math.max(a, +x.num.slice(1)), 0);
  const added = [], skipped = [];
  for (const f of files) {
    const hash = sha(readFileSync(f.path));
    const file = basename(f.path);
    if (known.has(hash)) { skipped.push(file); continue; }
    const num = `C${String(++n).padStart(2, '0')}`;
    const prev = index.filter((x) => x.file === file).at(-1);
    const head = [`# ${file}`, prev ? `_Ny version av ${prev.cid}._` : null].filter(Boolean).join('\n');
    // images embedded in the file (photos, scans) go to _assets/sources/<cid>/ and are linked at the end of the source
    const imgs = [];
    for (const m of f.media ?? []) {
      const d = join(worldDir, '_assets', 'sources', `${ARCHIVE}-${num}`);
      mkdirSync(d, { recursive: true });
      const name = `${ARCHIVE}-${num}-${basename(m)}`;
      copyFileSync(m, join(d, name));
      imgs.push(name);
    }
    const pics = imgs.length ? `\n\n## Bilder i filen\n${imgs.map((n) => `![[${n}]]`).join('\n')}` : '';
    writeFileSync(join(src, `${num}.md`), `${head}\n\n${f.text.trim()}${pics}\n`);
    copyFileSync(f.path, join(src, 'original', `${num}-${file}`));
    index.push({ cid: `${ARCHIVE}-${num}`, num, file, hash });
    known.add(hash);
    added.push({ cid: `${ARCHIVE}-${num}`, file, replaces: prev?.cid ?? null, ...(imgs.length ? { images: imgs.length } : {}) });
  }
  writeFileSync(INDEX(worldDir), ['num\tfile\thash', ...index.map((x) => `${x.num}\t${x.file}\t${x.hash}`)].join('\n') + '\n');
  return { added, skipped };
}

/** Adds a story: moves/copies chapter files into _sources/<id>/ (from a convert.py output dir) and writes Story.md. */
export function addStory(worldDir, templatesDir, id, { from = null, title = id, order = 1, continuity = 'main', canon = 'book', placement = '', language = '' } = {}) {
  const src = join(worldDir, '_sources', id);
  mkdirSync(src, { recursive: true });
  let moved = 0;
  if (from) for (const f of readdirSync(from)) if (/^(C\d+|_front)\.md$/.test(f)) { moveFile(join(from, f), join(src, f)); moved++; }
  const sdir = join(worldDir, 'Stories', id);
  mkdirSync(join(sdir, 'Chapters'), { recursive: true });
  let t = fill(readFileSync(join(templatesDir, 'story.md'), 'utf8'), { World: worldDir.split('/').filter(Boolean).pop(), title });
  if (id === ARCHIVE) t = setField(t, 'kind', 'archive'); // sources, not a reading order: never steps on the clock
  for (const [k, v] of Object.entries({ story_id: id, title, continuity, canon, placement, language })) t = setField(t, k, String(v));
  t = setRaw(t, 'order', String(order));
  t = setField(t, 'extracted_through', '');
  if (!existsSync(join(sdir, 'Story.md'))) writeFileSync(join(sdir, 'Story.md'), t);
  return { id, moved, chapters: readdirSync(src).filter((f) => /^C\d+\.md$/.test(f)).length };
}

/** Parses convert.py's books.tsv → [{ id, title, chapters, words }] */
export function readBooks(tsvPath) {
  return readFileSync(tsvPath, 'utf8').trim().split('\n').slice(1).map((l) => { const [id, title, chapters, words] = l.split('\t'); return { id, title, chapters: +chapters, words: +words }; });
}

/** rename, falling back to copy+delete across filesystems (EXDEV) */
function moveFile(a, b) {
  try { renameSync(a, b); } catch (e) { if (e.code !== 'EXDEV') throw e; copyFileSync(a, b); unlinkSync(a); }
}
