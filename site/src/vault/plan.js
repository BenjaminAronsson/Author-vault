// What's left to extract, and what it will cost (deterministic estimate).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { splitFrontmatter } from '../parser/markdown.js';

// Measured on Harry Potter B1 C01–C03 with the two-agent patch pipeline: 94k, 92k, 96k tokens per chapter
// (mostly fixed per-agent overhead). tokens ≈ fixed + perSourceToken × words × 1.35
export const COST = { perSourceToken: 3, fixed: 75000 };

export function plan(worldDir, story, range = 'next') {
  // book chapters live in _sources/<story>/; expansion stories keep their prose in Stories/<story>/Text/
  const src = [join(worldDir, '_sources', story), join(worldDir, 'Stories', story, 'Text')].find((d) => existsSync(d) && readdirSync(d).some((f) => /^C\d+\.md$/.test(f))) ?? join(worldDir, '_sources', story);
  if (!existsSync(src)) throw new Error(`No sources for ${story} (expected ${src})`);
  const all = readdirSync(src).filter((f) => /^C\d+\.md$/.test(f)).sort();
  const storyNote = join(worldDir, 'Stories', story, 'Story.md');
  const done = existsSync(storyNote) ? String(splitFrontmatter(readFileSync(storyNote, 'utf8')).fm.extracted_through ?? '') : '';
  const doneIdx = done ? all.indexOf(`${done.replace(/^.*-/, '')}.md`) : -1;
  let pick;
  if (range === 'next') pick = all.slice(doneIdx + 1, doneIdx + 2);
  else if (range === 'all') pick = all.slice(doneIdx + 1);
  else {
    const m = /^C?(\d+)(?:-C?(\d+))?$/i.exec(range);
    if (!m) throw new Error(`Range must be next, all, C05 or C03-C09 (got ${range})`);
    const a = +m[1], b = +(m[2] ?? m[1]);
    pick = all.filter((f) => { const n = +f.slice(1, -3); return n >= a && n <= b; });
  }
  const chapters = pick.map((f) => {
    const words = readFileSync(join(src, f), 'utf8').split(/\s+/).filter(Boolean).length;
    return { cid: `${story}-${f.slice(0, -3)}`, file: join(src, f), words, redo: all.indexOf(f) <= doneIdx };
  });
  const words = chapters.reduce((a, c) => a + c.words, 0);
  const tokens = Math.round(chapters.reduce((a, c) => a + c.words * 1.35 * COST.perSourceToken + COST.fixed, 0));
  return { story, extractedThrough: done || null, total: all.length, chapters, words, tokens };
}
