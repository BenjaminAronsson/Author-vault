// @vitest-environment jsdom
// Smoke test for the viewer itself: mount the whole app on each world and walk every view at several
// bookmarks, with spoilers hidden and dimmed. Anything that throws while rendering (a duplicate {#each}
// key, reading a field of something missing, NaN in an SVG attribute) or logs an error fails the test.
// The worlds: the two samples, a deliberately messy one, and an empty one.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mount, unmount, flushSync, tick } from 'svelte';
import { join } from 'node:path';
import { readWorldFolder } from '../scripts/read-world.mjs';
import { parseWorld } from '../src/parser/parse.js';

// ---- what jsdom lacks --------------------------------------------------------------------------------------
beforeAll(() => {
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  window.matchMedia ??= (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  globalThis.matchMedia ??= window.matchMedia;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ??= function () {};
  Element.prototype.setPointerCapture ??= function () {};
  HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
  HTMLDialogElement.prototype.close ??= function () { this.open = false; };
  SVGElement.prototype.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 });
  URL.createObjectURL ??= () => 'blob:test';
  // Svelte transitions use the Web Animations API: finish at once
  Element.prototype.animate ??= function () {
    const a = { currentTime: 0, playState: 'finished', finished: Promise.resolve(), cancel() {}, play() {}, pause() {}, finish() {}, _f: null };
    Object.defineProperty(a, 'onfinish', { get: () => a._f, set: (f) => { a._f = f; if (f) setTimeout(() => f(), 0); } });
    return a;
  };
  Element.prototype.getAnimations ??= () => [];
});

const fixture = (name) => {
  const dir = join(process.cwd(), 'fixtures/Sample', name); // vitest runs in site/
  return parseWorld({ world: name, ...readWorldFolder(dir) });
};
const fromFiles = (world, files) => parseWorld({ world, files: Object.entries(files).map(([path, text]) => ({ path, text })) });

// Notes the way people actually write them: links twice and through aliases, two rel tags to the same person
// in one line, a repeated heading, the same quote twice, a person with no dates, a marriage after the bookmark.
const MESSY = {
  'World.md': '---\ntype: world\n---\n# Messy',
  'Stories/B1/Story.md': '---\ntype: story\norder: 1\n---\n# B1',
  'Stories/B1/Chapters/B1-C01.md': '---\ntype: chapter\nwhen: B1/C01\npov: "[[Anna]]"\ncharacters: ["[[Anna]]", "[[Anna]]", "[[Annie]]", "[[Bo]]"]\nmentioned: ["[[Cid]]", "[[Cid]]"]\nplaces: ["[[Mill]]", "[[Mill]]"]\nevents: ["[[Fire]]", "[[Fire]]"]\n---\n# B1-C01 — One\n## Summary\nAnna and Bo.',
  'Stories/B1/Chapters/B1-C02.md': '---\ntype: chapter\nwhen: B1/C02\npov: "omniscient"\ncharacters: ["[[Bo]]", "[[Nobody]]"]\nplaces: ["[[Mill]]"]\n---\n# B1-C02 — Two',
  'Characters/Anna/Anna.md': [
    '---\ntype: character\naliases: [Annie]\nspouses: ["[[Bo]]"]\n---\n# Anna',
    '## Goals\n| Goal | Status |\n|---|---|\n| Keep the mill | active |\n| Keep the mill | active |',
    '## Fears\n| Fear |\n|---|\n| Fire |\n| Fire |',
    '## Relations\n| With | Bond | Feels |\n|---|---|---|\n| [[Bo]] | kin · make | warm |\n| [[Bo]] | rival | cold |',
    '## Timeline\n- **B1-C01** · `pov:objective` · `at:[[Mill]]` · `rel:[[Bo]]=ally/1` · `rel:[[Bo]]=rival/-1` · Twice in one line. ([[B1-C01]])',
    '- **B1-C01** · `pov:objective` · `rel:[[Bo]]=ally/2` · Again. ([[B1-C01]])',
    '## Notes\nfirst\n## Notes\nsecond',
  ].join('\n'),
  'Characters/Bo/Bo.md': '---\ntype: character\n---\n# Bo\n## Timeline\n- **B1-C02** · `pov:objective` · `at:[[Nowhere]]` · Moves. ([[B1-C02]])',
  'Characters/Cid/Cid.md': '---\ntype: character\n---\n# Cid\n## Timeline\n- **B1-C01** · `pov:objective` · `presence:mentioned` · Talked about. ([[B1-C01]])',
  'Places/Mill.md': '---\ntype: location\nmap: {x: 0.4, y: 0.5}\n---\n# Mill',
  'Events/Fire.md': '---\ntype: event\n---\n# Fire',
};
const MESSY_FAMILY = {
  'World.md': '---\ntype: world\nkind: genealogy\n---\n# Messy family',
  'Characters/Per/Per.md': '---\ntype: character\nborn: "1812"\nchildren: ["[[Anna]]", "[[Anna]]"]\nspouses: ["[[Kajsa]]"]\n---\n# Per\n## Relations\n| With | Bond | What they feel | What the other feels back | Changes over time |\n|---|---|---|---|---|\n| [[Kajsa]] | kin · maka |  |  | gift från 1890, belagd ([[arkiv-C01]]) |\n## Timeline\n- **1812** · `pov:objective` · Född. ([[arkiv-C01]])',
  'Characters/Kajsa/Kajsa.md': '---\ntype: character\nborn: "1815"\nchildren: ["[[Anna]]"]\n---\n# Kajsa\n## Timeline\n- **odaterat** · `pov:objective` · Nämns. ([[arkiv-C01]])',
  'Characters/Anna/Anna.md': '---\ntype: character\nborn: "1843"\nparents: ["[[Per]]", "[[Kajsa]]", "[[Per]]"]\nchildren: ["[[Lill]]"]\n---\n# Anna\n## Timeline\n- **1843** · `pov:objective` · Född. ([[arkiv-C01]])',
  'Characters/Lill/Lill.md': '---\ntype: character\nborn: "1870"\nparents: ["[[Anna]]"]\n---\n# Lill\n## Timeline\n- **odaterat** · `pov:objective` · Inget datum. ([[arkiv-C01]])',
  'Stories/arkiv/Story.md': '---\ntype: story\norder: 1\narchive: true\n---\n# arkiv',
  'Stories/arkiv/Chapters/arkiv-C01.md': '---\ntype: chapter\nwhen: arkiv/C01\ncharacters: ["[[Per]]"]\n---\n# arkiv-C01 — Källa',
};

const WORLDS = {
  Saltmarrow: () => fixture('Saltmarrow'),
  Norrgården: () => fixture('Norrgården'),
  Messy: () => fromFiles('Messy', MESSY),
  'Messy family': () => fromFiles('Messy family', MESSY_FAMILY),
  Empty: () => fromFiles('Empty', { 'World.md': '---\ntype: world\n---\n# Empty' }),
};
const VIEWS = ['home', 'timeline', 'people', 'family', 'places', 'reader'];

let errors = [];
const spy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')));
const onError = (ev) => errors.push(String(ev.error?.stack ?? ev.message));
afterAll(() => spy.mockRestore());

async function settle() { flushSync(); await tick(); await new Promise((r) => setTimeout(r, 0)); flushSync(); }

describe('every view renders on every world', async () => {
  const { store } = await import('../src/lib/store.svelte.js');
  const { default: App } = await import('../src/App.svelte');
  for (const [name, make] of Object.entries(WORLDS)) {
    it(name, async () => {
      errors = [];
      window.addEventListener('error', onError);
      localStorage.setItem('tour:done', '1');
      const model = make();
      store.model = model;
      store.view = 'home';
      const target = document.createElement('div');
      document.body.append(target);
      const app = mount(App, { target });
      try {
        await settle();
        const seq = store.sequence;
        const marks = [...new Set([seq[0], seq[Math.floor(seq.length / 2)], seq.at(-1)])].filter(Boolean);
        const pick = (type) => Object.values(model.entities).find((e) => e.type === type)?.id;
        const pages = ['character', 'location', 'event', 'media'].map(pick).filter(Boolean);
        for (const future of ['hide', 'dim']) {
          store.future = future;
          for (const at of marks.length ? marks : [null]) {
            store.at = at;
            for (const v of VIEWS) {
              store.go(v);
              await settle();
              expect(errors, `${name} · ${v} · at ${at} · future ${future}`).toEqual([]);
            }
            for (const id of pages) {
              store.go('entity', id);
              await settle();
              expect(errors, `${name} · page ${id} · at ${at}`).toEqual([]);
            }
          }
        }
        // the family tree in every style, around everyone
        if (model.genealogy) {
          store.at = null;
          for (const style of ['tree', 'descendants', 'ancestors', 'fan']) {
            localStorage.setItem('familyStyle', style);
            for (const p of Object.values(model.entities).filter((e) => e.type === 'character')) {
              store.go('family', p.id);
              await settle();
              expect(errors, `${name} · family ${style} · ${p.id}`).toEqual([]);
            }
          }
        }
        // nothing on screen says NaN or undefined
        expect(target.innerHTML).not.toMatch(/="NaN"|NaN px|>undefined</);
      } finally {
        unmount(app);
        target.remove();
        window.removeEventListener('error', onError);
      }
    }, 60000);
  }
});

describe('the family tree grows with the bookmark', async () => {
  const { store } = await import('../src/lib/store.svelte.js');
  const { default: App } = await import('../src/App.svelte');
  it('hides people born later and marriages that have not happened, until the bookmark gets there', async () => {
    localStorage.setItem('familyStyle', 'tree');
    const model = fromFiles('Messy family', MESSY_FAMILY);
    store.model = model;
    store.future = 'hide';
    const target = document.createElement('div');
    document.body.append(target);
    const app = mount(App, { target });
    try {
      const shown = () => [...target.querySelectorAll('.ft .node')].map((n) => n.dataset.entity);
      const rings = () => target.querySelectorAll('.ft .ring').length;
      store.at = '1843';
      store.go('family', 'Characters/Anna/Anna');
      await settle();
      expect(shown()).toContain('Characters/Anna/Anna');
      expect(shown()).not.toContain('Characters/Lill/Lill'); // born 1870
      expect(rings()).toBe(0); // Per and Kajsa marry in 1890
      store.at = store.sequence.at(-1);
      await settle();
      expect(shown()).toContain('Characters/Lill/Lill');
      expect(rings()).toBe(1);
    } finally { unmount(app); target.remove(); }
  });
});
