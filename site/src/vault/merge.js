// Merges two notes that turned out to be one entity (a person at two ancestor numbers, a place spelt two ways).
// Nothing is lost: the dropped note's frontmatter, sections, table rows, voice and memories move into the kept
// note (deduped), its name becomes an alias, conflicting fields become contradictions, and every link in the
// world is pointed at the kept note. Only then is the dropped note removed (the world's git history keeps it).
import { readdirSync, existsSync, rmSync, renameSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { load } from 'js-yaml';
import { setRaw, setField } from '../lib/frontmatter.js';
import { appendToSection, appendToSubsection, upsertTableRow } from './md.js';
import { compareDateClaims } from '../lib/dates.js';
import { sortTimelineByDate, isGenealogy } from './apply.js';

const fmOf = (text) => { const m = /^---\n([\s\S]*?)\n---/.exec(text); try { return (m && load(m[1])) || {}; } catch { return {}; } };
const titleOf = (rel) => basename(rel).replace(/\.md$/, '');
const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const linkTarget = (x) => String(x).replace(/^\[\[|\]\]$/g, '').split(/[|#]/)[0].trim().toLowerCase();
// fields that are bookkeeping, not facts: the kept note's value stands
const OWN = new Set(['type', 'world', 'canon', 'continuity', 'first_seen', 'tags', 'image', 'title']);
const FACTS = new Set(['born', 'died', 'gender', 'sex', 'living']);

/** Body of a note as blocks: { h2, h3, lines } in order (frontmatter and the # title skipped). */
function blocks(text) {
  const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '').split('\n');
  const out = [];
  let cur = null;
  for (const l of body) {
    if (/^# /.test(l)) continue;
    if (/^## /.test(l)) { cur = { h2: l.slice(3).trim(), h3: null, lines: [] }; out.push(cur); continue; }
    if (/^### /.test(l) && cur) { cur = { h2: cur.h2, h3: l.slice(4).trim(), lines: [] }; out.push(cur); continue; }
    if (cur && l.trim()) cur.lines.push(l);
  }
  return out;
}

/** Appends one note's body into another (lines deduped, table rows merged by their first cell). */
function mergeBody(lines, text, skipRow) {
  for (const b of blocks(text)) {
    const table = b.lines.filter((l) => /^\s*\|/.test(l));
    const rest = b.lines.filter((l) => !/^\s*\|/.test(l));
    if (table.length >= 2 && !b.h3) {
      const header = cells(table[0]);
      for (const row of table.slice(2)) {
        const cs = cells(row);
        if (!cs[0] || skipRow(cs[0])) continue;
        upsertTableRow(lines, b.h2, header, Object.fromEntries(header.map((h, i) => [h, cs[i] ?? ''])));
      }
    }
    if (rest.length) b.h3 ? appendToSubsection(lines, b.h2, b.h3, rest) : appendToSection(lines, b.h2, rest);
  }
}

/** Merges note `drop` into note `keep` (names or aliases). Returns { keep, drop, relinked, contradictions }. */
export function mergeNotes(world, keepName, dropName, { why = '' } = {}) {
  const keepRel = world.find(keepName), dropRel = world.find(dropName);
  if (!keepRel) throw new Error(`No note for "${keepName}"`);
  if (!dropRel) throw new Error(`No note for "${dropName}"`);
  if (keepRel === dropRel) throw new Error(`"${keepName}" and "${dropName}" are already the same note`);
  const keep = titleOf(keepRel), drop = titleOf(dropRel);
  // links into the dropped note's own folder ("[[Characters/<drop>/voice]]") now mean the kept note's folder
  const dropText = dirname(dropRel) === '.' ? world.read(dropRel) : world.read(dropRel).split(`${dirname(dropRel)}/`).join(`${dirname(keepRel)}/`);
  const fk = fmOf(world.read(keepRel)), fd = fmOf(dropText);
  const self = new Set([keep.toLowerCase(), drop.toLowerCase()]);
  const contradictions = [];

  // frontmatter: lists are joined, empty fields filled, differing facts recorded
  let text = world.read(keepRel);
  for (const [k, v] of Object.entries(fd)) {
    if (OWN.has(k) || v === '' || v == null || (Array.isArray(v) && !v.length)) continue;
    const cur = fk[k];
    if (Array.isArray(v) || Array.isArray(cur)) {
      const list = (Array.isArray(cur) ? cur : cur ? [cur] : []).map(String);
      const add = (Array.isArray(v) ? v : [v]).map(String).filter((x) => !self.has(linkTarget(x)) && !list.some((y) => linkTarget(y) === linkTarget(x)));
      if (add.length) text = setRaw(text, k, `[${[...list, ...add].map((x) => JSON.stringify(x)).join(', ')}]`);
    } else if (cur === undefined || cur === '' || cur === null) {
      text = typeof v === 'string' ? setField(text, k, v) : setRaw(text, k, JSON.stringify(v));
    } else if (String(cur) !== String(v) && FACTS.has(k)) {
      const cmp = ['born', 'died'].includes(k) ? compareDateClaims(cur, v) : null;
      if (cmp === 'refines') text = setField(text, k, String(v));
      else if (!['coarser', 'same'].includes(cmp)) contradictions.push(`> [!warning] Contradiction · ${k}: "${cur}" (kept) vs "${v}" (from the merged note "${drop}")`);
    }
  }
  const aliases = (Array.isArray(fmOf(text).aliases) ? fmOf(text).aliases : []).map(String);
  const newAliases = [drop, ...(Array.isArray(fd.aliases) ? fd.aliases.map(String) : [])].filter((a) => a.toLowerCase() !== keep.toLowerCase() && !aliases.some((x) => x.toLowerCase() === a.toLowerCase()));
  if (newAliases.length) text = setRaw(text, 'aliases', `[${[...aliases, ...newAliases].map((a) => JSON.stringify(a)).join(', ')}]`);
  world.write(keepRel, text);

  // body: every section, table and subsection
  const skipRow = (first) => self.has(linkTarget(first));
  world.edit(keepRel, (L) => {
    mergeBody(L, dropText, skipRow);
    if (contradictions.length) appendToSection(L, 'Contradictions', contradictions);
    appendToSection(L, 'Merged notes', [`- "${drop}" was the same ${fk.type === 'location' ? 'place' : 'entity'}${why ? `: ${why}` : ''}`]);
    if (isGenealogy(world)) sortTimelineByDate(L);
  });

  // a character's folder: voice merged, memories and other files moved over
  const dropDir = dirname(dropRel), keepDir = dirname(keepRel);
  const folder = dropDir !== '.' && basename(dropDir) === drop && dropDir !== keepDir;
  if (folder) {
    const walk = (d) => readdirSync(world.path(d)).flatMap((n) => (statSync(world.path(join(d, n))).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
    for (const f of walk(dropDir)) {
      if (f === dropRel) continue;
      const to = join(keepDir, f.slice(dropDir.length + 1));
      if (basename(f) === 'voice.md' && existsSync(world.path(to))) world.edit(to, (L) => mergeBody(L, world.read(f), () => false));
      else if (!existsSync(world.path(to))) { world.write(to, world.read(f)); }
    }
  }

  // links everywhere: [[Drop]], [[Drop|shown]], [[Drop#section]]
  const rx = new RegExp(`\\[\\[${esc(drop)}(?=[\\]|#])`, 'g');
  let relinked = 0;
  const files = [];
  const walkAll = (d) => { for (const n of readdirSync(world.path(d))) { if (n.startsWith('.') || n === '_sources') continue; const p = d ? join(d, n) : n; if (statSync(world.path(p)).isDirectory()) walkAll(p); else if (n.endsWith('.md')) files.push(p); } };
  walkAll('');
  for (const f of files) {
    if (f === dropRel || (folder && f.startsWith(`${dropDir}/`))) continue;
    const t = world.read(f);
    if (!rx.test(t)) continue;
    rx.lastIndex = 0;
    let out = t.replace(rx, `[[${keep}`);
    // a link list that now names the kept note twice keeps it once
    const fm = fmOf(out);
    for (const [k, v] of Object.entries(fm)) {
      if (!Array.isArray(v)) continue;
      const seen = new Set();
      const dedup = v.map(String).filter((x) => { const key = linkTarget(x); if (seen.has(key)) return false; seen.add(key); return true; });
      if (dedup.length !== v.length) out = setRaw(out, k, `[${dedup.map((x) => JSON.stringify(x)).join(', ')}]`);
    }
    world.write(f, out);
    relinked++;
  }

  rmSync(world.path(folder ? dropDir : dropRel), { recursive: true, force: true });
  return { keep, drop, relinked, contradictions: contradictions.length };
}
