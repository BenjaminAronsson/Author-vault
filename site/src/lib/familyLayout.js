// Where each person sits in a family tree, and the lines between them. Pure, so tests can check it.
// Works in "breadth/depth" space (b along a generation, d across generations) so the same code draws
// a top-down tree and a left-to-right pedigree.
//   tree        ancestors above, the person with spouses and siblings, descendants below
//   descendants the person, spouses and everyone after them
//   ancestors   the person on the left, their forebears fanning out to the right (a pedigree chart)
// Children hang from their parents' couple on one bus (drop → bar → stubs), each couple's children under it,
// and every block is as wide as what hangs from it, so lines don't cross.

export const STYLES = { tree: 'Tree', descendants: 'Descendants', ancestors: 'Ancestors' };

/**
 * @param tree   familyTree() output (needs .gen)
 * @param idx    kinIndex()
 * @param focus  id
 * @param o      { style, W, H, GX, GY, spousesOf(id) → ordered ids }
 * → { nodes: {id: {x, y}}, width, height, buses: [{ parents, children, drop, bar, stubs: [{ child, path }] }], marriages: [{ a, b, x1, y1, x2, y2 }] }
 */
export function layoutFamily(tree, idx, focus, { style = 'tree', W = 156, H = 76, GX = 30, GY = 56, spousesOf = null } = {}) {
  const horiz = style === 'ancestors';
  const NB = horiz ? H : W, ND = horiz ? W : H; // node size along breadth / depth
  const GB = horiz ? Math.max(24, GX - 4) : GX, GD = horiz ? GY + 8 : GY;
  const gen = tree.gen;
  const has = (id) => id in gen;
  const get = (k, id) => [...(idx[k].get(id) ?? [])].filter(has);
  const spouses = (id) => (spousesOf ? spousesOf(id) : get('spouses', id)).filter((s) => gen[s] === gen[id]);
  const parentsOf = (id) => get('parents', id).filter((p) => gen[p] === gen[id] - 1);
  const childrenOf = (id) => get('children', id).filter((c) => gen[c] === gen[id] + 1);
  const born = (id) => tree.order?.[id] ?? 0;

  const b = {}; // id → breadth position of the node's start
  const seen = new Set();

  // ---- descendants: a unit is a person and the spouses seated beside them -------------------------------
  const units = new Map(); // id → { seats, groups: [[childIds]] }
  const unit = (p) => {
    if (units.has(p)) return units.get(p);
    seen.add(p);
    const sp = spouses(p).filter((s) => !seen.has(s));
    sp.forEach((s) => seen.add(s));
    const seats = sp.length > 1 ? [sp[0], p, ...sp.slice(1)] : [p, ...sp];
    // children grouped by which seated parents they have, groups in seat order (first marriage's children left)
    const byKey = new Map();
    for (const s of seats) for (const c of childrenOf(s)) {
      if (seen.has(c)) continue;
      const ps = parentsOf(c).filter((x) => seats.includes(x));
      const key = ps.map((x) => seats.indexOf(x)).sort((a, z) => a - z).join(',');
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(c);
    }
    const mean = (k) => { const n = k.split(',').map(Number); return n.reduce((a, z) => a + z, 0) / n.length; };
    const groups = [...byKey.entries()].sort((a, z) => mean(a[0]) - mean(z[0])).map(([, set]) => [...set].sort((x, y) => born(x) - born(y)));
    for (const g of groups) for (const c of g) seen.add(c);
    const u = { seats, groups, kids: [] };
    units.set(p, u);
    u.kids = groups.flat().map((c) => unit(c));
    u.ids = groups.flat();
    // measured relative to the block's left edge: children side by side, the seats centred over the children
    // themselves (not their blocks, which a child's spouse widens to one side); the block grows to fit both
    const seatW = seats.length * NB + (seats.length - 1) * GB;
    const offs = [];
    let o = 0;
    for (const k of u.kids) { offs.push(o); o += k.width + GB; }
    const kidsW = Math.max(0, o - GB);
    const cs = u.kids.map((k, i) => offs[i] + k.anchor);
    const target = cs.length ? (Math.min(...cs) + Math.max(...cs)) / 2 : seatW / 2;
    const seatsLeft = target - seatW / 2;
    const lo = Math.min(0, seatsLeft), hi = Math.max(kidsW, seatsLeft + seatW);
    u.width = hi - lo;
    u.kidsStart = -lo; u.offs = offs;
    u.seatsStart = seatsLeft - lo;
    u.anchor = u.seatsStart + seats.indexOf(p) * (NB + GB) + NB / 2;
    return u;
  };
  const placeDown = (u, left) => {
    u.seats.forEach((s, i) => (b[s] = left + u.seatsStart + i * (NB + GB)));
    u.kids.forEach((k, i) => placeDown(k, left + u.kidsStart + u.offs[i]));
  };

  // ---- ancestors: each person's forebears sit in a block as wide as they need, centred over them ----------
  const upW = new Map();
  const measureUp = (p) => {
    if (upW.has(p)) return upW.get(p);
    upW.set(p, NB);
    const ps = parentsOf(p).filter((q) => !upW.has(q));
    const w = ps.length ? Math.max(NB, ps.reduce((a, q) => a + measureUp(q), 0) + (ps.length - 1) * GB) : NB;
    upW.set(p, w);
    up.set(p, ps);
    return w;
  };
  const up = new Map();
  const placeUp = (p, centre) => {
    const ps = up.get(p) ?? [];
    const total = ps.reduce((a, q) => a + upW.get(q), 0) + Math.max(0, ps.length - 1) * GB;
    let left = centre - total / 2;
    for (const q of ps) { const w = upW.get(q); b[q] = left + (w - NB) / 2; placeUp(q, left + w / 2); left += w + GB; }
  };

  if (style === 'ancestors') {
    measureUp(focus);
    b[focus] = 0;
    placeUp(focus, NB / 2);
  } else {
    const root = unit(focus);
    placeDown(root, 0);
    // siblings sit beside the person's seats on their row (older left, younger right)
    const sibs = (tree.siblings ?? []).filter((s) => has(s) && !(s in b));
    if (sibs.length) {
      const row0 = root.seats.map((s) => b[s]);
      const fb = born(focus);
      let l = Math.min(...row0), r = Math.max(...row0) + NB;
      for (const s of sibs.filter((x) => born(x) < fb).reverse()) { l -= NB + GB; b[s] = l; }
      for (const s of sibs.filter((x) => born(x) >= fb)) { b[s] = r + GB; r += NB + GB; }
    }
    if (style === 'tree') {
      const kids = [focus, ...sibs];
      measureUp(focus);
      const cs = kids.map((k) => b[k] + NB / 2);
      placeUp(focus, (Math.min(...cs) + Math.max(...cs)) / 2);
    }
  }
  // anyone the walks didn't reach goes at the end of their row
  const rowEnd = {};
  for (const id of Object.keys(b)) rowEnd[gen[id]] = Math.max(rowEnd[gen[id]] ?? -Infinity, b[id] + NB);
  for (const id of Object.keys(gen)) if (!(id in b) && (style !== 'ancestors' || gen[id] < 0) && (style !== 'descendants' || gen[id] >= 0)) {
    const e = rowEnd[gen[id]] ?? 0;
    b[id] = e === -Infinity ? 0 : e + GB;
    rowEnd[gen[id]] = b[id] + NB;
  }

  // ---- to x/y ----------------------------------------------------------------------------------------------
  const ids = Object.keys(b);
  const gens = ids.map((id) => gen[id]);
  const gmin = Math.min(...gens), gmax = Math.max(...gens);
  const bmin = Math.min(...ids.map((id) => b[id]));
  const M = GB / 2;
  const dOf = (g) => (horiz ? -g : g - gmin) * (ND + GD) + M;
  const nodes = {};
  for (const id of ids) {
    const bb = b[id] - bmin + M, dd = dOf(gen[id]);
    nodes[id] = horiz ? { x: dd, y: bb } : { x: bb, y: dd };
  }
  const span = (horiz ? (-gmin) : (gmax - gmin)) + 1;
  const breadth = Math.max(NB, ...ids.map((id) => b[id] - bmin + NB)) + 2 * M;
  const depth = span * ND + (span - 1) * GD + 2 * M;
  const width = horiz ? depth : breadth, height = horiz ? breadth : depth;
  const pt = (bb, dd) => (horiz ? `${dd},${bb}` : `${bb},${dd}`);
  const B = (id) => (horiz ? nodes[id].y : nodes[id].x), D = (id) => (horiz ? nodes[id].x : nodes[id].y);

  // ---- marriages: a line across the gap between two seated partners --------------------------------------
  const marriages = [];
  for (const [p1, p2] of tree.spouses) {
    if (!nodes[p1] || !nodes[p2]) continue;
    const [l, r] = B(p1) <= B(p2) ? [p1, p2] : [p2, p1];
    const b1 = B(l) + NB, b2 = B(r), dd = D(l) + ND / 2;
    marriages.push(horiz ? { a: l, b: r, x1: dd, y1: b1, x2: dd, y2: b2 } : { a: l, b: r, x1: b1, y1: dd, x2: b2, y2: dd });
  }

  // ---- buses: one per set of parents, down to all their children on the next generation --------------------
  const groups = new Map();
  for (const c of ids) {
    const ps = parentsOf(c).filter((p) => nodes[p]).sort();
    if (!ps.length) continue;
    const key = ps.join('|');
    if (!groups.has(key)) groups.set(key, { parents: ps, children: [] });
    groups.get(key).children.push(c);
  }
  const buses = [];
  for (const { parents, children } of groups.values()) {
    const dp = D(parents[0]), dc = D(children[0]);
    const down = dc > dp;
    const pNear = down ? dp + ND : dp, cNear = down ? dc : dc + ND;
    const mid = (pNear + cNear) / 2;
    const centres = parents.map((p) => B(p) + NB / 2);
    const b0 = centres.reduce((a, z) => a + z, 0) / centres.length;
    const d0 = parents.length > 1 ? dp + ND / 2 : pNear;
    const cs = children.map((c) => B(c) + NB / 2);
    const lo = Math.min(b0, ...cs), hi = Math.max(b0, ...cs);
    buses.push({
      parents, children,
      drop: `M${pt(b0, d0)} L${pt(b0, mid)}`,
      bar: lo < hi ? `M${pt(lo, mid)} L${pt(hi, mid)}` : '',
      stubs: children.map((c, i) => ({ child: c, path: `M${pt(cs[i], mid)} L${pt(cs[i], cNear)}`, at: horiz ? { x: (mid + cNear) / 2, y: cs[i] } : { x: cs[i], y: (mid + cNear) / 2 } })),
    });
  }
  return { nodes, width, height, buses, marriages, horiz };
}
