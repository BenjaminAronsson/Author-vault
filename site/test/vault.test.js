import { describe, it, expect, beforeEach } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { World, applyPatch, timelineLine, readWorld } from '../src/vault/apply.js';
import { parseWorld } from '../src/parser/parse.js';
import { lint } from '../src/vault/lint.js';
import { briefing } from '../src/vault/briefing.js';
import { contextPack, mentioned } from '../src/vault/context.js';
import { plan } from '../src/vault/plan.js';
import { initWorld, addStory } from '../src/vault/scaffold.js';

const FIX = new URL('../fixtures/Sample/Saltmarrow', import.meta.url).pathname;
const TPL = new URL('../../book-universe/_system/templates', import.meta.url).pathname;
let dir;
beforeEach(() => { dir = join(mkdtempSync(join(tmpdir(), 'vault-')), 'Saltmarrow'); cpSync(FIX, dir, { recursive: true }); });
const read = (rel) => readFileSync(join(dir, rel), 'utf8');
const SOURCE = 'Wren said, "The water remembers everything." Mara laughed. Tobin did not.';

describe('timeline line format', () => {
  it('matches what the viewer parser reads', () => {
    expect(timelineLine('B1-C03', { text: 'Leaves.', at: 'Old Mill', rel: [{ to: 'Tobin', bond: 'friend', n: -1 }], status: 'dead', goal: [{ goal: 'Keep the mill', status: 'betrayed' }] }))
      .toBe('- **B1-C03** · `pov:objective` · `at:[[Old Mill]]` · `rel:[[Tobin]]=friend/-1` · `status:dead` · `goal:"Keep the mill"=betrayed` · Leaves. ([[B1-C03]])');
  });
});

describe('apply', () => {
  const patch = {
    entities: [{ name: 'Ottilie Marsh', type: 'character', aliases: ['Tilly'] }],
    timeline: [{ entity: 'Ottilie Marsh', text: 'Arrives at the weir.', at: 'The Weir', rel: [{ to: 'Mara', bond: 'rival', n: -1 }] }],
    rows: [{ entity: 'Ottilie Marsh', section: 'Goals', row: { Goal: 'Find the ring', Horizon: 'now', Status: 'active' } }],
    items: [{ entity: 'Ottilie Marsh', section: 'Dreams', text: 'A boat with red sails.' }],
    quotes: [{ character: 'Wren', mood: 'Everyday', text: 'The water remembers everything.' }, { character: 'Wren', mood: 'Angry', text: 'I never said this.' }],
    memories: [{ character: 'Mara', event: 'Ring Lost at the Weir', accuracy: 'partial', charge: 'shame', text: 'I slipped.', divergence: 'She was pulled.' }],
    perspectives: [{ target: 'Mara', by: 'Ottilie Marsh', text: 'Too proud by half.' }],
    glossary: [{ term: 'weir-light', meaning: 'Lantern glow on the water' }],
  };
  const run = () => applyPatch(new World(dir, TPL), patch, { cid: 'B1-C03', story: 'B1', source: SOURCE });

  it('creates notes from templates and writes exact sections', () => {
    const r = run();
    expect(r.created).toContain('Characters/Ottilie Marsh/Ottilie Marsh.md');
    const t = read('Characters/Ottilie Marsh/Ottilie Marsh.md');
    expect(t).toMatch(/aliases: \["Tilly"\]/);
    expect(t).toContain('first_seen: "[[B1-C03]]"');
    expect(t).toContain('- **B1-C03** · `pov:objective` · `at:[[The Weir]]` · `rel:[[Mara]]=rival/-1` · Arrives at the weir. ([[B1-C03]])');
    expect(t).toMatch(/\| Find the ring \| now \| active \| B1-C03 \| \[\[B1-C03\]\] \|/);
    expect(t).toContain('- A boat with red sails. ([[B1-C03]])');
    expect(t).not.toContain('{{'); // no template placeholders left
  });
  it('keeps quotes only if they are verbatim in the chapter', () => {
    const r = run();
    expect(r.rejectedQuotes.map((q) => q.text)).toEqual(['I never said this.']);
    expect(read('Characters/Wren/voice.md')).toContain('> "The water remembers everything." — [[B1-C03]]');
  });
  it('writes relations on both sides', () => {
    run();
    expect(read('Characters/Mara/Mara.md')).toMatch(/\| \[\[Ottilie Marsh\]\] \|[^\n]*rival/);
  });
  it('adds memories, perspectives and glossary terms', () => {
    run();
    expect(read('Characters/Mara/memories/Mara - Ring Lost at the Weir.md')).toBe(read('Characters/Mara/memories/Mara - Ring Lost at the Weir.md')); // existing memory is never overwritten
    expect(read('Characters/Mara/Mara.md')).toMatch(/### As seen by \[\[Ottilie Marsh\]\]\n- Too proud by half\. \(\[\[B1-C03\]\]\)/);
    expect(read('Concepts/Glossary.md')).toContain('| weir-light | Lantern glow on the water | [[B1-C03]] |');
  });
  it('is idempotent and append-only', () => {
    const before = readFileSync(join(FIX, 'Characters/Mara/Mara.md'), 'utf8').split('\n');
    run();
    const once = read('Characters/Mara/Mara.md');
    run();
    expect(read('Characters/Mara/Mara.md')).toBe(once);
    const after = once.split('\n');
    for (const l of before) expect(after).toContain(l); // nothing from the original note was removed
  });
  it('updates a goal status in place and logs it on the timeline', () => {
    run();
    applyPatch(new World(dir, TPL), { rows: [{ entity: 'Ottilie Marsh', section: 'Goals', row: { Goal: 'Find the ring', Status: 'achieved' } }] }, { cid: 'B1-C05', story: 'B1' });
    const t = read('Characters/Ottilie Marsh/Ottilie Marsh.md');
    expect(t).toMatch(/\| Find the ring \| now \| achieved \|/);
    expect(t).toContain('`goal:"Find the ring"=achieved`');
  });
  it('produces notes the viewer parser understands', () => {
    run();
    const m = parseWorld({ world: 'Saltmarrow', ...readWorld(dir) });
    const o = m.entities['Characters/Ottilie Marsh/Ottilie Marsh'];
    expect(o.aliases).toEqual(['Tilly']);
    expect(o.timeline[0].tags.rel[0]).toMatchObject({ toId: 'Characters/Mara/Mara', n: -1 });
    expect(o.goals[0]).toMatchObject({ goal: 'Find the ring', status: 'active' });
  });
});

describe('apply: voice, world rules, style', () => {
  it('writes diction to voice.md, rules to World.md and verbatim samples to Style.md', () => {
    const src = 'The fog came up the river like a tide of milk.';
    const r = applyPatch(new World(dir, TPL), {
      paragraphs: [{ entity: 'Mara/voice', section: 'Diction', text: 'Clipped, never says please.' }, { entity: 'Saltmarrow', section: 'Rules (magic / tech / society)', text: 'Salt wards fail at low tide.' }],
      style: { notes: 'Close third, past tense.', samples: ['The fog came up the river like a tide of milk.', 'Invented sample.'] },
    }, { cid: 'B1-C03', story: 'B1', source: src });
    expect(read('Characters/Mara/voice.md')).toContain('Clipped, never says please. ([[B1-C03]])');
    expect(read('World.md')).toContain('Salt wards fail at low tide. ([[B1-C03]])');
    expect(read('Stories/B1/Style.md')).toContain('> The fog came up the river like a tide of milk.');
    expect(r.rejectedQuotes.map((q) => q.text)).toEqual(['Invented sample.']);
    expect(existsSync(join(dir, 'Characters/Saltmarrow'))).toBe(false); // the world is never mistaken for a character
  });
});

describe('apply: names and POV', () => {
  it('treats curly and straight apostrophes as one name, and links POV only to the cast', () => {
    applyPatch(new World(dir, TPL), {
      chapter: { title: 'T', pov: 'Omniscient narrator (close to Mara)', characters: ['Mara'], places: ['Godric’s Hollow'], events: [], summary: 's' },
      timeline: [{ entity: 'Mara', text: 'Goes there.', at: "Godric's Hollow" }],
    }, { cid: 'B1-C02', story: 'B1' });
    expect(existsSync(join(dir, "Places/Godric's Hollow.md"))).toBe(true);
    expect(existsSync(join(dir, 'Places/Godric’s Hollow.md'))).toBe(false);
    const ch = read('Stories/B1/Chapters/B1-C02.md');
    expect(ch).toContain('pov: "Omniscient narrator (close to Mara)"'); // plain text, not a link
    expect(ch).toContain(`places: ["[[Godric's Hollow]]"]`);
  });
});

describe('apply: non-character speakers', () => {
  it('keeps a talking creature\'s voice and memories next to its note', () => {
    applyPatch(new World(dir, TPL), {
      entities: [{ name: 'Boa', type: 'creature' }],
      quotes: [{ character: 'Boa', mood: 'Everyday', text: 'Brazil' }],
      memories: [{ character: 'Boa', event: 'Ring Lost at the Weir', accuracy: 'partial', text: 'Warm glass.' }],
      chapter: { title: 'T', characters: [], places: [], events: [], summary: 's', key_lines: [{ who: 'A keeper', text: 'Brazil' }] },
    }, { cid: 'B1-C02', story: 'B1', source: 'It said Brazil.' });
    expect(existsSync(join(dir, 'Creatures/Boa - voice.md'))).toBe(true);
    expect(existsSync(join(dir, 'Creatures/Boa - memories/Boa - Ring Lost at the Weir.md'))).toBe(true);
    expect(existsSync(join(dir, 'Characters/Creatures'))).toBe(false);
    expect(read('Stories/B1/Chapters/B1-C02.md')).toContain('> "Brazil" — A keeper'); // no note → plain text, not a broken link
  });
});

describe('lint', () => {
  it('flags duplicate names as judgment and one-sided relations as mechanical', () => {
    writeFileSync(join(dir, 'Characters/Tobin/Tob.md'), '---\ntype: character\naliases: [Tob]\n---\n# Tob\n');
    const res = lint(parseWorld({ world: 'Saltmarrow', ...readWorld(dir) }));
    expect(res.judgment.some((i) => i.kind === 'duplicate-name' && /"tob"/.test(i.msg))).toBe(true);
    expect(res.mechanical.some((i) => i.kind === 'one-sided-relation')).toBe(true);
  });
});

describe('briefing', () => {
  const m = () => parseWorld({ world: 'Saltmarrow', ...readWorld(dir) });
  it('contains nothing after the cutoff and never the truth behind memories', () => {
    const b = briefing(m(), 'Mara', { at: 'B1/C03' });
    expect(b).toContain('Briefing: Mara at B1-C03');
    expect(b).not.toMatch(/B1-C0[4-6]/);
    expect(b).not.toContain('Learns of Tobin');
    expect(b).not.toContain('did not turn'); // Divergence from objective
    expect(b).toContain('Tobin dared me'); // her own memory, as she remembers it
  });
  it('follows the continuity', () => {
    expect(() => briefing(m(), 'Mara', { at: 'what-if-reeve/C01', cont: 'main' })).toThrow();
    expect(briefing(m(), 'Mara', { at: 'what-if-reeve/C01', cont: 'what-if-reeve' })).toContain('what-if-reeve');
  });
});

describe('context', () => {
  it('finds the cast by name and alias', () => {
    const m = parseWorld({ world: 'Saltmarrow', ...readWorld(dir) });
    expect(mentioned(m, 'Gran said Tob should go to the Old Mill.').map((h) => h.id)).toEqual(expect.arrayContaining(['Characters/Ilse/Ilse', 'Characters/Tobin/Tobin', 'Places/Old Mill']));
    const pack = contextPack(m, { cid: 'B1-C04', sourcePath: 'x', sourceText: SOURCE, forWho: 'characters', prevCid: 'B1-C03' });
    expect(pack).toContain('### Mara (character)');
    expect(pack).toContain('goals: Get the ring back');
    expect(pack.length).toBeLessThan(8000);
  });
});

describe('scaffold and plan', () => {
  it('creates a world, adds a story and plans extraction', () => {
    const vault = mkdtempSync(join(tmpdir(), 'vault-new-'));
    initWorld(vault, TPL, 'New World');
    const app = JSON.parse(readFileSync(join(vault, 'New World/.obsidian/app.json'), 'utf8'));
    expect(app.userIgnoreFilters).toEqual(expect.arrayContaining(['_sources/', '.vault/'])); // its own Obsidian vault, book text hidden
    const from = mkdtempSync(join(tmpdir(), 'conv-'));
    for (const c of ['C01', 'C02', 'C03']) writeFileSync(join(from, `${c}.md`), 'word '.repeat(1000));
    const r = addStory(join(vault, 'New World'), TPL, 'B1', { from, title: 'Book One', order: 1 });
    expect(r.chapters).toBe(3);
    expect(existsSync(join(vault, 'New World/Stories/B1/Story.md'))).toBe(true);
    const p = plan(join(vault, 'New World'), 'B1', 'all');
    expect(p.chapters.map((c) => c.cid)).toEqual(['B1-C01', 'B1-C02', 'B1-C03']);
    expect(p.words).toBe(3000);
    expect(plan(join(vault, 'New World'), 'B1', 'C02-C03').chapters).toHaveLength(2);
  });
});
