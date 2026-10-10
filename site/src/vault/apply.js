// Applies an agent's chapter patch to a world folder. The only code that writes notes during extraction.
// Append-only (lines are added; a table cell may be updated), idempotent, exact schema formatting,
// verbatim-checked quotes, two-sided relations.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { load } from 'js-yaml';
import { parseWorld } from '../parser/parse.js';
import { setField, setRaw } from '../lib/frontmatter.js';
import { appendToSection, appendToSubsection, upsertTableRow, stripPlaceholders, norm } from './md.js';

export const TYPE_DIR = {
  character: 'Characters', location: 'Places', place: 'Places', faction: 'Factions', item: 'Items', concept: 'Concepts',
  event: 'Events', era: 'History', creature: 'Creatures', religion: 'Religions', culture: 'Cultures', language: 'Languages',
  magic: 'Magic', technology: 'Technology', plot: 'Plots', thread: 'Threads',
};
const TEMPLATE = { place: 'location' };
const HEADERS = {
  Goals: ['Goal', 'Horizon', 'Status', 'Since', 'Source'],
  Fears: ['Fear', 'Root (where it comes from)', 'How it shows', 'Source'],
  Relations: ['With', 'Bond (family / love / rival / ally / enemy …)', 'What they feel', 'What the other feels back', 'Changes over time'],
};
/** One spelling per name: straight apostrophes/quotes, no characters that break file names or links. */
export const canonName = (s) => String(s).replace(/[’‘`´]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const safeName = (s) => canonName(s).replace(/[\\/:*?"<>|#^[\]]/g, '').trim();
const link = (n) => `[[${canonName(n)}]]`;
const quoteNorm = (s) => String(s).replace(/[“”«»„"]/g, '"').replace(/[‘’`]/g, "'").replace(/[—–]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

export function readWorld(dir) {
  const files = [], images = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      if (n.startsWith('.') || n === '_sources') continue;
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith('.md')) files.push({ path: p.slice(dir.length + 1).split('\\').join('/'), text: readFileSync(p, 'utf8') });
      else if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(n)) images.push(p.slice(dir.length + 1));
    }
  };
  walk(dir);
  return { files, images };
}

export class World {
  constructor(dir, templatesDir) {
    this.dir = dir;
    this.templatesDir = templatesDir;
    this.name = dir.split('/').filter(Boolean).pop();
    this.reload();
    this.changed = new Set();
    this.created = [];
  }
  reload() { this.model = parseWorld({ world: this.name, ...readWorld(this.dir) }); }
  path(rel) { return join(this.dir, rel); }
  read(rel) { return readFileSync(this.path(rel), 'utf8'); }
  write(rel, text) { mkdirSync(dirname(this.path(rel)), { recursive: true }); writeFileSync(this.path(rel), text.endsWith('\n') ? text : text + '\n'); this.changed.add(rel); }
  /** existing note path for a name or alias (case-insensitive), else null */
  find(name) {
    const id = this.model.nameIndex[canonName(name).toLowerCase()] ?? this.model.nameIndex[String(name).toLowerCase().trim()];
    return id ? this.model.entities[id]?.path ?? null : null;
  }
  template(type) {
    const f = join(this.templatesDir, `${TEMPLATE[type] ?? type}.md`);
    return existsSync(f) ? readFileSync(f, 'utf8') : `---\ntype: ${type}\n---\n# {{Name}}\n`;
  }
  /** Path of the note for `name`, creating it from the template if missing. */
  ensure(name, type, { cid, canon = 'book', aliases = [], fields = {} } = {}) {
    const found = this.find(name) ?? aliases.map((a) => this.find(a)).find(Boolean);
    if (found) return found;
    const n = safeName(name);
    const rel = type === 'character' ? `Characters/${n}/${n}.md` : `${TYPE_DIR[type] ?? 'Concepts'}/${n}.md`;
    let text = stripPlaceholders(this.template(type).replace(/\{\{World\}\}/g, this.name).replace(/\{\{(Name|Event|Era|Language|Culture|Religion|Creature|Magic|Technology|Plot|Thread)\}\}/g, n));
    text = setRaw(text, 'canon', canon);
    if (cid) { text = setField(text, 'first_seen', link(cid)); text = setRaw(text, 'sources', `[${JSON.stringify(link(cid))}]`); }
    if (aliases.length) text = setRaw(text, 'aliases', `[${aliases.map((a) => JSON.stringify(a)).join(', ')}]`);
    for (const [k, v] of Object.entries(fields)) text = typeof v === 'string' ? setField(text, k, v) : setRaw(text, k, JSON.stringify(v));
    this.write(rel, text);
    this.created.push(rel);
    if (type === 'character') {
      const vrel = `Characters/${n}/voice.md`;
      if (!existsSync(this.path(vrel))) { this.write(vrel, stripPlaceholders(this.template('voice').replace(/\{\{World\}\}/g, this.name).replace(/\{\{Name\}\}/g, n))); this.created.push(vrel); }
    }
    // index it right away so later items in the same patch resolve to it
    const id = rel.replace(/\.md$/, '');
    this.model.entities[id] = { id, path: rel, title: n, name: n, type, aliases, fm: {} };
    for (const k of [n, ...aliases]) this.model.nameIndex[canonName(k).toLowerCase()] ??= id;
    return rel;
  }
  /** Adds aliases and a source citation to a note's frontmatter (deduped). */
  touchFrontmatter(rel, { aliases = [], cid } = {}) {
    let text = this.read(rel);
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    let fm = {};
    try { fm = (m && load(m[1])) || {}; } catch { /* keep text as is */ }
    const cur = Array.isArray(fm.aliases) ? fm.aliases.map(String) : [];
    const add = aliases.filter((a) => a && !cur.some((c) => c.toLowerCase() === a.toLowerCase()) && a.toLowerCase() !== (fm.title ?? rel.split('/').pop().replace(/\.md$/, '')).toLowerCase());
    if (add.length) text = setRaw(text, 'aliases', `[${[...cur, ...add].map((a) => JSON.stringify(a)).join(', ')}]`);
    if (cid) {
      const src = Array.isArray(fm.sources) ? fm.sources.map(String) : [];
      if (!src.includes(link(cid))) text = setRaw(text, 'sources', `[${[...src, link(cid)].map((s) => JSON.stringify(s)).join(', ')}]`);
    }
    if (add.length || cid) this.write(rel, text);
    for (const a of add) this.model.nameIndex[a.toLowerCase()] ??= rel.replace(/\.md$/, '');
  }
  edit(rel, fn) { const lines = this.read(rel).split('\n'); const before = lines.join('\n'); fn(lines); const after = lines.join('\n'); if (after !== before) this.write(rel, after); }
}

/** Voice file and memories folder for any note: Characters/<N>/voice.md, or "<dir>/<N> - voice.md" for e.g. a talking creature. */
export function speakerPaths(rel) {
  const parts = rel.split('/');
  const n = parts.at(-1).replace(/\.md$/, '');
  if (parts[0] === 'Characters' && parts.length === 3) return { name: n, voice: `Characters/${n}/voice.md`, memories: `Characters/${n}/memories` };
  const dir = parts.slice(0, -1).join('/');
  return { name: n, voice: `${dir}/${n} - voice.md`, memories: `${dir}/${n} - memories` };
}

/** "- **B1-C03** · `pov:objective` · `at:[[X]]` · … · text ([[B1-C03]])" — the exact format the parser reads. */
export function timelineLine(cid, t) {
  const tags = [`\`pov:${t.pov ?? 'objective'}\``];
  if (t.canon && t.canon !== 'book') tags.push(`\`canon:${t.canon}\``);
  if (t.at) tags.push(`\`at:${link(t.at)}\``);
  for (const r of t.rel ?? []) tags.push(`\`rel:${link(r.to)}=${String(r.bond ?? 'tie').replace(/[/`]/g, ' ')}/${Math.max(-2, Math.min(2, Math.round(Number(r.n) || 0)))}\``);
  if (t.status) tags.push(`\`status:${t.status}\``);
  for (const g of t.goal ?? []) tags.push(`\`goal:"${String(g.goal).replace(/"/g, "'")}"=${g.status}\``);
  return `- **${cid}** · ${tags.join(' · ')} · ${String(t.text ?? '').trim()} (${link(cid)})`;
}

/**
 * patch = { chapter?, entities?, timeline?, rows?, items?, paragraphs?, quotes?, memories?, perspectives?, glossary? }
 * opts = { cid: 'B1-C03', story: 'B1', canon: 'book'|'expansion', source: <chapter text for quote checks> }
 */
export function applyPatch(world, patch, opts) {
  const { cid, story, canon = 'book', source = null } = opts;
  const report = { created: [], updated: [], rejectedQuotes: [], warnings: [] };
  const typeOf = {};
  for (const e of patch.entities ?? []) typeOf[e.name.toLowerCase()] = e.type;
  const guessType = (name, fallback = 'character') => typeOf[String(name).toLowerCase()] ?? (world.find(name) ? null : fallback);
  const ent = (name, fallbackType = 'character') => world.ensure(name, guessType(name, fallbackType) ?? fallbackType, { cid, canon });
  const verbatim = (text) => !source || quoteNorm(source).includes(quoteNorm(text).replace(/^"|"$/g, ''));

  // entities first (types, aliases, fields)
  for (const e of patch.entities ?? []) {
    const rel = world.ensure(e.name, e.type ?? 'character', { cid, canon, aliases: e.aliases ?? [], fields: e.fields ?? {} });
    world.touchFrontmatter(rel, { aliases: e.aliases ?? [], cid });
  }

  // chapter note
  if (patch.chapter) {
    const c = patch.chapter;
    const rel = `Stories/${story}/Chapters/${cid}.md`;
    const list = (xs) => `[${(xs ?? []).map((x) => JSON.stringify(link(x))).join(', ')}]`;
    const keyLines = (c.key_lines ?? []).filter((k) => {
      if (verbatim(k.text)) return true;
      report.rejectedQuotes.push({ where: 'chapter key line', who: k.who, text: k.text });
      return false;
    });
    for (const n of [...(c.characters ?? [])]) ent(n, 'character');
    for (const n of [...(c.places ?? [])]) ent(n, 'location');
    for (const n of [...(c.events ?? [])]) ent(n, 'event');
    const fm = ['---', 'type: chapter', 'world: "[[World]]"', `story: "[[Stories/${story}/Story|${story}]]"`, `when: ${cid.replace(/-(C\d+)$/, '/$1')}`,
      `pov: "${c.pov && (c.characters ?? []).some((x) => canonName(x) === canonName(c.pov)) ? link(c.pov) : String(c.pov ?? '').replace(/"/g, "'")}"`, `canon: ${canon}`, 'continuity: main', `characters: ${list(c.characters)}`, `places: ${list(c.places)}`,
      `events: ${list(c.events)}`, 'tags: [chapter]', '---'];
    const body = [`# ${cid} — ${c.title ?? ''}`.trim(), '', '## Summary', String(c.summary ?? '').trim(), '',
      '## Scenes', ...(c.scenes ?? []).map((s, i) => `${i + 1}. ${s}`), '',
      '## Key lines', ...keyLines.map((k) => `> "${k.text}" — ${world.find(k.who) || (c.characters ?? []).some((x) => canonName(x) === canonName(k.who)) ? link(k.who) : k.who}`), '',
      '## State changes', ...(c.state_changes ?? []).map((s) => `- ${s}`), '',
      '## Threads opened / closed', ...(c.threads ?? []).map((s) => `- ${s}`), ''];
    world.write(rel, [...fm, ...body].join('\n'));
    report.updated.push(rel);
  }

  // timeline lines (also creates missing at:/rel: targets, two-sided relations)
  for (const t of patch.timeline ?? []) {
    const rel = ent(t.entity);
    if (t.at) ent(t.at, 'location');
    for (const r of t.rel ?? []) {
      const other = ent(r.to, 'character');
      // two-sided: the other side gets a Relations row noting this feeling
      if (guessType(r.to) !== null || world.find(r.to)) {
        const otherType = world.model.entities[other.replace(/\.md$/, '')]?.type;
        if (otherType === 'character' || !otherType) world.edit(other, (L) => upsertTableRow(L, 'Relations', HEADERS.Relations, { With: link(t.entity), 'What the other feels back': `${r.bond}` }));
      }
      world.edit(rel, (L) => upsertTableRow(L, 'Relations', HEADERS.Relations, { With: link(r.to), Bond: r.bond, 'What they feel': r.feels ?? '' }, { update: ['What they feel'] }));
    }
    world.edit(rel, (L) => appendToSection(L, 'Timeline', [timelineLine(cid, { canon, ...t })]));
    world.touchFrontmatter(rel, { cid });
  }

  // table rows (Goals, Fears, Relations, …): add, or update only the listed columns of an existing row
  for (const r of patch.rows ?? []) {
    const rel = ent(r.entity);
    const header = HEADERS[r.section] ?? Object.keys(r.row);
    const row = { ...r.row };
    if (r.section === 'Goals') { row.Since ??= cid; row.Source ??= link(cid); }
    if (r.section === 'Fears') row.Source ??= link(cid);
    if (r.section === 'Relations' && row.With) {
      const otherName = String(row.With).replace(/^\[\[|\]\]$/g, '').split('|')[0];
      const other = ent(otherName, 'character');
      row.With = link(otherName);
      const feel = row['What they feel'] ?? row.Bond ?? '';
      if (world.model.entities[other.replace(/\.md$/, '')]?.type === 'character' || other.startsWith('Characters/'))
        world.edit(other, (L) => upsertTableRow(L, 'Relations', HEADERS.Relations, { With: link(r.entity), 'What the other feels back': feel }));
    }
    const res = world.edit(rel, (L) => upsertTableRow(L, r.section, header, row, { update: r.update ?? (r.section === 'Goals' ? ['Status'] : []) }));
    // a status change is also history: log it on the timeline
    if (r.section === 'Goals' && row.Status && row.Status !== 'active') world.edit(rel, (L) => appendToSection(L, 'Timeline', [timelineLine(cid, { canon, goal: [{ goal: row.Goal, status: row.Status }], text: `Goal “${row.Goal}”: ${row.Status}.` })]));
  }

  // list items and paragraphs
  for (const it of patch.items ?? []) {
    const rel = ent(it.entity);
    world.edit(rel, (L) => appendToSection(L, it.section, [`- ${String(it.text).trim()} (${link(cid)})`]));
  }
  const voiceOf = (name) => {
    const rel = ent(name, 'character');
    const { voice: vrel, name: n } = speakerPaths(rel);
    if (!existsSync(world.path(vrel))) {
      world.write(vrel, stripPlaceholders(world.template('voice').replace(/\{\{World\}\}/g, world.name).replace(/\{\{Name\}\}/g, n)));
      world.created.push(vrel);
    }
    return vrel;
  };
  for (const p of patch.paragraphs ?? []) {
    const isVoice = /\/voice$/i.test(p.entity);
    const isWorld = String(p.entity).toLowerCase() === world.name.toLowerCase() || p.type === 'world';
    const rel = isVoice ? voiceOf(p.entity.replace(/\/voice$/i, '')) : isWorld ? 'World.md' : ent(p.entity, p.type ?? 'character');
    world.edit(rel, (L) => appendToSection(L, p.section, [`${String(p.text).trim()} (${link(cid)})`]));
  }

  // quotes → voice.md (verbatim only)
  for (const q of patch.quotes ?? []) {
    if (!verbatim(q.text)) { report.rejectedQuotes.push({ where: 'voice', who: q.character, text: q.text }); continue; }
    const vrel = voiceOf(q.character);
    const mood = String(q.mood ?? 'Everyday').replace(/^\w/, (c) => c.toUpperCase());
    world.edit(vrel, (L) => appendToSubsection(L, 'Quote bank', mood, [`> "${q.text.replace(/^"|"$/g, '')}" — ${link(cid)}`]));
  }

  // memories (one note each)
  for (const m of patch.memories ?? []) {
    const rel = ent(m.character, 'character');
    if (m.event) ent(m.event, 'event');
    const { name: n, memories: mdir } = speakerPaths(rel);
    const mrel = `${mdir}/${safeName(`${n} - ${m.event ?? m.title ?? cid}`)}.md`;
    const fm = ['---', 'type: memory', `character: "${link(n)}"`, `event: "${m.event ? link(m.event) : ''}"`, `when: ${cid.replace(/-(C\d+)$/, '/$1')}`,
      `pov: "${n}"`, `accuracy: ${m.accuracy ?? 'unknown'}`, `emotional_charge: "${m.charge ?? ''}"`, `canon: ${canon}`, 'continuity: main', `sources: ["${link(cid)}"]`, 'tags: [memory]', '---'];
    const text = [...fm, `# ${n} remembers: ${m.event ?? m.title ?? cid}`, '', String(m.text ?? '').trim(), '',
      '## Divergence from objective', String(m.divergence ?? '').trim() || '_None known._', ''].join('\n');
    if (!existsSync(world.path(mrel))) { world.write(mrel, text); world.created.push(mrel); }
    if (m.event) world.edit(world.find(m.event) ?? ent(m.event, 'event'), (L) => appendToSection(L, 'Memories of this', [`- ${link(`${n} - ${m.event}`)}`]));
  }

  // perspectives: on the target's note, under "As seen by [[By]]"
  for (const p of patch.perspectives ?? []) {
    const rel = ent(p.target, p.type ?? 'character');
    ent(p.by, 'character');
    world.edit(rel, (L) => appendToSubsection(L, 'Perspectives', `As seen by ${link(p.by)}`, [`- ${String(p.text).trim()} (${link(cid)})`]));
  }

  // style of the story's prose (first chapters): notes + verbatim sample passages
  if (patch.style) {
    const srel = `Stories/${story}/Style.md`;
    if (!existsSync(world.path(srel))) world.write(srel, stripPlaceholders(world.template('style').replace(/\{\{World\}\}/g, world.name).replace(/\{\{story\}\}/g, story)));
    if (patch.style.notes) world.edit(srel, (L) => appendToSection(L, 'Narration', [`- ${String(patch.style.notes).trim()} (${link(cid)})`]));
    for (const s of patch.style.samples ?? []) {
      if (!verbatim(s)) { report.rejectedQuotes.push({ where: 'style sample', who: story, text: s }); continue; }
      world.edit(srel, (L) => appendToSection(L, 'Sample passages', [`> ${String(s).trim().replace(/\n+/g, ' ')}`, `— ${link(cid)}`]));
    }
  }

  // glossary
  if ((patch.glossary ?? []).length) {
    const grel = world.find('Glossary') ?? 'Concepts/Glossary.md';
    if (!existsSync(world.path(grel))) world.write(grel, `---\ntype: concept\nkind: other\nworld: "[[World]]"\ncanon: book\n---\n# Glossary\n`);
    for (const g of patch.glossary) world.edit(grel, (L) => upsertTableRow(L, 'Terms', ['Term', 'Meaning', 'Source'], { Term: g.term, Meaning: g.meaning, Source: link(cid) }));
  }

  report.created = [...world.created];
  report.updated = [...world.changed].filter((p) => !world.created.includes(p));
  return report;
}
