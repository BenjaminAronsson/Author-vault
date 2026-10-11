import { describe, it, expect } from 'vitest';
import { readWorldFolder } from '../scripts/read-world.mjs';
import { parseWorld } from '../src/parser/parse.js';
import { buildClock, buildSnapshots, fallbackEdges, introductionIndex, coverage } from '../src/parser/derive.js';
import { parseTimelineLine } from '../src/parser/timeline.js';

const model = parseWorld({ world: 'Saltmarrow', ...readWorldFolder(new URL('../fixtures/Sample/Saltmarrow', import.meta.url).pathname) });
const clock = buildClock(model);

describe('timeline lines', () => {
  it('parses tags, pov and text', () => {
    const t = parseTimelineLine('- **B1-C07** · `pov:objective` · `at:[[Old Mill]]` · `rel:[[Tobin|Tob]]=ally/-1` · `goal:"Keep the mill"=betrayed` · Learns the truth. ([[B1-C07]])');
    expect(t.marker).toBe('B1-C07');
    expect(t.pov).toBe('objective');
    expect(t.tags.at).toBe('Old Mill');
    expect(t.tags.rel).toEqual([{ to: 'Tobin', bond: 'ally', n: -1 }]);
    expect(t.tags.goal).toEqual([{ goal: 'Keep the mill', status: 'betrayed' }]);
    expect(t.text).toContain('Learns the truth');
  });
});

describe('reading order', () => {
  it('orders book chapters and inserts the side story after its anchor', () => {
    expect(clock.sequences.main).toEqual(['B1-C01', 'B1-C02', 'B1-C03', 'side-weir-C01', 'B1-C04', 'B1-C05', 'B1-C06']);
  });
  it('forks what-if continuities at their placement', () => {
    expect(clock.sequences['what-if-reeve']).toEqual(['B1-C01', 'B1-C02', 'B1-C03', 'side-weir-C01', 'B1-C04', 'what-if-reeve-C01']);
    expect(clock.forks['what-if-reeve'].at).toBe('B1-C04');
  });
  it('drops expansion stories when the canon filter excludes them', () => {
    expect(buildClock(model, new Set(['book'])).sequences.main).not.toContain('side-weir-C01');
  });
});

describe('snapshots', () => {
  const snaps = buildSnapshots(model, clock.sequences.main);
  const at = (cid) => snaps.find((s) => s.step === cid);
  it('tracks presence from at: tags and falls back to chapter places', () => {
    expect(at('B1-C02').presence['Characters/Mara/Mara']).toEqual({ place: 'Places/The Weir', src: 'tag' });
    expect(at('B1-C05').presence['Characters/Tobin/Tobin'].src).toBe('chapter');
  });
  it('tracks directional relations over time', () => {
    expect(at('B1-C05').rel['Characters/Mara/Mara>Characters/Tobin/Tobin'].n).toBe(1);
    expect(at('B1-C06').rel['Characters/Mara/Mara>Characters/Tobin/Tobin'].n).toBe(-1);
    expect(at('B1-C06').relChanges.length).toBeGreaterThan(0);
  });
  it('tracks status and goal changes', () => {
    expect(at('B1-C04').status['Characters/Ilse/Ilse']).toBeUndefined();
    expect(at('B1-C05').status['Characters/Ilse/Ilse']).toBe('dead');
    expect(at('B1-C05').goals['Characters/Mara/Mara']['Keep the mill']).toBe('betrayed');
  });
  it('keeps what-if facts out of main', () => {
    expect(at('B1-C06').status['Characters/Reeve Halloran/Reeve Halloran']).toBeUndefined();
    const branch = buildSnapshots(model, clock.sequences['what-if-reeve']);
    expect(branch.at(-1).status['Characters/Reeve Halloran/Reeve Halloran']).toBe('dead');
  });
});

describe('model', () => {
  it('resolves aliases, voice, memories and images', () => {
    expect(model.nameIndex['gran']).toBe('Characters/Ilse/Ilse');
    const mara = model.entities['Characters/Mara/Mara'];
    expect(mara.voice.moods.map((m) => m.mood)).toContain('Angry');
    expect(mara.memories[0].accuracy).toBe('partial');
    expect(mara.memories[0].divergence).toMatch(/did not turn/);
    expect(mara.image).toBe('_assets/characters/Mara/mara.webp');
    expect(mara.portraits[0]).toEqual({ at: 'B1-C05', image: '_assets/characters/Mara/mara-ash.webp' });
    expect(mara.goals).toHaveLength(2);
  });
  it('reads map coordinates, map images and parent places', () => {
    const mill = model.entities['Places/Old Mill'];
    expect(mill.map).toEqual({ x: 0.36, y: 0.3 });
    expect(mill.partOf).toBe('Places/Saltmarrow Village');
    expect(model.entities.World.mapImage).toBe('_assets/world/saltmarrow-map.webp');
    expect(model.entities['Places/Drowned Chapel'].map).toBeNull();
  });
  it('gates introductions by reading order', () => {
    const intro = introductionIndex(model, clock.sequences.main);
    expect(intro['Characters/Mara/Mara']).toBe(0);
    expect(intro['Characters/Wren/Wren']).toBe(3);
    expect(intro['Religions/The Tide Mother']).toBe(-1);
  });
  it('builds fallback edges and coverage', () => {
    const { edges } = fallbackEdges(model);
    expect(edges['Characters/Reeve Halloran/Reeve Halloran>Characters/Mara/Mara']).toMatchObject({ inferred: true, n: 0 }); // from Mara's "feels back" column
    expect(edges['Characters/Mara/Mara>Characters/Reeve Halloran/Reeve Halloran'].n).toBeLessThan(0);
    const cov = coverage(model);
    expect(cov.characters).toBe(5);
    expect(cov.withImage).toBe(2);
  });
  it('parses all frontmatter cleanly', () => {
    expect(model.warnings.filter((w) => w.kind === 'yaml')).toEqual([]);
  });
});

describe('the Norrgården genealogy example', async () => {
  const { buildClock } = await import('../src/parser/derive.js');
  const m = parseWorld({ world: 'Norrgården', ...readWorldFolder(decodeURIComponent(new URL('../fixtures/Sample/Norrgården', import.meta.url).pathname)) });
  it('is a genealogy world on a date clock with a family', () => {
    expect(m.genealogy).toBe(true);
    const seq = buildClock(m).sequences.main;
    expect(seq[0]).toBe('odaterat');
    expect(seq).toContain('1843-05-12');
    const anna = m.entities[m.nameIndex['anna persdotter']];
    expect(anna.kin.parents.length).toBe(2);
    expect(Object.values(m.entities).some((e) => e.living)).toBe(true);
    expect(m.warnings.filter((w) => w.kind === 'unresolved-link')).toEqual([]);
  });
  it('spans six generations, from Anders Persson down to Bengt Holm', async () => {
    const { kinIndex, familyTree } = await import('../src/lib/kin.js');
    const { lint } = await import('../src/vault/lint.js');
    const t = familyTree(m, kinIndex(m), m.nameIndex['anders persson (ca 1780)'], { up: 0, down: 5 });
    expect(t.rows.map((r) => r.gen)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(t.rows.at(-1).ids.map((id) => m.entities[id].title)).toContain('Bengt Holm (1946)');
    expect(lint(m).issues).toEqual([]);
  });
});

describe('present vs. mentioned', () => {
  it('parses the presence tag', () => {
    const t = parseTimelineLine('- **B1-C02** · `pov:objective` · `presence:mentioned` · Anna speaks of him. ([[B1-C02]])');
    expect(t.tags.presence).toBe('mentioned');
  });
  it('keeps mentioned people off stage and leaves their whereabouts alone', () => {
    const files = {
      'Stories/B1/Story.md': '---\ntype: story\norder: 1\n---\n# B1',
      'Stories/B1/Chapters/B1-C01.md': '---\ntype: chapter\nwhen: B1/C01\ncharacters: ["[[Anna]]", "[[Olof]]"]\nplaces: ["[[Mill]]"]\n---\n# B1-C01 — One',
      'Stories/B1/Chapters/B1-C02.md': '---\ntype: chapter\nwhen: B1/C02\ncharacters: ["[[Anna]]"]\nmentioned: ["[[Olof]]"]\nplaces: ["[[Inn]]"]\n---\n# B1-C02 — Two',
      'Characters/Anna/Anna.md': '---\ntype: character\n---\n# Anna\n## Timeline\n',
      'Characters/Olof/Olof.md': '---\ntype: character\n---\n# Olof\n## Timeline\n- **B1-C02** · `pov:objective` · `presence:mentioned` · `at:[[Inn]]` · Anna speaks of him. ([[B1-C02]])\n',
      'Places/Mill.md': '---\ntype: location\n---\n# Mill', 'Places/Inn.md': '---\ntype: location\n---\n# Inn',
    };
    const m = parseWorld({ world: 'T', files: Object.entries(files).map(([path, text]) => ({ path, text })) });
    const c = buildClock(m);
    const seq = c.sequences.main;
    const snaps = buildSnapshots(m, seq);
    const last = snaps.at(-1);
    expect(last.onStage).toEqual(['Characters/Anna/Anna']);
    expect(last.mentioned).toEqual(['Characters/Olof/Olof']);
    expect(last.presence['Characters/Olof/Olof'].place).toBe('Places/Mill');
  });
});

describe('robust to messy notes', () => {
  const files = {
    'Stories/B1/Story.md': '---\ntype: story\norder: 1\n---\n# B1',
    'Stories/B1/Chapters/B1-C01.md': '---\ntype: chapter\nwhen: B1/C01\ncharacters: ["[[Anna]]", "[[Anna]]", "[[Annie]]"]\nplaces: ["[[Mill]]", "[[Mill]]"]\nevents: ["[[Fire]]", "[[Fire]]"]\n---\n# B1-C01 — One',
    'Characters/Anna/Anna.md': '---\ntype: character\naliases: [Annie]\n---\n# Anna\n## Timeline\n- **B1-C01** · `pov:objective` · `rel:[[Bo]]=ally/1` · `rel:[[Bo]]=rival/-1` · Twice. ([[B1-C01]])\n',
    'Characters/Bo/Bo.md': '---\ntype: character\n---\n# Bo',
    'Places/Mill.md': '---\ntype: location\n---\n# Mill', 'Events/Fire.md': '---\ntype: event\n---\n# Fire',
  };
  const m = parseWorld({ world: 'T', files: Object.entries(files).map(([path, text]) => ({ path, text })) });
  it('lists each linked entity once, also through an alias', () => {
    const c = m.chapters['B1-C01'];
    expect(c.characters).toEqual(['Characters/Anna/Anna']);
    expect(c.places).toEqual(['Places/Mill']);
    expect(c.events).toEqual(['Events/Fire']);
  });
  it('sequences only hold chapters the model has', () => {
    const c = buildClock(m);
    for (const seq of Object.values(c.sequences)) for (const cid of seq) expect(m.chapters[cid]).toBeTruthy();
  });
});
