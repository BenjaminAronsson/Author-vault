<script>
  import { store } from '../lib/store.svelte.js';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import { wikilinks, chapterRef, stripLinks } from '../parser/markdown.js';
  import WorldMap from '../components/WorldMap.svelte';
  import TravelGraph from '../components/TravelGraph.svelte';

  let mapMode = $state('map');
  let allMoves = $state(false);
  let tspan = $state(store.books.length > 1 ? 'book' : 'all');
  const from = $derived(tspan === 'book' ? store.book.start : tspan === 'recent' ? Math.max(0, store.idx - 14) : 0);

  let tab = $state('places');
  const res = (v) => wikilinks(v).map((n) => store.model.nameIndex[n.toLowerCase()]).filter(Boolean);
  const places = $derived(Object.values(store.model.entities).filter((e) => e.type === 'location' && store.visible(e.id)));
  // Precomputed once per change (big worlds have hundreds of places and a thousand people)
  const placeIds = $derived(new Set(places.map((p) => p.id)));
  const parents = $derived(Object.fromEntries(places.map((p) => [p.id, (p.partOf && placeIds.has(p.partOf) ? p.partOf : res(p.fm.part_of).find((x) => placeIds.has(x))) ?? null])));
  const children = $derived.by(() => { const c = {}; for (const p of places) { const par = parents[p.id]; if (par) (c[par] ??= []).push(p); } return c; });
  const parentOf = (p) => parents[p.id] ?? null;
  const roots = $derived(places.filter((p) => !parents[p.id]));
  const kids = (id) => children[id] ?? [];
  const here = $derived.by(() => {
    const m = {};
    for (const [w, p] of Object.entries(store.snap?.presence ?? {})) if (store.visible(w) && !/dead/.test(store.snap.status[w] ?? '')) (m[p.place] ??= []).push(w);
    return m;
  });
  const whoAt = (id) => here[id] ?? [];

  // Travel graph: places linked by consecutive character moves up to the bookmark
  const moves = $derived.by(() => {
    const m = {};
    for (const c of Object.keys(store.snap?.presence ?? {})) {
      let prev = null;
      for (let i = from; i <= store.idx; i++) {
        const p = store.snaps[i]?.presence[c]?.place;
        if (p && prev && p !== prev) { const k = [prev, p].sort().join('|'); (m[k] ??= new Set()).add(c); }
        if (p) prev = p;
      }
    }
    return Object.entries(m).map(([k, who]) => ({ a: k.split('|')[0], b: k.split('|')[1], who: [...who] }));
  });

  // History: eras + dated events + chronology lines, gated by reading order
  const eras = $derived(Object.values(store.model.entities).filter((e) => e.type === 'era' && store.visible(e.id)).sort((a, b) => (a.fm.order ?? 0) - (b.fm.order ?? 0)));
  const dated = $derived(Object.values(store.model.entities)
    .filter((e) => e.type === 'event' && e.fm.in_world !== undefined && e.fm.in_world !== '' && store.visible(e.id))
    .sort((a, b) => Number(a.fm.in_world) - Number(b.fm.in_world)));
  const chrono = $derived(Object.values(store.model.entities).find((e) => e.type === 'chronology'));
  const datedIds = $derived(new Set(dated.map((d) => d.id)));
  const plain = (t) => stripLinks(t.text).replace(/^[·\s]+|[·\s]+$/g, '');
  const chronoLines = $derived((chrono?.timeline ?? []).filter((t) => store.canonOk(t.canon) && t.links.every((l) => { const id = store.model.nameIndex[l.toLowerCase()]; const cid = chapterRef(l); return cid ? store.stepVisible(cid) : !id || store.visible(id); })).filter((t) => !t.links.some((l) => datedIds.has(store.model.nameIndex[l.toLowerCase()]))));
  // Era bands on an in-world axis
  const nums = (v) => (String(v ?? '').match(/[+-]?\d+/g) ?? []).map(Number);
  const bands = $derived(eras.map((e) => { const [a, b] = nums(e.fm.span); return { e, a, b: b ?? a }; }).filter((x) => x.a !== undefined));
  const points = $derived([
    ...dated.map((ev) => ({ id: ev.id, y: Number(ev.fm.in_world), label: ev.title })),
    ...chronoLines.filter((t) => /^[+-]?\d+$/.test(t.marker)).map((t) => ({ id: store.model.nameIndex[t.links[0]?.toLowerCase()] ?? null, y: Number(t.marker), label: plain(t) || t.links[0] })),
  ].filter((p, i, all) => all.findIndex((q) => q.label === p.label && q.y === p.y) === i));
  const dom = $derived.by(() => {
    const ys = [...bands.flatMap((b) => [b.a, b.b]), ...points.map((p) => p.y)];
    if (!ys.length) return null;
    const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max(2, (hi - lo) * 0.06);
    return [lo - pad, hi + pad];
  });
  const X = (y) => 40 + ((y - dom[0]) / (dom[1] - dom[0])) * 920;
  const ticks = $derived.by(() => {
    if (!dom) return [];
    const span = dom[1] - dom[0], step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => span / s <= 10) ?? 1000;
    const out = []; for (let t = Math.ceil(dom[0] / step) * step; t <= dom[1]; t += step) out.push(t);
    return out;
  });
</script>

<div class="pl">
  <div class="tabs" role="tablist">
    <button role="tab" class="btn" class:on={tab === 'places'} aria-selected={tab === 'places'} onclick={() => (tab = 'places')}>Places</button>
    <button role="tab" class="btn" class:on={tab === 'history'} aria-selected={tab === 'history'} onclick={() => (tab = 'history')}>History</button>
  </div>

  {#if tab === 'places'}
    <section class="card">
      <div class="tabs small">
        <button class="btn" class:on={mapMode === 'map'} onclick={() => (mapMode = 'map')}>Map</button>
        <button class="btn" class:on={mapMode === 'graph'} onclick={() => (mapMode = 'graph')} title="How places connect through characters' journeys (laid out automatically)">Travel graph</button>
      </div>
      {#if mapMode === 'map'}<WorldMap {places} />{/if}
      {#if mapMode === 'graph'}
        {@const active = places.length > 25 ? places.filter((p) => moves.some((m) => m.a === p.id || m.b === p.id) || whoAt(p.id).length) : places}
        <div class="small muted tspan">Journeys in
          <select bind:value={tspan}>{#if store.books.length > 1}<option value="book">this book</option>{/if}<option value="recent">the last 15 chapters</option><option value="all">the whole story so far</option></select>
          {#if active.length < places.length} · showing {active.length} of {places.length} places (the ones visited){/if}
        </div>
        <TravelGraph places={active} {moves} {parentOf} {whoAt} />
      {/if}
    </section>
    <div class="grid2">
      <section class="card">
        <div class="label">Places known at {store.chapter?.id}</div>
        {#snippet tree(list, depth)}
          {#each list as p (p.id)}
            <div class="place" style:margin-left={`${depth * 1.2}rem`} class:future={store.isFuture(p.id)}>
              <Avatar id={p.id} size={depth ? 34 : 46} />
              <div class="pinfo">
                <EntityLink id={p.id} />
                <div class="here">{#each whoAt(p.id).slice(0, 5) as w (w)}<span title={store.name(w)}><Avatar id={w} size={22} /></span>{/each}{#if whoAt(p.id).length > 5}<span class="more" title={whoAt(p.id).slice(5).map((w) => store.name(w)).join(', ')}>+{whoAt(p.id).length - 5}</span>{/if}</div>
              </div>
            </div>
            {@render tree(kids(p.id), depth + 1)}
          {/each}
        {/snippet}
        {@render tree(roots, 0)}
        {#if !places.length}<p class="muted">No places known yet.</p>{/if}
      </section>
      <section class="card">
        <div class="label">Journeys {tspan === 'book' ? 'in this book' : tspan === 'recent' ? 'in the last 15 chapters' : 'so far'}</div>
        {#each (allMoves ? moves : [...moves].sort((a, b) => b.who.length - a.who.length).slice(0, 40)) as m (m.a + m.b)}
          <div class="move small"><EntityLink id={m.a} /> ⇄ <EntityLink id={m.b} />
            <span class="here">{#each m.who.slice(0, 5) as w (w)}<span title={store.name(w)}><Avatar id={w} size={20} /></span>{/each}
        {#if moves.length > 40}<button class="link small" onclick={() => (allMoves = !allMoves)}>{allMoves ? 'Show the 40 busiest' : `Show all ${moves.length} journeys`}</button>{/if}{#if m.who.length > 5}<span class="more">+{m.who.length - 5}</span>{/if}</span></div>
        {:else}<p class="muted small">No one has moved between places yet.</p>{/each}
        <p class="small muted">From <code>at:</code> tags, or each chapter's places when tags are missing.</p>
      </section>
    </div>
  {:else}
    {#if dom}
      <section class="card">
        <div class="label">In-world time</div>
        <svg viewBox="0 0 1000 180" class="bands" role="img" aria-label="Eras and dated events">
          {#each ticks as t (t)}<line x1={X(t)} x2={X(t)} y1="10" y2="150" class="tick" /><text x={X(t)} y="168" text-anchor="middle" class="tl">{t}</text>{/each}
          {#each bands as b, i (b.e.id)}
            <g class="band" class:exp={b.e.canon === 'expansion'} role="button" tabindex="0" onclick={() => store.open(b.e.id)} onkeydown={(ev) => ev.key === 'Enter' && store.open(b.e.id)}>
              <rect x={X(b.a)} y={20 + (i % 2) * 26} width={Math.max(4, X(b.b) - X(b.a))} height="22" rx="4" />
              <text x={X(b.a) + 6} y={35 + (i % 2) * 26} class="bl">{b.e.title}</text>
            </g>
          {/each}
          {#each points as p, i (p.label + p.y)}
            <g class="pt" role="button" tabindex="0" onclick={() => p.id && store.open(p.id)} onkeydown={(ev) => ev.key === 'Enter' && p.id && store.open(p.id)}>
              <circle cx={X(p.y)} cy="100" r="6" />
              <text x={X(p.y)} y={i % 2 ? 132 : 122} text-anchor="middle" class="pl">{p.label}</text>
            </g>
          {/each}
        </svg>
      </section>
    {/if}
    <div class="grid2">
      <section class="card">
        <div class="label">Eras</div>
        {#each eras as e (e.id)}
          <div class="era" class:exp={e.canon === 'expansion'}>
            <div><EntityLink id={e.id} /> <span class="small muted">{e.fm.span ?? ''}</span></div>
            <div class="small">{(e.sections['In one breath']?.text ?? '').trim()}</div>
          </div>
        {:else}<p class="muted small">No eras recorded yet. Try <code>/create-history</code>.</p>{/each}
      </section>
      <section class="card">
        <div class="label">Chronology (in-world order)</div>
        {#each dated as ev (ev.id)}
          <div class="chr"><span class="yr">{ev.fm.in_world}</span><EntityLink id={ev.id} />{#if ev.fm.era}<span class="small muted"> · {wikilinks(ev.fm.era)[0]}</span>{/if}</div>
        {/each}
        {#each chronoLines as t, i (i)}
          <div class="chr"><span class="yr">{t.marker}</span><span>{#each t.links.filter((l) => !plain(t).includes(l)) as l, k (l)}{#if k}{', '}{/if}<EntityLink id={store.model.nameIndex[l.toLowerCase()]} label={l} />{' · '}{/each}{plain(t)}</span></div>
        {/each}
        {#if !dated.length && !chronoLines.length}<p class="muted small">Nothing dated yet.</p>{/if}
        <p class="small muted">Only what you've read about so far: a flashback in a later chapter appears once you reach it.</p>
      </section>
    </div>
  {/if}
</div>

<style>
  .pl { padding: 1rem; display: grid; gap: 1rem; max-width: 1200px; margin: 0 auto; }
  .tabs { display: flex; gap: .3rem; }
  .tabs .on { background: var(--ink); color: var(--paper); }
  .tspan { margin: .6rem 0 .2rem; }
  .tspan select { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; }
  .grid2 { display: grid; grid-template-columns: 1.3fr 1fr; gap: 1rem; align-items: start; }
  .place { display: flex; gap: .6rem; align-items: center; padding: .35rem 0; }
  .pinfo { display: grid; gap: .2rem; }
  .here { display: inline-flex; gap: 2px; vertical-align: middle; align-items: center; }
  .more { font: 600 .68rem var(--sans); color: var(--ink-3); margin-left: .2rem; }
  .move { padding: .3rem 0; border-bottom: 1px solid var(--rule); display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
  .era { padding: .5rem 0; border-bottom: 1px solid var(--rule); }
  .era.exp { background: var(--exp-tint); border-left: 3px solid var(--exp); padding-left: .5rem; }
  .chr { display: flex; gap: .7rem; padding: .3rem 0; border-bottom: 1px solid var(--rule); align-items: baseline; }
  .yr { font: 600 .8rem var(--sans); color: var(--accent); min-width: 3.5rem; text-align: right; }
  .bands { width: 100%; display: block; }
  .tick { stroke: var(--rule); }
  .tl { font: 11px var(--sans); fill: var(--ink-3); }
  .band { cursor: pointer; }
  .band rect { fill: color-mix(in srgb, var(--accent) 25%, var(--card)); stroke: var(--accent); }
  .band.exp rect { fill: color-mix(in srgb, var(--exp) 20%, var(--card)); stroke: var(--exp); stroke-dasharray: 4 3; }
  .bl { font: 600 12px var(--sans); fill: var(--ink); pointer-events: none; }
  .pt { cursor: pointer; }
  .pt circle { fill: var(--card); stroke: var(--ink); stroke-width: 2; }
  .pt:hover circle { fill: var(--accent); }
  .pl { font: 12px var(--sans); fill: var(--ink); }
  @media (max-width: 800px) { .grid2 { grid-template-columns: 1fr; } }
</style>
