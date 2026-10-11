<script>
  // Maps you can arrange. Each map is a "frame": the world, or any place with its own map (an image or a sketch).
  // A place's `map: {x, y}` (0–1) is a position in the frame of its nearest ancestor that has a map.
  import { forceSimulation, forceManyBody, forceCollide, forceX, forceY, forceLink } from 'd3';
  import { store } from '../lib/store.svelte.js';
  import { uploadImage } from '../lib/images.js';
  import { editField } from '../lib/edits.js';
  import Avatar from './Avatar.svelte';
  import PanZoom from './PanZoom.svelte';
  import EntityLink from './EntityLink.svelte';

  let { places } = $props();
  const worldId = $derived(store.model.worldEntity);
  let frameId = $state(null); // null = the world map
  const fid = $derived(frameId && store.model.entities[frameId] ? frameId : worldId);
  const frame = $derived(store.model.entities[fid]);
  const ownsMap = (e) => !!e && (e.id === worldId || !!e.mapImage || e.mapSketch);
  const frameOf = (p) => {
    let cur = p.partOf ? store.model.entities[p.partOf] : null, guard = 0;
    while (cur && guard++ < 20) { if (ownsMap(cur)) return cur.id; cur = cur.partOf ? store.model.entities[cur.partOf] : null; }
    return worldId;
  };
  const crumbs = $derived.by(() => {
    const out = [];
    let cur = frame, guard = 0;
    while (cur && cur.id !== worldId && guard++ < 20) { out.unshift(cur); cur = store.model.entities[frameOf(cur)]; }
    return [store.model.entities[worldId], ...out].filter(Boolean);
  });
  const inFrame = $derived(places.filter((p) => p.id !== fid && frameOf(p) === fid));
  const pinned = $derived(inFrame.filter((p) => p.map));
  const tray = $derived(inFrame.filter((p) => !p.map));
  const url = $derived((store.version, frame?.mapImage ? store.pending.find((p) => p.path === frame.mapImage)?.url ?? store.model.imageUrls?.[frame.mapImage] : null));
  const sketch = $derived(!url);

  // ---- zoom & pan: PanZoom (pins keep their size: they scale by 1/k) ----------------------------------
  let k = $state(1);
  let aspect = $state(1.6);

  // ---- arranging ------------------------------------------------------------------------------------
  let arranging = $state(false);
  let drag = $state(null); // { id, x, y, fromTray, ghost:{cx,cy} }
  let undo = $state([]);
  let note = $state('');
  let stage = $state(null);
  const frac = (ev) => { const r = stage.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)) }; };
  function down(ev) {
    if (ev.button !== 0) return;
    const pin = ev.target.closest?.('[data-pin]');
    if (arranging && pin && !ev.target.closest('button')) {
      ev.preventDefault();
      drag = { id: pin.dataset.pin, ...frac(ev), fromTray: false };
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
      return;
    }
  }
  function trayDown(ev, id) {
    ev.preventDefault();
    drag = { id, x: null, y: null, fromTray: true, ghost: { cx: ev.clientX, cy: ev.clientY } };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up, { once: true });
  }
  function move(ev) {
    if (drag) {
      const r = stage.getBoundingClientRect();
      const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      drag = { ...drag, ...(inside ? frac(ev) : { x: null, y: null }), ghost: { cx: ev.clientX, cy: ev.clientY } };
    }
  }
  async function up() {
    window.removeEventListener('pointermove', move);
    const d = drag; drag = null;
    if (!d || d.x == null) return;
    const e = store.model.entities[d.id];
    undo = [...undo.slice(-30), { id: d.id, prev: e.map ? { ...e.map } : null }];
    const r = await editField(e, 'map', { x: d.x, y: d.y });
    note = r.saved ? `Saved ${e.title}'s position.` : `${e.title} moved. Not saved to the vault yet (see the banner).`;
  }
  async function undoLast() {
    const u = undo.at(-1); if (!u) return;
    undo = undo.slice(0, -1);
    await editField(store.model.entities[u.id], 'map', u.prev);
    note = 'Undid the last move.';
  }
  async function autoArrange() {
    // Suggest spots for unplaced places: near their parent/neighbours, away from others. Pinned places stay put.
    const S = 1000, H = S / aspect;
    const nodes = inFrame.map((p, i) => (p.map ? { id: p.id, fx: p.map.x * S, fy: p.map.y * H } : { id: p.id, x: S / 2 + Math.cos(i) * 150, y: H / 2 + Math.sin(i) * 90 }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = inFrame.filter((p) => p.partOf && ids.has(p.partOf)).map((p) => ({ source: p.id, target: p.partOf }));
    const sim = forceSimulation(nodes).force('link', forceLink(links).id((d) => d.id).distance(90))
      .force('charge', forceManyBody().strength(-160)).force('collide', forceCollide(42))
      .force('x', forceX(S / 2).strength(0.04)).force('y', forceY(H / 2).strength(0.06)).stop();
    for (let i = 0; i < 300; i++) sim.tick();
    const placed = nodes.filter((n) => n.fx == null);
    undo = [...undo, ...placed.map((n) => ({ id: n.id, prev: null }))];
    for (const n of placed) await editField(store.model.entities[n.id], 'map', { x: Math.min(0.97, Math.max(0.03, n.x / S)), y: Math.min(0.95, Math.max(0.05, n.y / H)) });
    note = `Suggested spots for ${placed.length} place(s). Drag them where they belong.`;
  }
  async function makeLocalMap(p) {
    // Places inside p that already sit on this map keep their layout: re-centre and enlarge it on p's own map.
    const kids = places.filter((c) => c.partOf === p.id && c.map && frameOf(c) === fid);
    const c0 = p.map ?? { x: 0.5, y: 0.5 };
    const spread = Math.max(0.02, ...kids.flatMap((c) => [Math.abs(c.map.x - c0.x), Math.abs(c.map.y - c0.y)]));
    const s = 0.35 / spread;
    await editField(p, 'map_image', 'sketch');
    for (const c of kids) await editField(c, 'map', { x: Math.min(0.95, Math.max(0.05, 0.5 + (c.map.x - c0.x) * s)), y: Math.min(0.92, Math.max(0.08, 0.5 + (c.map.y - c0.y) * s)) });
    frameId = p.id;
    note = `${p.title} now has its own sketch map${kids.length ? `; ${kids.length} place(s) moved onto it, keeping their layout` : ''}.`;
  }
  let input = $state(null);
  async function uploadMap(files) {
    const f = [...(files ?? [])].find((f) => f.type.startsWith('image/'));
    if (!f) return;
    const r = await uploadImage(frame, f, 'map');
    note = r.saved ? 'Map image saved to the vault.' : 'Map image kept in the browser. Save it from the banner.';
  }

  // ---- people on the map (tokens travel between places) ---------------------------------------------
  const follow = $derived(store.follow ?? '');
  const pinFor = (placeId) => { // nearest pinned place in this frame: the place itself, or an ancestor
    let cur = store.model.entities[placeId], guard = 0;
    while (cur && guard++ < 20) { if (cur.map && frameOf(cur) === fid) return cur; if (cur.id === fid) return null; cur = cur.partOf ? store.model.entities[cur.partOf] : null; }
    return null;
  };
  const posOf = (p) => (drag?.id === p.id && drag.x != null ? drag : p.map);
  // Big casts: tokens only for who's on the page now (and whoever you follow); the rest become a count per pin.
  const crowd = $derived(Object.keys(store.snap?.presence ?? {}).length > 120);
  const counts = $derived.by(() => {
    const n = {};
    if (!crowd) return n;
    for (const [c, p] of Object.entries(store.snap?.presence ?? {})) {
      if (store.snap.onStage.includes(c) || c === follow || !store.visible(c) || /dead/.test(store.snap.status[c] ?? '')) continue;
      const pin = pinFor(p.place);
      if (pin) n[pin.id] = (n[pin.id] ?? 0) + 1;
    }
    return n;
  });
  const tokens = $derived.by(() => {
    const by = {};
    for (const [c, p] of Object.entries(store.snap?.presence ?? {})) {
      if (!store.visible(c) || /dead/.test(store.snap.status[c] ?? '')) continue;
      if (crowd && !store.snap.onStage.includes(c) && c !== follow) continue;
      const pin = pinFor(p.place);
      if (pin) (by[pin.id] ??= []).push({ c, place: p.place });
    }
    const out = [];
    for (const [pl, list] of Object.entries(by)) {
      const m = posOf(store.model.entities[pl]);
      list.sort((a, b) => (a.c === follow ? -1 : b.c === follow ? 1 : store.name(a.c).localeCompare(store.name(b.c))));
      const n = Math.min(list.length, 7);
      list.slice(0, 7).forEach((t, i) => out.push({ ...t, x: m.x, y: m.y, dx: (i - (n - 1) / 2) * 26, on: store.snap.onStage.includes(t.c) }));
    }
    return out.sort((a, b) => (a.c < b.c ? -1 : 1)); // stable DOM order keeps transitions running
  });
  const path = $derived.by(() => {
    if (!follow) return [];
    const pts = [];
    for (let i = 0; i <= store.idx; i++) {
      const pl = store.snaps[i]?.presence[follow]?.place;
      const pin = pl && pinFor(pl);
      if (pin && (!pts.length || pts.at(-1).id !== pin.id)) pts.push({ id: pin.id, ...pin.map, step: store.sequence[i] });
    }
    return pts;
  });
  const followHere = $derived(follow && store.snap?.presence[follow] ? pinFor(store.snap.presence[follow].place) : null);
  const chars = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id)));
</script>

<div class="toolbar">
  <nav class="crumbs" aria-label="Map">
    {#each crumbs as c, i (c.id)}
      {#if i}<span class="muted">›</span>{/if}
      {#if c.id === fid}<strong>{i ? c.title : 'World map'}</strong>{:else}<button class="link" onclick={() => (frameId = c.id === worldId ? null : c.id)}>{i ? c.title : 'World map'}</button>{/if}
    {/each}
  </nav>
  <label class="small">Follow <select value={follow} onchange={(ev) => store.setFollow(ev.currentTarget.value)}><option value="">nobody</option>{#each chars as c (c.id)}<option value={c.id}>{c.title}</option>{/each}</select></label>
  <span class="grow"></span>
  <button class="btn" class:on={arranging} aria-pressed={arranging} onclick={() => (arranging = !arranging)}>✎ {arranging ? 'Done arranging' : 'Arrange'}</button>
</div>

{#if arranging}
  <div class="arrange card">
    <div class="small">Drag pins to move them. Drag places from the tray onto the map. Positions are saved in each place's note as <code>map: &#123;x, y&#125;</code>, so they stay put.</div>
    <div class="tray" aria-label="Places without a spot on this map">
      {#each tray as p (p.id)}
        <button class="tchip" onpointerdown={(ev) => trayDown(ev, p.id)} title="Drag onto the map">⠿ {p.title}</button>
      {:else}<span class="small muted">Every place on this map has a spot.</span>{/each}
    </div>
    <div class="row">
      {#if tray.length}<button class="btn" onclick={autoArrange}>✨ Auto-arrange {tray.length} unplaced</button>{/if}
      <button class="btn" onclick={undoLast} disabled={!undo.length}>↶ Undo</button>
      <button class="btn" onclick={() => input.click()}>🖼 {url ? 'Replace the' : 'Use an'} image as this map</button>
      <input bind:this={input} type="file" accept="image/*" hidden onchange={(ev) => uploadMap(ev.currentTarget.files)} />
      {#if note}<span class="small muted">{note}</span>{/if}
    </div>
  </div>
{/if}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="vp" onpointerdown={down} class:arranging>
  {#key fid}
  <PanZoom min={1} max={8} bind:scale={k} ignore={arranging ? '[data-pin]' : null}>
  <div class="stage" bind:this={stage} class:sketch style:aspect-ratio={aspect}>
    {#if url}
      <img src={url} alt="Map of {frame.title}" draggable="false" onload={(ev) => (aspect = ev.currentTarget.naturalWidth / ev.currentTarget.naturalHeight)} />
    {:else}
      <div class="parchment" aria-hidden="true"><span class="compass">✦<small>N</small></span><span class="ftitle">{frame?.title}</span></div>
    {/if}
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {#if path.length > 2}<polyline points={path.slice(0, -1).map((p) => `${p.x},${p.y}`).join(' ')} class="trail" vector-effect="non-scaling-stroke" />{/if}
      {#if path.length > 1}
        {#key path.length + path.at(-1).id}
          <line x1={path.at(-2).x} y1={path.at(-2).y} x2={path.at(-1).x} y2={path.at(-1).y} class="leg" pathLength="1" vector-effect="non-scaling-stroke" style:animation-duration={`${store.animMs}ms`} />
        {/key}
      {/if}
    </svg>
    {#each pinned as p (p.id)}
      {@const m = posOf(p)}
      <div class="pin" data-pin={p.id} class:dragging={drag?.id === p.id} class:future={store.isFuture(p.id)} class:onpath={path.some((q) => q.id === p.id)}
        style:left={`${m.x * 100}%`} style:top={`${m.y * 100}%`} style:--k={k}>
        <span class="dot" class:sub={ownsMap(p)}></span>
        <span class="pl">{#if arranging}{p.title}{:else}<EntityLink id={p.id} />{/if}</span>
        {#if counts[p.id]}<span class="cnt" title="{counts[p.id]} more people whose last known place is here">+{counts[p.id]}</span>{/if}
        {#if ownsMap(p) && !arranging}<button class="dive" onclick={() => (frameId = p.id)} title="Open {p.title}'s own map">⤵</button>{/if}
        {#if arranging && !ownsMap(p) && places.some((c) => c.partOf === p.id)}<button class="dive" onclick={() => makeLocalMap(p)} title="Give {p.title} its own map for the places inside it">＋map</button>{/if}
      </div>
    {/each}
    {#if drag?.fromTray && drag.x != null}
      <div class="pin ghostpin" style:left={`${drag.x * 100}%`} style:top={`${drag.y * 100}%`} style:--k={k}><span class="dot"></span><span class="pl">{store.name(drag.id)}</span></div>
    {/if}
    {#each tokens as t (t.c)}
      <button class="tok" class:me={t.c === follow} class:fade={follow && t.c !== follow} class:off={!t.on}
        style:left={`${t.x * 100}%`} style:top={`${t.y * 100}%`} style:--dx={`${t.dx}px`} style:--k={k} style:transition-duration={`${drag ? 0 : store.animMs}ms`}
        title={`${store.name(t.c)} · ${store.name(t.place)}${t.on ? '' : ' (last known place)'}`} onclick={(ev) => { ev.stopPropagation(); store.open(t.c); }}>
        <Avatar id={t.c} size={t.c === follow ? 38 : 24} ring={t.c === follow ? 'var(--accent)' : null} />
      </button>
    {/each}
  </div>
  </PanZoom>
  {/key}
</div>
{#if drag?.fromTray && drag.x == null && drag.ghost}
  <div class="floating chip" style:left={`${drag.ghost.cx}px`} style:top={`${drag.ghost.cy}px`}>⠿ {store.name(drag.id)}</div>
{/if}
{#if !pinned.length && !arranging}<p class="small muted">No places have a spot on this map yet. Click <strong>✎ Arrange</strong> to place them{tray.length ? ` (${tray.length} waiting)` : ''}.</p>{/if}
{#if follow && store.snap?.presence[follow] && !followHere}<p class="small muted">{store.name(follow)} is at {store.name(store.snap.presence[follow].place)}, which isn't on this map yet.</p>{/if}
{#if path.length}<p class="small muted">Path of {store.name(follow)}: {path.map((p) => `${store.name(p.id)} (${p.step})`).join(' → ')}</p>{/if}

<style>
  .toolbar { display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; margin-bottom: .5rem; }
  .crumbs { display: flex; gap: .35rem; align-items: center; }
  .grow { flex: 1; }
  .btn.on { background: var(--accent); color: var(--paper); border-color: var(--accent); }
  select { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; margin-left: .3rem; }
  .arrange { display: grid; gap: .5rem; margin-bottom: .6rem; padding: .7rem .9rem; }
  .tray { display: flex; gap: .3rem; flex-wrap: wrap; }
  .tchip { border: 1px dashed var(--ink-3); background: var(--paper); border-radius: 999px; padding: .15rem .6rem; font-size: .8rem; cursor: grab; touch-action: none; }
  .row { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
  .vp { position: relative; overflow: hidden; border-radius: 8px; border: 1px solid var(--rule); max-height: 72vh; max-height: 72dvh; }
  .vp.arranging :global(.pz) { touch-action: none; }
  .stage { position: relative; width: 100%; max-height: 72vh; transform-origin: 0 0; user-select: none; }
  .stage img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .parchment { position: absolute; inset: 0; background:
      radial-gradient(circle at 20% 30%, rgb(255 255 255 / 25%), transparent 40%),
      radial-gradient(circle at 80% 70%, rgb(120 90 40 / 10%), transparent 45%),
      linear-gradient(var(--rule) 1px, transparent 1px) 0 0 / 10% 10%,
      linear-gradient(90deg, var(--rule) 1px, transparent 1px) 0 0 / 10% 10%,
      color-mix(in srgb, #e9dcb8 70%, var(--paper)); }
  :global([data-theme='dark']) .parchment { background-color: color-mix(in srgb, #4a4030 60%, var(--paper)); }
  .compass { position: absolute; right: 3%; top: 4%; font-size: 2rem; color: var(--ink-3); display: grid; justify-items: center; line-height: 1; }
  .compass small { font: 600 .7rem var(--serif); }
  .ftitle { position: absolute; left: 3%; bottom: 4%; font: italic 1.4rem var(--serif); color: var(--ink-3); }
  .stage svg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .trail { fill: none; stroke: var(--accent); stroke-width: 3; stroke-dasharray: 8 5; stroke-linejoin: round; }
  .leg { stroke: var(--accent); stroke-width: 3; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw ease-in-out forwards; }
  @keyframes draw { to { stroke-dashoffset: 0; } }
  .pin { position: absolute; display: flex; align-items: center; gap: .3rem; transform: translate(-7px, -7px) scale(calc(1 / var(--k))); transform-origin: 7px 7px; z-index: 1; }
  .arranging .pin { cursor: grab; }
  .pin.dragging { cursor: grabbing; z-index: 5; }
  .pin.dragging .dot, .ghostpin .dot { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent); }
  .ghostpin { opacity: .85; pointer-events: none; }
  .dot { width: 14px; height: 14px; border-radius: 50%; background: var(--accent); border: 2px solid var(--card); box-shadow: 0 1px 4px rgb(0 0 0 / 35%); flex: none; }
  .dot.sub { border-radius: 3px; background: var(--ink); }
  .pin.onpath .dot { background: var(--ink); }
  .pl { background: color-mix(in srgb, var(--card) 88%, transparent); padding: 0 .35rem; border-radius: 4px; font-size: .82rem; white-space: nowrap; }
  .cnt { font: 600 .68rem var(--sans); background: var(--ink-3); color: var(--paper); border-radius: 999px; padding: 0 .35rem; }
  .dive { border: 1px solid var(--rule); background: var(--card); border-radius: 4px; font-size: .72rem; padding: 0 .3rem; cursor: pointer; }
  .tok { position: absolute; transform: translate(calc(-50% + var(--dx)), 18px) scale(calc(1 / var(--k))); background: none; border: 0; padding: 0; border-radius: 50%; cursor: pointer;
    transition-property: left, top, opacity; transition-timing-function: cubic-bezier(.65, 0, .35, 1); z-index: 2; }
  .tok.me { z-index: 3; }
  .tok.fade { opacity: .55; }
  .tok.off:not(.me) { opacity: .4; }
  .floating { position: fixed; transform: translate(-50%, -50%); pointer-events: none; z-index: 90; }
  @media (prefers-reduced-motion: reduce) { .leg { animation: none; stroke-dashoffset: 0; } }
</style>
