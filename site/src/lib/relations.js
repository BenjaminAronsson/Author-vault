// Relations at the bookmark: tag-based (rel:), then Relations tables, then co-appearance.
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3';

/** Directed feelings + undirected pairs visible at the bookmark. */
export function relationsAt(store) {
  const { model, snap } = store;
  if (!model || !snap) return { directed: {}, pairs: [] };
  const chars = Object.values(model.entities).filter((e) => e.type === 'character' && store.visible(e.id)).map((e) => e.id);
  const set = new Set(chars);
  const directed = {};
  for (const [k, r] of Object.entries(store.fallback.edges)) if (set.has(r.from) && set.has(r.to)) directed[k] = r;
  for (const [k, r] of Object.entries(snap.rel)) if (set.has(r.from) && set.has(r.to)) directed[k] = r; // tags win
  // co-appearance so far
  const co = {};
  for (const cid of store.sequence.slice(0, store.idx + 1)) {
    const cs = model.chapters[cid].characters.filter((c) => set.has(c));
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const k = [cs[i], cs[j]].sort().join('|'); co[k] = (co[k] ?? 0) + 1; }
  }
  const pairs = {};
  for (const r of Object.values(directed)) { const k = [r.from, r.to].sort().join('|'); pairs[k] ??= { a: [r.from, r.to].sort()[0], b: [r.from, r.to].sort()[1], co: co[k] ?? 0 }; }
  for (const [k, n] of Object.entries(co)) { const [a, b] = k.split('|'); pairs[k] ??= { a, b, co: n }; }
  return { directed, pairs: Object.values(pairs), chars };
}

const layoutCache = new Map();
/** Stable positions for every character across the whole sequence (computed once per world/continuity/filter). */
export function stableLayout(store) {
  const key = `${store.model.world}|${store.cont}|${store.canon.join(',')}|${store.version}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  const nodes = Object.values(store.model.entities).filter((e) => e.type === 'character' && store.canonOk(e.canon)).map((e) => ({ id: e.id }));
  const ids = new Set(nodes.map((n) => n.id));
  const links = {};
  const addL = (a, b, w) => { if (!ids.has(a) || !ids.has(b) || a === b) return; const k = [a, b].sort().join('|'); links[k] = (links[k] ?? 0) + w; };
  for (const s of store.snaps) for (const r of Object.values(s.rel)) addL(r.from, r.to, 2);
  for (const r of Object.values(store.fallback.edges)) addL(r.from, r.to, 1);
  for (const [k, n] of Object.entries(store.fallback.co)) { const [a, b] = k.split('|'); addL(a, b, n * 0.5); }
  const L = Object.entries(links).map(([k, w]) => { const [source, target] = k.split('|'); return { source, target, w }; });
  const sim = forceSimulation(nodes)
    .force('link', forceLink(L).id((d) => d.id).distance((l) => 140 / Math.sqrt(l.w)).strength(0.6))
    .force('charge', forceManyBody().strength(-420))
    .force('center', forceCenter(0, 0))
    .force('collide', forceCollide(46))
    .stop();
  // deterministic start positions
  nodes.forEach((n, i) => { const a = (i / nodes.length) * Math.PI * 2; n.x = Math.cos(a) * 200; n.y = Math.sin(a) * 200; });
  for (let i = 0; i < 300; i++) sim.tick();
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  layoutCache.set(key, pos);
  return pos;
}

export const colorOf = (n) => (n == null ? 'var(--rule)' : n > 0 ? 'var(--pos)' : n < 0 ? 'var(--neg)' : 'var(--neu)');
export const describe = (store, r) => (r ? `${store.name(r.from)} → ${store.name(r.to)}: ${r.bond || r.feels || '—'} (${r.n > 0 ? '+' : ''}${r.n})${r.src === 'table' ? ' · from Relations table' : r.since ? ` · since ${r.since}` : ''}` : '');

/** Layout for just the people on screen (big casts): small simulation, warm-started from where they were. */
const warm = new Map();
export function localLayout(worldKey, ids, pairs) {
  const prev = warm.get(worldKey) ?? {};
  const set = new Set(ids);
  const nodes = ids.map((id, i) => (prev[id] ? { id, x: prev[id].x, y: prev[id].y } : { id, x: Math.cos(i * 2.4) * 160, y: Math.sin(i * 2.4) * 160 }));
  const links = pairs.filter((p) => set.has(p.a) && set.has(p.b)).map((p) => ({ source: p.a, target: p.b }));
  const settled = nodes.every((n) => prev[n.id]);
  const sim = forceSimulation(nodes).force('link', forceLink(links).id((d) => d.id).distance(110).strength(0.4))
    .force('charge', forceManyBody().strength(-380)).force('collide', forceCollide(44))
    .force('x', forceX(0).strength(0.05)).force('y', forceY(0).strength(0.05)).alpha(settled ? 0.25 : 1).stop();
  for (let i = 0; i < (settled ? 60 : 220); i++) sim.tick();
  const pos = Object.fromEntries(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  warm.set(worldKey, { ...prev, ...pos });
  return pos;
}

// Genealogy: lines are kinds of tie, not feelings. "kin · far" / "kin · make/maka" / "hushåll · piga" (written by apply).
export const KIN_KINDS = {
  parent: { label: 'parent / child', color: '#8a6a45' },
  spouse: { label: 'married', color: 'var(--accent)' },
  sibling: { label: 'siblings', color: '#4f7a8c' },
  household: { label: 'same household', color: '#8c8a5a', dash: '5 4' },
};
/** 'parent' | 'spouse' | 'sibling' | 'household' | null (a feeling) for a relation's bond text. */
export function kinKind(bond) {
  const b = String(bond ?? '').toLowerCase();
  if (b.startsWith('hushåll')) return 'household';
  if (!b.startsWith('kin')) return null;
  if (/make|maka|hustru|\bman\b|gift/.test(b)) return 'spouse';
  if (/syskon|bror|syster/.test(b)) return 'sibling';
  if (/far|mor|förälder|barn|son|dotter|parent|child/.test(b)) return 'parent';
  return 'parent';
}
