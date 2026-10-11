import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readWorldFolder } from '../scripts/read-world.mjs';
import { parseWorld } from '../src/parser/parse.js';
import { kinIndex, familyTree } from '../src/lib/kin.js';
import { layoutFamily, fanChart, STYLES } from '../src/lib/familyLayout.js';

const m = parseWorld({ world: 'Norrgården', ...readWorldFolder(fileURLToPath(new URL('../fixtures/Sample/Norrgården', import.meta.url))) });
const idx = kinIndex(m);
const people = Object.values(m.entities).filter((e) => e.type === 'character' && e.kin).map((e) => e.id);
const W = 156, H = 76;

const overlaps = (nodes) => {
  const ids = Object.keys(nodes), bad = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = nodes[ids[i]], b = nodes[ids[j]];
    if (Math.abs(a.x - b.x) < W && Math.abs(a.y - b.y) < H) bad.push([ids[i], ids[j]]);
  }
  return bad;
};

describe('family layout', () => {
  it('has people to lay out', () => expect(people.length).toBeGreaterThan(10));
  for (const style of Object.keys(STYLES).filter((s) => s !== 'fan')) {
    it(`${style}: nobody overlaps, for every person as focus`, () => {
      for (const focus of people) {
        const t = familyTree(m, idx, focus, { up: style === 'descendants' ? 0 : 4, down: style === 'ancestors' ? 0 : 4, siblings: style === 'tree' });
        const l = layoutFamily(t, idx, focus, { style, W, H, spousesOf: t.spousesOf });
        expect(overlaps(l.nodes), `${style} @ ${focus}`).toEqual([]);
        for (const n of Object.values(l.nodes)) { expect(n.x).toBeGreaterThanOrEqual(0); expect(n.x + W).toBeLessThanOrEqual(l.width + 1); }
      }
    });
  }
  it('tree: a couple sits over the middle of its own children', () => {
    let checked = 0;
    for (const focus of people) {
      const t = familyTree(m, idx, focus, { up: 0, down: 4 });
      const l = layoutFamily(t, idx, focus, { style: 'descendants', W, H, spousesOf: t.spousesOf });
      for (const bus of l.buses) {
        if (bus.parents.length !== 2) continue;
        const pc = bus.parents.reduce((a, p) => a + l.nodes[p].x + W / 2, 0) / 2;
        const cs = bus.children.map((c) => l.nodes[c].x + W / 2);
        // the drop lands on the children's bar: between the outermost children (or right above an only child)
        expect(pc).toBeGreaterThanOrEqual(Math.min(...cs) - W / 2);
        expect(pc).toBeLessThanOrEqual(Math.max(...cs) + W / 2);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('tree: children of different couples are not interleaved', () => {
    for (const focus of people) {
      const t = familyTree(m, idx, focus, { up: 0, down: 4 });
      const l = layoutFamily(t, idx, focus, { style: 'descendants', W, H, spousesOf: t.spousesOf });
      const spans = l.buses.map((b) => ({ y: l.nodes[b.children[0]].y, lo: Math.min(...b.children.map((c) => l.nodes[c].x)), hi: Math.max(...b.children.map((c) => l.nodes[c].x)) }));
      for (const a of spans) for (const b of spans) if (a !== b && a.y === b.y) expect(a.hi < b.lo || b.hi < a.lo, `${focus}`).toBe(true);
    }
  });
});

describe('fan chart and folding', () => {
  it('puts every ancestor in its own slice, parents inside their child’s slice', () => {
    for (const focus of people) {
      const t = familyTree(m, idx, focus, { up: 5, down: 0 });
      const f = fanChart(t, idx, focus);
      const anc = Object.entries(t.gen).filter(([, g]) => g < 0).length;
      expect(f.cells.length, focus).toBe(anc);
      const key = new Set(f.cells.map((c) => `${c.gen}:${c.slot}`));
      expect(key.size).toBe(f.cells.length);
      for (const c of f.cells) if (c.gen > 1) expect(f.cells.some((p) => p.gen === c.gen - 1 && p.slot === c.slot >> 1)).toBe(true);
    }
  });
  it('a folded person stays, their branch goes', () => {
    const focus = people.find((p) => familyTree(m, idx, p, { up: 0, down: 3 }).rows.length > 2);
    const full = familyTree(m, idx, focus, { up: 0, down: 3 });
    const child = full.rows.find((r) => r.gen === 1).ids[0];
    const folded = familyTree(m, idx, focus, { up: 0, down: 3, stop: new Set([child]) });
    expect(folded.gen[child]).toBe(1);
    expect(Object.keys(folded.gen).length).toBeLessThan(Object.keys(full.gen).length);
  });
});
