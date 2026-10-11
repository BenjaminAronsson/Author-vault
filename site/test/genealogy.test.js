import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { World, applyPatch, readWorld, timelineLine } from '../src/vault/apply.js';
import { parseWorld } from '../src/parser/parse.js';
import { buildClock, buildSnapshots, introductionIndex } from '../src/parser/derive.js';
import { lint } from '../src/vault/lint.js';
import { briefing } from '../src/vault/briefing.js';
import { initWorld, addArchive, readArchive } from '../src/vault/scaffold.js';

const TPL = new URL('../../book-universe/_system/templates', import.meta.url).pathname;
const FIX = new URL('../fixtures/slakt', import.meta.url).pathname;
let dir, vault;
beforeEach(() => {
  vault = mkdtempSync(join(tmpdir(), 'slakt-'));
  dir = initWorld(vault, TPL, 'Släkten', { kind: 'genealogy' }).dir;
});
afterEach(() => rmSync(vault, { recursive: true, force: true }));
const read = (rel) => readFileSync(join(dir, rel), 'utf8');
const model = () => parseWorld({ world: 'Släkten', ...readWorld(dir) });
const apply = (patch, cid = 'arkiv-C01') => applyPatch(new World(dir, TPL), patch, { cid, story: 'arkiv', canon: 'book' });
const src = (name, text) => { const p = join(vault, name); writeFileSync(p, text); return { path: p, text }; };

const HUSFORHOR = {
  chapter: { title: 'Husförhör Kila 1840–1845', source_kind: 'husförhörslängd', evidence: 'primär', archive_ref: 'Kila AI:12 s. 47 (AID v12345.b52.s47)', file: 'husforhor.txt', dated: '1840–45',
    characters: ['Per Andersson (1812–1867)', 'Anna Persdotter (1843–1910)'], places: ['Norrgården'], summary: 'Hushållet på Norrgården.' },
  entities: [
    { name: 'Per Andersson (1812–1867)', type: 'character', aliases: ['Per Andersson'], fields: { born: '1812-06-24' } },
    { name: 'Anna Persdotter (1843–1910)', type: 'character', aliases: ['Anna Persdotter', 'Anna'], fields: { born: '1843-05-12' } },
    { name: 'Brita Olsdotter', type: 'character', fields: { born: '1822' } },
    { name: 'Norrgården', type: 'location', fields: { part_of: '[[Kila socken]]' } },
  ],
  timeline: [
    { entity: 'Anna Persdotter (1843–1910)', date: '1843-05-12', text: 'Föds på Norrgården.', at: 'Norrgården', evidence: 'primär', confidence: 'belagd' },
    { entity: 'Per Andersson (1812–1867)', date: '1812-06-24', text: 'Föds i Kila.' },
    { entity: 'Brita Olsdotter', date: '1844', text: 'Inflyttad från Godegård som piga.', at: 'Norrgården' },
    { entity: 'Brita Olsdotter', date: '1845', text: 'Utflyttad till Motala.', at: 'Motala' },
    { entity: 'Brita Olsdotter', text: 'Konfirmerad (år okänt).' },
  ],
  kin: [
    { a: 'Per Andersson (1812–1867)', b: 'Anna Persdotter (1843–1910)', kind: 'parent', role: 'far', detail: 'biologisk', confidence: 'belagd' },
    { a: 'Brita Olsdotter', b: 'Per Andersson (1812–1867)', kind: 'household', role: 'piga', back: 'husbonde', at: 'Norrgården', from: '1844', to: '1845' },
  ],
};

describe('scaffold', () => {
  it('makes a genealogy world with an archive story', () => {
    expect(read('World.md')).toMatch(/^kind: genealogy$/m);
    expect(read('Stories/arkiv/Story.md')).toMatch(/kind: "archive"/);
  });
  it('adds archive files once, new versions get a new number', () => {
    const a = src('brev.txt', 'Kära syster'), b = src('dod.txt', 'Död 1867');
    expect(addArchive(dir, TPL, [a, b]).added.map((x) => x.cid)).toEqual(['arkiv-C01', 'arkiv-C02']);
    expect(read('_sources/arkiv/C01.md')).toMatch(/^# brev\.txt\n\nKära syster/);
    expect(existsSync(join(dir, '_sources/arkiv/original/C01-brev.txt'))).toBe(true);
    expect(addArchive(dir, TPL, [a]).skipped).toEqual(['brev.txt']); // unchanged: skipped
    const a2 = src('brev.txt', 'Kära syster Anna!');
    expect(addArchive(dir, TPL, [a2]).added).toEqual([{ cid: 'arkiv-C03', file: 'brev.txt', replaces: 'arkiv-C01' }]);
    expect(readArchive(dir).map((x) => x.num)).toEqual(['C01', 'C02', 'C03']);
    const pic = src('foto.png', 'png-bytes');
    const r = addArchive(dir, TPL, [{ ...src('med-foto.txt', 'Brev med foto'), media: [pic.path] }]);
    expect(r.added[0]).toMatchObject({ cid: 'arkiv-C04', images: 1 });
    expect(existsSync(join(dir, '_assets/sources/arkiv-C04/arkiv-C04-foto.png'))).toBe(true);
    expect(read('_sources/arkiv/C04.md')).toMatch(/## Bilder i filen\n!\[\[arkiv-C04-foto\.png\]\]/);
  });
  it('converts the fixture files (txt in cp1252, docx)', () => {
    expect(existsSync(join(FIX, 'brev-johan-1868.docx'))).toBe(true);
  });
});

describe('apply in a genealogy world', () => {
  it('writes date markers, evidence tags and the source citation', () => {
    apply(HUSFORHOR);
    const anna = read('Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910).md');
    expect(anna).toContain('- **1843-05-12** · `pov:objective` · `evidence:primär` · `confidence:belagd` · `at:[[Norrgården]]` · Föds på Norrgården. ([[arkiv-C01]])');
    expect(read('Characters/Brita Olsdotter/Brita Olsdotter.md')).toContain('- **odaterat** · `pov:objective` · Konfirmerad (år okänt). ([[arkiv-C01]])');
    const ch = read('Stories/arkiv/Chapters/arkiv-C01.md');
    expect(ch).toContain('evidence: "primär"');
    expect(ch).toContain('archive_ref: "Kila AI:12 s. 47 (AID v12345.b52.s47)"');
  });
  it('writes kinship on both sides, as links and Relations rows', () => {
    apply(HUSFORHOR);
    const anna = read('Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910).md');
    const per = read('Characters/Per Andersson (1812–1867)/Per Andersson (1812–1867).md');
    expect(anna).toMatch(/^parents: \["\[\[Per Andersson \(1812–1867\)\]\]"\]$/m);
    expect(per).toMatch(/^children: \["\[\[Anna Persdotter \(1843–1910\)\]\]"\]$/m);
    expect(anna).toMatch(/\| \[\[Per Andersson \(1812–1867\)\]\] \| kin · far \|.*biologisk, belagd \(\[\[arkiv-C01\]\]\) \|/);
    expect(per).toMatch(/\| \[\[Anna Persdotter \(1843–1910\)\]\] \| kin · barn \|/);
    expect(read('Characters/Brita Olsdotter/Brita Olsdotter.md')).toMatch(/hushåll · husbonde \|.*från 1844 till 1845, på \[\[Norrgården\]\]/);
    expect(per).toMatch(/hushåll · piga/);
    apply(HUSFORHOR); // idempotent
    expect(read('Characters/Per Andersson (1812–1867)/Per Andersson (1812–1867).md')).toBe(per);
  });
  it('keeps the timeline in date order across sources', () => {
    apply(HUSFORHOR);
    apply({ timeline: [{ entity: 'Brita Olsdotter', date: 'ca 1840', text: 'Tjänar i Godegård.' }] }, 'arkiv-C02');
    const t = read('Characters/Brita Olsdotter/Brita Olsdotter.md').split('\n').filter((l) => l.startsWith('- **') && l.includes(' · ')).map((l) => /\*\*(.+?)\*\*/.exec(l)[1]);
    expect(t).toEqual(['odaterat', 'ca 1840', '1844', '1845']);
  });
  it('fills empty fields from later sources and records conflicting ones as contradictions', () => {
    apply(HUSFORHOR);
    const r = apply({ entities: [{ name: 'Anna Persdotter', type: 'character', fields: { born: 'midsommardagen 1844', died: '1910' } }] }, 'arkiv-C02');
    const anna = read('Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910).md');
    expect(anna).toMatch(/^born: "1843-05-12"$/m); // kept
    expect(anna).toMatch(/^died: "1910"$/m); // filled
    expect(anna).toContain('> [!warning] Contradiction · born: "1843-05-12" (kept) vs "midsommardagen 1844" ([[arkiv-C02]])');
    expect(r.warnings.join()).toMatch(/contradiction/);
  });
  it('book worlds are unchanged: the marker stays the chapter', () => {
    expect(timelineLine('B1-C03', { text: 'x' })).toBe('- **B1-C03** · `pov:objective` · x ([[B1-C03]])');
  });
});

describe('the clock is in-world time', () => {
  it('builds date steps in real order, odaterat first, and no archive steps', () => {
    apply(HUSFORHOR);
    const m = model();
    expect(m.genealogy).toBe(true);
    const seq = buildClock(m).sequences.main;
    expect(seq).toEqual(['odaterat', '1812-06-24', '1822', '1840–45', '1843-05-12', '1844', '1845']);
    expect(m.chapters['1843-05-12'].characters).toContain('Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910)');
    expect(m.chapters['1843-05-12'].places).toContain('Places/Norrgården');
  });
  it('people appear when born and move with at:', () => {
    apply(HUSFORHOR);
    const m = model();
    const seq = buildClock(m).sequences.main;
    const intro = introductionIndex(m, seq);
    const anna = 'Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910)';
    expect(seq[intro[anna]]).toBe('1843-05-12');
    expect(intro['Stories/arkiv/Chapters/arkiv-C01']).toBe(-1); // sources are always visible
    const snaps = buildSnapshots(m, seq);
    const brita = 'Characters/Brita Olsdotter/Brita Olsdotter';
    expect(snaps[seq.indexOf('1844')].presence[brita].place).toBe('Places/Norrgården');
    expect(snaps[seq.indexOf('1845')].presence[brita].place).toBe('Places/Motala');
  });
  it('parses kin, born/died and evidence for the viewer', () => {
    apply(HUSFORHOR);
    const m = model();
    const anna = m.entities['Characters/Anna Persdotter (1843–1910)/Anna Persdotter (1843–1910)'];
    expect(anna.kin.parents).toEqual(['Characters/Per Andersson (1812–1867)/Per Andersson (1812–1867)']);
    expect(anna.born).toBe('1843-05-12');
    expect(anna.timeline.find((t) => t.marker === '1843-05-12')).toMatchObject({ evidence: 'primär', confidence: 'belagd' });
  });
  it('/become briefings cut off at a date', () => {
    apply(HUSFORHOR);
    const b = briefing(model(), 'Brita Olsdotter', { at: '1844' });
    expect(b).toContain('Inflyttad från Godegård');
    expect(b).not.toContain('Utflyttad till Motala');
    expect(b).toContain('- where: Norrgården');
    expect(b).toContain('- age: about 22 (uncertain dates)');
    const a = briefing(model(), 'Anna Persdotter', { at: '1850-01-01' });
    expect(a).toContain('# Briefing: Anna Persdotter (1843–1910) at 1845');
    expect(a).toContain('- Parents: Per Andersson (1812–1867)');
    expect(a).toContain('- age: about 6');
  });
});

describe('lint for genealogy', () => {
  it('does not ask for goals/fears/dreams but checks kinship and identity', () => {
    apply(HUSFORHOR);
    apply({
      entities: [
        { name: 'Anna Persdotter', type: 'character' }, // resolves to the existing note via alias
        { name: 'Anna Persdotter (1844)', type: 'character', fields: { born: '1844' } },
        { name: 'Lill-Per', type: 'character', fields: { born: '1870' } },
        { name: 'Erik Svensson', type: 'character', fields: { born: '1960' } },
      ],
      kin: [{ a: 'Anna Persdotter (1843–1910)', b: 'Lill-Per', kind: 'parent', role: 'mor' }, { a: 'Brita Olsdotter', b: 'Anna Persdotter (1843–1910)', kind: 'parent', role: 'mor' }],
    }, 'arkiv-C02');
    const kinds = lint(model()).issues.map((i) => i.kind);
    expect(kinds).not.toContain('missing-essential');
    expect(kinds).toContain('possible-duplicate'); // Anna 1843 vs Anna 1844
    expect(kinds).toContain('maybe-living'); // Erik, born 1960
    const msgs = lint(model()).issues.map((i) => `${i.kind}: ${i.msg}`).join('\n');
    expect(msgs).not.toMatch(/parent-age/);
    expect(msgs).not.toMatch(/timeline-order/);
  });
  it('flags impossible kinship', () => {
    apply(HUSFORHOR);
    apply({ entities: [{ name: 'Per Andersson (1812–1867)', type: 'character', fields: { died: '1867-11-02' } }, { name: 'Sena Karin', type: 'character', fields: { born: '1870', died: '1869' } }],
      kin: [{ a: 'Anna Persdotter (1843–1910)', b: 'Per Andersson (1812–1867)', kind: 'parent' }, { a: 'Per Andersson (1812–1867)', b: 'Sena Karin', kind: 'parent' }] }, 'arkiv-C02');
    const msgs = lint(model()).issues.map((i) => `${i.kind}: ${i.msg}`).join('\n');
    expect(msgs).toMatch(/parent-age: Anna Persdotter \(1843–1910\) \(born 1843-05-12\) is -31 years older/);
    expect(msgs).toMatch(/died-before-born/);
    expect(msgs).toMatch(/born-after-parent-death/);
  });
});

describe('context pack for an archive source', () => {
  it('lists known namesakes with their identity facts', async () => {
    const { contextPack } = await import('../src/vault/context.js');
    apply(HUSFORHOR);
    const pack = contextPack(model(), { cid: 'arkiv-C02', sourcePath: '_sources/arkiv/C02.md', sourceText: 'Mormor Anna berättade alltid att hon var född på midsommardagen.' });
    expect(pack).toContain('Source file:');
    expect(pack).toMatch(/### Anna Persdotter \(1843–1910\) \(character\).*\n- född 1843-05-12 · föräldrar: Per Andersson \(1812–1867\)/);
  });
});

describe('family tree', () => {
  it('lays out ancestors, spouses and descendants, read from either side', async () => {
    const { kinIndex, familyTree, lifespan } = await import('../src/lib/kin.js');
    apply(HUSFORHOR);
    apply({
      entities: [{ name: 'Erik Svensson', type: 'character', fields: { born: 'ca 1840' } }, { name: 'Lill-Per', type: 'character', fields: { born: '1868' } }, { name: 'Kajsa Jansdotter', type: 'character', fields: { born: '1815' } }],
      kin: [
        { a: 'Erik Svensson', b: 'Anna Persdotter (1843–1910)', kind: 'spouse', from: '1866' },
        { a: 'Anna Persdotter (1843–1910)', b: 'Lill-Per', kind: 'parent', role: 'mor' },
        { a: 'Kajsa Jansdotter', b: 'Anna Persdotter (1843–1910)', kind: 'parent', role: 'mor' },
      ],
    }, 'arkiv-C02');
    const m = model();
    const id = (n) => m.nameIndex[n.toLowerCase()];
    const t = familyTree(m, kinIndex(m), id('Anna Persdotter'));
    expect(t.rows.map((r) => [r.gen, r.ids.map((x) => m.entities[x].title)])).toEqual([
      [-1, ['Per Andersson (1812–1867)', 'Kajsa Jansdotter']],
      [0, ['Anna Persdotter (1843–1910)', 'Erik Svensson']],
      [1, ['Lill-Per']],
    ]);
    expect(t.edges).toContainEqual({ from: id('Kajsa Jansdotter'), to: id('Anna Persdotter') });
    expect(t.spouses.length).toBe(1);
    const hidden = familyTree(m, kinIndex(m), id('Anna Persdotter'), { keep: (x) => x !== id('Lill-Per') });
    expect(hidden.rows.map((r) => r.gen)).toEqual([-1, 0]);
    expect(lifespan(m.entities[id('Erik Svensson')])).toBe('f. ca 1840');
    expect(lifespan({ born: '1843-05-12', died: '1910' })).toBe('1843–1910');
  });
});

describe('living people', () => {
  it('are replaced by placeholders with --redact-living, and other notes stop naming them', async () => {
    const { redactLiving } = await import('../src/lib/privacy.js');
    apply(HUSFORHOR);
    apply({
      entities: [{ name: 'Greta Nu', type: 'character', fields: { born: '1950', living: true } }],
      timeline: [{ entity: 'Anna Persdotter (1843–1910)', date: '1950', text: 'Hennes barnbarnsbarn [[Greta Nu]] föds.' }, { entity: 'Greta Nu', date: '1950', text: 'Föds.' }],
      kin: [{ a: 'Anna Persdotter (1843–1910)', b: 'Greta Nu', kind: 'parent', role: 'mor' }],
    }, 'arkiv-C02');
    const raw = model();
    const g = raw.nameIndex['greta nu'];
    expect(raw.entities[g].living).toBe(true);
    const { model: m, count } = redactLiving(raw);
    expect(count).toBe(1);
    expect(JSON.stringify(m)).not.toMatch(/Greta/);
    const ph = m.nameIndex['levande person 1'];
    expect(m.entities[ph].title).toBe('Levande person 1');
    expect(m.entities[ph].timeline).toEqual([]);
    expect(m.entities[m.nameIndex['anna persdotter']].kin.children).toContain(ph); // the tree keeps its shape
  });
});

describe('fixes from the end-to-end run', () => {
  it('a child written as kind parent is turned around', () => {
    apply(HUSFORHOR);
    const r = apply({ kin: [{ a: 'Anna Persdotter', b: 'Per Andersson (1812–1867)', kind: 'parent', role: 'dotter', back: 'far' }, { a: 'Brita Olsdotter', b: 'Per Andersson (1812–1867)', kind: 'child' }] }, 'arkiv-C02');
    const m = model();
    const per = m.entities[m.nameIndex['per andersson']];
    expect(per.kin.parents).toEqual([]);
    expect(per.kin.children.map((x) => m.entities[x].title).sort()).toEqual(['Anna Persdotter (1843–1910)', 'Brita Olsdotter']);
    expect(r.warnings.join()).toMatch(/stored as Per Andersson \(1812–1867\) parent of Anna Persdotter/);
  });
  it('an undated death does not kill someone from the first step', () => {
    apply(HUSFORHOR);
    apply({ timeline: [{ entity: 'Per Andersson (1812–1867)', text: 'Dog när Anna var ung (minnen).', status: 'dead' }] }, 'arkiv-C02');
    const m = model();
    const seq = buildClock(m).sequences.main;
    const snaps = buildSnapshots(m, seq);
    const per = m.nameIndex['per andersson'];
    expect(snaps.at(-1).status[per]).toBeUndefined();
    expect(lint(m).issues.map((i) => i.kind)).not.toContain('after-death');
  });
  it('briefings leave out template hints', () => {
    apply(HUSFORHOR);
    const b = briefing(model(), 'Anna Persdotter', { at: '1845' });
    expect(b).not.toMatch(/Who they are underneath|devotion \(zealous|\[active \/ achieved/);
  });
});

describe('relation types in the tree', () => {
  it('reads type, confidence and marriage year from the Relations rows', async () => {
    const { kinDetail } = await import('../src/lib/kin.js');
    apply(HUSFORHOR);
    apply({ entities: [{ name: 'Erik Svensson', type: 'character' }, { name: 'Lill-Per', type: 'character' }],
      kin: [{ a: 'Erik Svensson', b: 'Anna Persdotter', kind: 'spouse', from: '1866', confidence: 'trolig' }, { a: 'Anna Persdotter', b: 'Lill-Per', kind: 'parent', role: 'fostermor', detail: 'foster', confidence: 'hypotes' }] }, 'arkiv-C02');
    const m = model();
    const id = (n) => m.nameIndex[n.toLowerCase()];
    expect(kinDetail(m, id('Anna Persdotter'), id('Per Andersson'))).toEqual({ type: 'biologisk', confidence: 'belagd', from: null });
    expect(kinDetail(m, id('Erik Svensson'), id('Anna Persdotter'))).toMatchObject({ confidence: 'trolig', from: '1866' });
    expect(kinDetail(m, id('Lill-Per'), id('Anna Persdotter'))).toMatchObject({ type: 'foster', confidence: 'hypotes' });
  });
});

describe('GEDCOM export', () => {
  it('writes people, families, sources and Swedish date qualifiers', async () => {
    const { toGedcom, gedcomDate, gedcomName } = await import('../src/vault/gedcom.js');
    expect(gedcomDate('1843-05-12')).toBe('12 MAY 1843');
    expect(gedcomDate('ca 1843')).toBe('ABT 1843');
    expect(gedcomDate('före 1850')).toBe('BEF 1850');
    expect(gedcomDate('1840–45')).toBe('BET 1840 AND 1845');
    expect(gedcomDate('midsommardagen 1844')).toBe('(midsommardagen 1844)');
    expect(gedcomName('Anna Persdotter (1843–1910)')).toBe('Anna /Persdotter/');
    apply(HUSFORHOR);
    apply({ entities: [{ name: 'Kajsa Jansdotter', type: 'character', fields: { born: '1815' } }, { name: 'Greta Nu', type: 'character', fields: { living: true } }],
      kin: [{ a: 'Kajsa Jansdotter', b: 'Anna Persdotter', kind: 'parent', role: 'mor' }, { a: 'Per Andersson', b: 'Kajsa Jansdotter', kind: 'spouse', from: '1840' }, { a: 'Anna Persdotter', b: 'Greta Nu', kind: 'parent', role: 'mor' }] }, 'arkiv-C02');
    const g = toGedcom(model());
    expect(g).toMatch(/^0 HEAD\n/);
    expect(g).toMatch(/0 TRLR\n$/);
    expect(g).not.toMatch(/Greta/);
    expect(g).toMatch(/1 NAME Anna \/Persdotter\/\n(.*\n)*?1 BIRT\n2 DATE 12 MAY 1843\n2 PLAC Norrgården\n2 SOUR @S1@\n3 QUAY 3/);
    expect(g).toMatch(/0 @F\d+@ FAM\n1 HUSB @I\d+@\n1 WIFE @I\d+@\n1 MARR\n2 DATE 1840\n1 CHIL @I\d+@/);
    expect(g).toMatch(/0 @S1@ SOUR\n1 TITL Husförhör Kila 1840–1845\n1 PUBL Kila AI:12/);
    expect(g).toMatch(/1 SEX F\n1 FAMC/);
    expect(toGedcom(model(), { includeLiving: true })).toMatch(/Greta/);
  });
});

describe('ages', () => {
  it('shows the age reached for the dead, and no silly ages without a death', async () => {
    const { ageAt, ageLabel, lifeLine } = await import('../src/lib/kin.js');
    const { parseDate } = await import('../src/lib/dates.js');
    const at = (d) => parseDate(d);
    const per = { born: '1812-06-24', died: '1867-11-02' };
    expect(ageLabel(ageAt(per, at('1850')))).toBe('ca 37'); // year-only bookmark
    expect(ageLabel(ageAt(per, at('1952')))).toBe('55 at death');
    expect(ageLabel(ageAt(per, at('1952')), { short: true })).toBe('55 †');
    expect(lifeLine(per)).toBe('1812–1867 (55)');
    const brita = { born: '1822' };
    expect(ageLabel(ageAt(brita, at('1868')))).toBe('ca 46');
    expect(ageAt(brita, at('1952'))).toMatchObject({ age: null, deathUnknown: true });
    expect(ageLabel(ageAt(brita, at('1952')))).toBe('death not recorded');
    expect(ageAt({ born: '1900', living: true }, at('2020')).age).toBe(120); // living: shown as is
  });
});

describe('photos', () => {
  it('compresses a picture into a tagged Media note that links back to the people in it', async () => {
    const { default: sharp } = await import('sharp');
    const { addMedia } = await import('../src/vault/media.js');
    apply(HUSFORHOR);
    const big = join(vault, 'Bröllop_1866.png');
    await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#a87' } }).png().toFile(big);
    const r = await addMedia(dir, big, { depicts: ['Anna Persdotter (1843–1910)'], date: '1866', place: 'Norrgården', caption: 'Bröllopet', sharp });
    expect(r.note).toBe('Media/Bröllop 1866.md');
    expect(r.file).toBe('_assets/media/Bröllop 1866.webp');
    const meta = await sharp(join(dir, r.file)).metadata();
    expect(Math.max(meta.width, meta.height)).toBe(2000);
    // a second photo with the same name never overwrites the first
    expect((await addMedia(dir, big, { sharp })).note).toBe('Media/Bröllop 1866 2.md');
    const m = model();
    const anna = m.nameIndex['anna persdotter'];
    const photo = m.entities['Media/Bröllop 1866'];
    expect(photo.image).toBe(r.file);
    expect(photo.depicts).toEqual([anna]);
    expect(m.entities[anna].media).toContain('Media/Bröllop 1866');
    expect(m.entities[m.nameIndex['norrgården']].media).toContain('Media/Bröllop 1866');
  });
  it('a patch tags pictures already in the world, once', async () => {
    apply(HUSFORHOR);
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, '_assets/sources/arkiv-C01'), { recursive: true });
    writeFileSync(join(dir, '_assets/sources/arkiv-C01/image1.jpg'), 'x');
    const p = { media: [{ file: '_assets/sources/arkiv-C01/image1.jpg', depicts: ['Per Andersson (1812–1867)'], caption: 'Per vid ladan', date: 'ca 1860' }] };
    apply(p); apply(p);
    expect(read('Media/Per vid ladan.md')).toContain('depicts: ["[[Per Andersson (1812–1867)]]"]');
    expect(existsSync(join(dir, 'Media/Per vid ladan 2.md'))).toBe(false);
  });
});
