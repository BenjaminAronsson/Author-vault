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
