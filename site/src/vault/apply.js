// Applies an agent's chapter patch to a world folder. The only code that writes notes during extraction.
// Append-only (lines are added; a table cell may be updated), idempotent, exact schema formatting,
// verbatim-checked quotes, two-sided relations.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { load } from 'js-yaml';
import { parseWorld } from '../parser/parse.js';
import { setField, setRaw } from '../lib/frontmatter.js';
import { appendToSection, appendToSubsection, upsertTableRow, stripPlaceholders, norm, sectionRange } from './md.js';
import { compareDates, compareDateClaims } from '../lib/dates.js';

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
/** Timeline marker for facts without a date in a genealogy world. */
export const UNDATED = 'odaterat';
const DATE_FIELDS = new Set(['born', 'died', 'date', 'in_world']);
export const isGenealogy = (world) => world.model.entities.World?.fm?.kind === 'genealogy';
/** Kinship as frontmatter link lists (both sides) — SCHEMA › Archive & kinship. */
const KIN_FM = { parent: ['parents', 'children'], spouse: ['spouses', 'spouses'], sibling: ['siblings', 'siblings'] };
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
    // an event happens in the chapter that introduces it (the template's `when` is only an example)
    if (type === 'event' && cid) text = setRaw(text, 'when', cid.replace(/-(C\d+)$/, '/$1'));
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

const frontmatter = (text) => { const m = /^---\n([\s\S]*?)\n---/.exec(text); try { return (m && load(m[1])) || {}; } catch { return {}; } };

/** Genealogy: keep a note's Timeline in date order as sources arrive in any order ("odaterat" first, stable). */
export function sortTimelineByDate(lines) {
  const r = sectionRange(lines, 'Timeline');
  if (!r) return;
  const idx = [];
  for (let k = r[0]; k < r[1]; k++) if (/^- \*\*/.test(lines[k])) idx.push(k);
  const marker = (l) => /^- \*\*(.+?)\*\*/.exec(l)[1];
  const cur = idx.map((k) => lines[k]);
  const sorted = cur.map((l, i) => [l, i]).sort(([a, i], [b, j]) => {
    const ma = marker(a), mb = marker(b);
    if (ma === mb) return i - j;
    if (ma === UNDATED) return -1;
    if (mb === UNDATED) return 1;
    return compareDates(ma, mb) || i - j;
  }).map(([l]) => l);
  idx.forEach((k, i) => { lines[k] = sorted[i]; });
}

/** Adds "[[name]]" to a frontmatter link list (deduped). */
function addLinkList(world, rel, key, name) {
  const text = world.read(rel);
  const cur = frontmatter(text)[key];
  const list = (Array.isArray(cur) ? cur : cur ? [cur] : []).map(String);
  const target = world.find(name);
  if (list.some((x) => { const n = x.replace(/^\[\[|\]\]$/g, '').split('|')[0]; return n.toLowerCase() === canonName(name).toLowerCase() || (target && world.find(n) === target); })) return;
  world.write(rel, setRaw(text, key, `[${[...list, link(name)].map((x) => JSON.stringify(x)).join(', ')}]`));
}

/** Voice file and memories folder for any note: Characters/<N>/voice.md, or "<dir>/<N> - voice.md" for e.g. a talking creature. */
export function speakerPaths(rel) {
  const parts = rel.split('/');
  const n = parts.at(-1).replace(/\.md$/, '');
  if (parts[0] === 'Characters' && parts.length === 3) return { name: n, voice: `Characters/${n}/voice.md`, memories: `Characters/${n}/memories` };
  const dir = parts.slice(0, -1).join('/');
  return { name: n, voice: `${dir}/${n} - voice.md`, memories: `${dir}/${n} - memories` };
}

/**
 * "- **B1-C03** · `pov:objective` · `at:[[X]]` · … · text ([[B1-C03]])" — the exact format the parser reads.
 * Genealogy worlds put the in-world date as the marker (`t.date`, as written) and still cite the source: "- **1843-05-12** · … ([[arkiv-C01]])".
 */
export function timelineLine(cid, t) {
  const tags = [`\`pov:${t.pov ?? 'objective'}\``];
  if (t.evidence) tags.push(`\`evidence:${t.evidence}\``);
  if (t.confidence) tags.push(`\`confidence:${t.confidence}\``);
  if (t.canon && t.canon !== 'book') tags.push(`\`canon:${t.canon}\``);
  if (t.presence && t.presence !== 'present') tags.push(`\`presence:${String(t.presence).replace(/[`\s]/g, '')}\``);
  if (t.at) tags.push(`\`at:${link(t.at)}\``);
  for (const r of t.rel ?? []) tags.push(`\`rel:${link(r.to)}=${String(r.bond ?? 'tie').replace(/[/`]/g, ' ')}/${Math.max(-2, Math.min(2, Math.round(Number(r.n) || 0)))}\``);
  if (t.status) tags.push(`\`status:${t.status}\``);
  for (const g of t.goal ?? []) tags.push(`\`goal:"${String(g.goal).replace(/"/g, "'")}"=${g.status}\``);
  const marker = t.date === undefined ? cid : String(t.date ?? '').trim() || UNDATED;
  return `- **${marker.replace(/\*/g, '')}** · ${tags.join(' · ')} · ${String(t.text ?? '').trim()} (${link(cid)})`;
}

/**
 * patch = { chapter?, entities?, timeline?, rows?, items?, paragraphs?, quotes?, memories?, perspectives?, glossary? }
 * opts = { cid: 'B1-C03', story: 'B1', canon: 'book'|'expansion', source: <chapter text for quote checks> }
 */
/** Words that make an `at:` value a time of day/week/year rather than a place. */
const TIME_AT = /(?<![\p{L}])(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|morgon|morgonen|förmiddag|eftermiddag|kväll|kvällen|natt|natten|midnatt|midsommar|midsommarnatten|dagen|veckan|året|sommaren|vintern|hösten|våren|januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening|night|midnight|midsummer|yesterday|today|tomorrow)(?![\p{L}])/iu;

export function applyPatch(world, patch, opts) {
  const { cid, story, canon = 'book', source = null, date: defaultDate = '' } = opts; // date: genealogy default for undated lines (a /become cutoff)
  const report = { created: [], updated: [], rejectedQuotes: [], warnings: [] };
  const typeOf = {};
  for (const e of patch.entities ?? []) typeOf[e.name.toLowerCase()] = e.type;
  const guessType = (name, fallback = 'character') => typeOf[String(name).toLowerCase()] ?? (world.find(name) ? null : fallback);
  const ent = (name, fallbackType = 'character') => world.ensure(name, guessType(name, fallbackType) ?? fallbackType, { cid, canon });
  const verbatim = (text) => !source || quoteNorm(source).includes(quoteNorm(text).replace(/^"|"$/g, ''));
  // `at` is a place, never a time ("förra midsommar", "onsdag kväll"): drop time expressions so they don't become Location notes
  for (const t of patch.timeline ?? []) {
    if (t.at && TIME_AT.test(t.at) && !world.find(t.at)) { report.warnings.push(`timeline at "${t.at}" looks like a time, not a place: dropped (put it in the text)`); t.at = null; }
  }

  const genealogy = isGenealogy(world);
  // entities first (types, aliases, fields)
  for (const e of patch.entities ?? []) {
    const existed = world.find(e.name) ?? (e.aliases ?? []).map((a) => world.find(a)).find(Boolean);
    const rel = world.ensure(e.name, e.type ?? 'character', { cid, canon, aliases: e.aliases ?? [], fields: e.fields ?? {} });
    world.touchFrontmatter(rel, { aliases: e.aliases ?? [], cid });
    // a later source adds facts (a death date) to a known person: fill empty fields, never overwrite; a different value is a contradiction
    if (genealogy && existed) for (const [k, v] of Object.entries(e.fields ?? {})) {
      if (v === '' || v == null) continue;
      const cur = frontmatter(world.read(rel))[k];
      if (cur === undefined || cur === '' || cur === null || (Array.isArray(cur) && !cur.length)) world.write(rel, typeof v === 'string' ? setField(world.read(rel), k, v) : setRaw(world.read(rel), k, JSON.stringify(v)));
      else if (JSON.stringify(cur) === JSON.stringify(v)) continue;
      else if (DATE_FIELDS.has(k) && ['refines', 'coarser', 'same'].includes(compareDateClaims(cur, v))) {
        // the same date, said more or less precisely: keep the most precise (the source's own dated line says where it came from)
        if (compareDateClaims(cur, v) === 'refines') world.write(rel, setField(world.read(rel), k, String(v)));
      } else {
        world.edit(rel, (L) => appendToSection(L, 'Contradictions', [`> [!warning] Contradiction · ${k}: "${typeof cur === 'string' ? cur : JSON.stringify(cur)}" (kept) vs "${typeof v === 'string' ? v : JSON.stringify(v)}" (${link(cid)})`]));
        const w = `${e.name}: ${k} "${cur}" vs "${v}" recorded as a contradiction`;
        if (!report.warnings.includes(w)) report.warnings.push(w);
      }
    }
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
    for (const n of [...(c.mentioned ?? [])]) ent(n, 'character');
    for (const n of [...(c.places ?? []), ...(c.mentioned_places ?? [])]) ent(n, 'location');
    // on scene wins: a name listed both ways counts as present
    const onScene = new Set((c.characters ?? []).map(canonName)), here = new Set((c.places ?? []).map(canonName));
    const mentioned = (c.mentioned ?? []).filter((x) => !onScene.has(canonName(x))), mentionedPlaces = (c.mentioned_places ?? []).filter((x) => !here.has(canonName(x)));
    for (const n of [...(c.events ?? [])]) ent(n, 'event');
    const fm = ['---', 'type: chapter', 'world: "[[World]]"', `story: "[[Stories/${story}/Story|${story}]]"`, `when: ${cid.replace(/-(C\d+)$/, '/$1')}`,
      `pov: "${c.pov && (c.characters ?? []).some((x) => canonName(x) === canonName(c.pov)) ? link(c.pov) : String(c.pov ?? '').replace(/"/g, "'")}"`, `canon: ${canon}`, 'continuity: main', `characters: ${list(c.characters)}`, `places: ${list(c.places)}`,
      ...(mentioned.length ? [`mentioned: ${list(mentioned)}`] : []), ...(mentionedPlaces.length ? [`mentioned_places: ${list(mentionedPlaces)}`] : []),
      `events: ${list(c.events)}`,
      // archive sources (genealogy): what kind of document, how much it weighs, where it is kept, its own date
      ...[['source_kind', c.source_kind], ['evidence', c.evidence], ['archive_ref', c.archive_ref], ['file', c.file], ['dated', c.dated]].filter(([, v]) => v).map(([k, v]) => `${k}: ${JSON.stringify(String(v))}`),
      'tags: [chapter]', '---'];
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
    // genealogy: the marker is always a date (or "odaterat"), never the source id
    world.edit(rel, (L) => appendToSection(L, 'Timeline', [timelineLine(cid, { canon, ...t, ...(genealogy ? { date: t.date || defaultDate } : {}) })]));
    if (genealogy) world.edit(rel, sortTimelineByDate);
    world.touchFrontmatter(rel, { cid });
  }

  // kinship: two-sided frontmatter lists + a Relations row on each side
  // kin = [{ a, b, kind: parent|spouse|sibling|household, role?, back?, detail?, from?, to?, confidence? }]
  //   parent: a is the parent of b (role "far"/"mor", detail biologisk|adoptiv|foster|styv|okänd)
  //   household: a lives in b's household (role = what a is: piga|dräng|inhyses…, back = what b is: husbonde…, `at` the farm)
  //   role = what a is to b, back = what b is to a
  for (let k of patch.kin ?? []) {
    if (!k.a || !k.b || !k.kind) { report.warnings.push(`kin needs a, b and kind: ${JSON.stringify(k)}`); continue; }
    // "a is the child of b" is said both ways by agents: kind child, or kind parent with a child's role. Normalise to parent.
    const CHILD = /^(son|dotter|barn|child|daughter|fosterson|fosterdotter|styvson|styvdotter)$/i;
    if (k.kind === 'child' || (k.kind === 'parent' && CHILD.test(k.role ?? ''))) {
      if (k.kind === 'parent' && !report.warnings.some((w) => w.startsWith(`kin: ${k.a} is`))) report.warnings.push(`kin: ${k.a} is "${k.role}" of ${k.b}: stored as ${k.b} parent of ${k.a}`);
      k = { ...k, kind: 'parent', a: k.b, b: k.a, role: k.back, back: k.role };
    }
    const ra = ent(k.a, 'character'), rb = ent(k.b, 'character');
    const fmKeys = KIN_FM[k.kind];
    // link by note name, not by whatever alias the source used ("Anna" → "Anna Persdotter (1843–1910)")
    const noteName = (rel) => rel.split('/').pop().replace(/\.md$/, '');
    k = { ...k, a: noteName(ra), b: noteName(rb) };
    if (fmKeys) { addLinkList(world, rb, fmKeys[0], k.a); addLinkList(world, ra, fmKeys[1], k.b); }
    const span = [k.from && `från ${k.from}`, k.to && `till ${k.to}`].filter(Boolean).join(' ');
    const note = [k.detail, span, k.at && `på ${link(k.at)}`, k.confidence].filter(Boolean).join(', ');
    const DEFAULT = { parent: ['förälder', 'barn'], spouse: ['make/maka', 'make/maka'], sibling: ['syskon', 'syskon'], household: ['hushåll', 'hushåll'] }[k.kind] ?? [k.kind, k.kind];
    // b's row about a says what a is to b (far), a's row about b says what b is to a (barn)
    const pre = k.kind === 'household' ? 'hushåll' : 'kin';
    const bondA = `${pre} · ${k.role ?? DEFAULT[0]}`, bondB = `${pre} · ${k.back ?? DEFAULT[1]}`;
    if (k.at) ent(k.at, 'location');
    world.edit(rb, (L) => upsertTableRow(L, 'Relations', HEADERS.Relations, { With: link(k.a), Bond: bondA, 'Changes over time': `${note ? `${note} ` : ''}(${link(cid)})` }));
    world.edit(ra, (L) => upsertTableRow(L, 'Relations', HEADERS.Relations, { With: link(k.b), Bond: bondB, 'Changes over time': `${note ? `${note} ` : ''}(${link(cid)})` }));
    world.touchFrontmatter(ra, { cid }); world.touchFrontmatter(rb, { cid });
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
    if (r.section === 'Goals' && row.Status && row.Status !== 'active') world.edit(rel, (L) => appendToSection(L, 'Timeline', [timelineLine(cid, { canon, ...(genealogy ? { date: r.date || defaultDate } : {}), goal: [{ goal: row.Goal, status: row.Status }], text: `Goal “${row.Goal}”: ${row.Status}.` })]));
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
      ...(m.date ? [`date: ${JSON.stringify(String(m.date))}`] : []), `pov: "${n}"`, `accuracy: ${m.accuracy ?? 'unknown'}`, `emotional_charge: "${m.charge ?? ''}"`, `canon: ${canon}`, 'continuity: main', `sources: ["${link(cid)}"]`, 'tags: [memory]', '---'];
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
