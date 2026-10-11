// Family relations from the notes' kin frontmatter (parents/children/spouses/siblings), read both ways so a
// one-sided entry still shows. Pure functions, shared by the family tree, character pages and tests.
import { parseDate } from './dates.js';

/** { parents: Map<id, Set>, children: Map<id, Set>, spouses: Map<id, Set>, siblings: Map<id, Set> } */
export function kinIndex(model) {
  const idx = { parents: new Map(), children: new Map(), spouses: new Map(), siblings: new Map() };
  const add = (k, a, b) => { if (!model.entities[a] || !model.entities[b] || a === b) return; if (!idx[k].has(a)) idx[k].set(a, new Set()); idx[k].get(a).add(b); };
  for (const e of Object.values(model.entities)) {
    if (!e.kin) continue;
    for (const p of e.kin.parents) { add('parents', e.id, p); add('children', p, e.id); }
    for (const c of e.kin.children) { add('children', e.id, c); add('parents', c, e.id); }
    for (const s of e.kin.spouses) { add('spouses', e.id, s); add('spouses', s, e.id); }
    for (const s of e.kin.siblings) { add('siblings', e.id, s); add('siblings', s, e.id); }
  }
  // siblings also through shared parents
  for (const [, kids] of idx.children) for (const a of kids) for (const b of kids) if (a !== b) add('siblings', a, b);
  return idx;
}

const byBirth = (model) => (a, b) => (parseDate(model.entities[a]?.born)?.sort ?? Infinity) - (parseDate(model.entities[b]?.born)?.sort ?? Infinity);
const get = (idx, k, id) => [...(idx[k].get(id) ?? [])];

/**
 * Generations around a person: rows from the oldest ancestors (negative) to the youngest descendants.
 * → { rows: [{ gen, ids }], edges: [{ from: parent, to: child }], spouses: [[a, b]] }
 * `keep(id)` filters people out (e.g. not yet born at the bookmark, or living and hidden).
 */
export function familyTree(model, idx, focus, { up = 2, down = 2, keep = () => true } = {}) {
  const sort = byBirth(model);
  const placed = new Map(); // id → gen
  const rows = new Map();
  const put = (id, gen) => { if (placed.has(id) || !keep(id)) return false; placed.set(id, gen); if (!rows.has(gen)) rows.set(gen, []); rows.get(gen).push(id); return true; };
  put(focus, 0);
  for (const s of get(idx, 'spouses', focus).sort(sort)) put(s, 0);
  // ancestors, generation by generation (pedigree order: each child's parents together)
  let layer = [focus];
  for (let g = -1; g >= -up; g--) {
    const next = [];
    for (const id of layer) for (const p of get(idx, 'parents', id).sort(sort)) if (put(p, g)) next.push(p);
    layer = next;
  }
  // descendants of the focus and their spouses
  layer = rows.get(0) ?? [];
  for (let g = 1; g <= down; g++) {
    const next = [];
    for (const id of layer) for (const c of get(idx, 'children', id).sort(sort)) if (put(c, g)) next.push(c);
    for (const c of [...next]) for (const s of get(idx, 'spouses', c)) if (put(s, g)) next.push(s);
    layer = next;
  }
  const edges = [], spouses = [];
  for (const [id, g] of placed) {
    for (const c of get(idx, 'children', id)) if (placed.get(c) === g + 1) edges.push({ from: id, to: c });
    for (const s of get(idx, 'spouses', id)) if (placed.get(s) === g && id < s) spouses.push([id, s]);
  }
  return { rows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([gen, ids]) => ({ gen, ids })), edges, spouses };
}

/** "1843–1910", "f. 1843", "† 1910" from born/died as written. */
export function lifespan(e) {
  const Q = { about: 'ca ', before: 'före ', after: 'efter ', between: 'ca ' };
  const y = (v) => { if (!v) return null; const d = parseDate(v); return d ? `${Q[d.qual] ?? ''}${d.year}` : String(v); };
  const b = y(e?.born), d = y(e?.died);
  return b && d ? `${b}–${d}` : b ? `f. ${b}` : d ? `† ${d}` : '';
}

/**
 * What kind of tie a kin link is, read from the Relations row apply writes ("kin · far" | "biologisk, belagd ([[arkiv-C03]])").
 * → { type: 'biologisk'|'adoptiv'|'foster'|'styv'|null, confidence: 'belagd'|'trolig'|'hypotes'|null, from: '1866'|null }
 */
export function kinDetail(model, a, b) {
  const rows = [...(model.entities[a]?.relationsTable ?? []).filter((r) => r.with === b), ...(model.entities[b]?.relationsTable ?? []).filter((r) => r.with === a)];
  const text = rows.map((r) => `${r.bond} ${r.feels} ${r.changes}`).join(' ').toLowerCase();
  const type = /adoptiv/.test(text) ? 'adoptiv' : /foster/.test(text) ? 'foster' : /styv/.test(text) ? 'styv' : /biologisk/.test(text) ? 'biologisk' : null;
  const confidence = /hypotes/.test(text) ? 'hypotes' : /trolig/.test(text) ? 'trolig' : /belagd/.test(text) ? 'belagd' : null;
  const from = /från ([^,)(]+?)(?:,| till| på| \(|$)/.exec(text)?.[1]?.trim() ?? null;
  return { type, confidence, from };
}

/** Oldest age we show for someone with no recorded death; beyond it they are simply "death not recorded". */
export const MAX_AGE = 105;
/**
 * A person's age as of a date (parsed), the way genealogists read it:
 * → { age, dead, atDeath, deathUnknown, approx }
 *   dead + atDeath: died on or before the date, age = how old they became
 *   deathUnknown: no death recorded and they'd be implausibly old — age is null
 */
export function ageAt(e, now) {
  const b = parseDate(e?.born), d = parseDate(e?.died);
  const approx = !!b && (b.qual !== 'exact' || b.precision !== 'day');
  if (d && now && d.sort <= now.sort) {
    const age = b ? Math.floor((d.sort - b.sort) / 10000) : null;
    return { age: age !== null && age >= 0 ? age : null, dead: true, atDeath: true, deathUnknown: false, approx: approx || (!!d && d.qual !== 'exact') };
  }
  if (!b || !now || now.sort < b.sort) return { age: null, dead: false, atDeath: false, deathUnknown: false, approx };
  const age = Math.floor((now.sort - b.sort) / 10000);
  const fuzzy = approx || now.qual !== 'exact' || now.precision !== 'day'; // a bookmark at "1850" can't give an exact age
  if (age > MAX_AGE && !e.living) return { age: null, dead: false, atDeath: false, deathUnknown: true, approx };
  return { age, dead: false, atDeath: false, deathUnknown: false, approx: fuzzy };
}

/** "55", "ca 55", "55 at death", "death not recorded", or "" */
export function ageLabel(a, { short = false } = {}) {
  if (a.deathUnknown) return short ? '—' : 'death not recorded';
  if (a.age === null) return '';
  const n = `${a.approx ? 'ca ' : ''}${a.age}`;
  return a.atDeath ? (short ? `${n} †` : `${n} at death`) : n;
}

/** Life years with the age reached: "1812–1867 (55)", "f. 1843" */
export function lifeLine(e) {
  const span = lifespan(e);
  const b = parseDate(e?.born), d = parseDate(e?.died);
  if (!span || !b || !d) return span;
  const age = Math.floor((d.sort - b.sort) / 10000);
  return age >= 0 ? `${span} (${b.qual !== 'exact' || d.qual !== 'exact' || b.precision !== 'day' ? 'ca ' : ''}${age})` : span;
}
