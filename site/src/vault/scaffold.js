// New worlds, stories and notes from the templates.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { setField, setRaw } from '../lib/frontmatter.js';

const FOLDERS = ['Characters', 'Places', 'Factions', 'Items', 'Concepts', 'Events', 'History', 'Plots', 'Threads', 'Expansions', 'Cultures', 'Languages', 'Religions', 'Creatures', 'Magic', 'Technology', 'Stories', '_sources', '_assets'];
const fill = (t, vars) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, v), t);

export function initWorld(vaultDir, templatesDir, world) {
  const dir = join(vaultDir, world);
  for (const f of FOLDERS) { mkdirSync(join(dir, f), { recursive: true }); if (!existsSync(join(dir, f, '.gitkeep'))) writeFileSync(join(dir, f, '.gitkeep'), ''); } // git keeps empty folders
  const created = [];
  const put = (rel, text) => { const p = join(dir, rel); if (!existsSync(p)) { writeFileSync(p, text); created.push(rel); } };
  put('World.md', fill(readFileSync(join(templatesDir, 'world.md'), 'utf8'), { World: world }));
  put('Concepts/Glossary.md', `---\ntype: concept\nkind: other\nworld: "[[World]]"\ncanon: book\n---\n# Glossary\n\n## Terms\n| Term | Meaning | Source |\n|---|---|---|\n`);
  put('History/Chronology.md', fill(readFileSync(join(templatesDir, 'chronology.md'), 'utf8'), { World: world }));
  put('.gitignore', '.DS_Store\n.obsidian/workspace*.json\n.vault/\n');
  // each world is its own Obsidian vault: shared default settings (hide _sources/ and .vault/, colours, _assets/)
  const ob = join(templatesDir, '..', 'obsidian');
  if (existsSync(ob)) {
    mkdirSync(join(dir, '.obsidian'), { recursive: true });
    for (const f of readdirSync(ob)) if (!existsSync(join(dir, '.obsidian', f))) { copyFileSync(join(ob, f), join(dir, '.obsidian', f)); created.push(`.obsidian/${f}`); }
  }
  return { dir, created };
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
