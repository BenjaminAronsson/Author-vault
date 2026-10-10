<script>
  import { store } from '../lib/store.svelte.js';
  import { relationsAt, stableLayout, localLayout, colorOf, describe } from '../lib/relations.js';
  import { PosTween } from '../lib/motion.svelte.js';
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';

  // recent: only people seen in the last N chapters (null = auto: 15 when the cast is large); max: cap on nodes shown
  let { focus = null, hops = 1, mode = 'ego', height = 420, onpick = null, recent = null, max = null } = $props();

  const rel = $derived((store.version, relationsAt(store)));
  const shown = $derived.by(() => {
    if (mode === 'full' || !focus) return new Set(rel.chars);
    const adj = {};
    for (const p of rel.pairs) { (adj[p.a] ??= new Set()).add(p.b); (adj[p.b] ??= new Set()).add(p.a); }
    const seen = new Set([focus]);
    let frontier = [focus];
    for (let h = 0; h < hops; h++) {
      const next = [];
      for (const n of frontier) for (const m of adj[n] ?? []) if (!seen.has(m)) { seen.add(m); next.push(m); }
      frontier = next;
    }
    return new Set([...seen].filter((id) => rel.chars.includes(id) || id === focus));
  });
  const big = $derived(rel.chars.length > 30);
  const win = $derived(recent ?? (big ? 15 : null));
  const cap = $derived(max ?? (mode === 'full' ? (big ? 45 : Infinity) : (big ? 16 : Infinity)));
  // appearances in the recent window (chapter casts)
  const activity = $derived.by(() => {
    const a = {};
    const from = win ? Math.max(0, store.idx - win + 1) : 0;
    for (const cid of store.sequence.slice(from, store.idx + 1)) for (const c of store.model.chapters[cid].characters) a[c] = (a[c] ?? 0) + 1;
    return a;
  });
  const degree = $derived.by(() => { const d = {}; for (const p of rel.pairs) { d[p.a] = (d[p.a] ?? 0) + 1; d[p.b] = (d[p.b] ?? 0) + 1; } return d; });
  const kept = $derived.by(() => {
    let ids = [...shown].filter((id) => id === focus || !win || activity[id]);
    if (ids.length > cap) {
      const score = (id) => (id === focus ? 1e9 : (activity[id] ?? 0) * 3 + (degree[id] ?? 0) + (rel.directed[`${focus}>${id}`] || rel.directed[`${id}>${focus}`] ? 5 : 0));
      ids = ids.sort((a, b) => score(b) - score(a)).slice(0, cap);
    }
    return new Set(ids);
  });
  const hiddenCount = $derived(shown.size - kept.size);
  // Small casts: one stable layout for the whole cast. Big casts: lay out only who's on screen.
  const pos = $derived.by(() => {
    if (!store.model) return {};
    if (!big) return stableLayout(store);
    return localLayout(`${store.model.world}|${store.cont}|${mode}`, [...kept], rel.pairs);
  });
  // Focus mode at scale: radial layout (focus in the middle, direct ties on a ring, 2nd hop outside), stable by name.
  const radial = $derived(mode === 'ego' && focus && kept.has(focus) && kept.size > 6);
  const rpos = $derived.by(() => {
    if (!radial) return null;
    const adj = (id) => rel.pairs.filter((p) => p.a === id || p.b === id).map((p) => (p.a === id ? p.b : p.a));
    const ring1 = adj(focus).filter((id) => kept.has(id)).sort((a, b) => store.name(a).localeCompare(store.name(b)));
    const out = { [focus]: { x: 0, y: 0 } };
    const r1 = Math.max(150, ring1.length * 22);
    ring1.forEach((id, k) => { const a = (k / ring1.length) * Math.PI * 2 - Math.PI / 2; out[id] = { x: Math.cos(a) * r1, y: Math.sin(a) * r1 }; });
    const rest = [...kept].filter((id) => !(id in out)).sort((a, b) => store.name(a).localeCompare(store.name(b)));
    const r2 = r1 + 130;
    rest.forEach((id, k) => {
      const parent = ring1.find((p) => adj(id).includes(p));
      const base = parent ? Math.atan2(out[parent].y, out[parent].x) : (k / rest.length) * Math.PI * 2;
      const a = base + ((k % 3) - 1) * 0.18;
      out[id] = { x: Math.cos(a) * r2, y: Math.sin(a) * r2 };
    });
    return out;
  });
  const P = (id) => (rpos ? rpos[id] : pos[id]);
  const targets = $derived(Object.fromEntries([...kept].map((id) => [id, P(id)])));
  // Glide between layouts instead of jumping (new people fade in from the focus / centre)
  const tw = new PosTween();
  $effect(() => { const t = targets; const ms = store.animMs; untrack(() => tw.to(t, ms, () => (focus && t[focus] ? t[focus] : { x: 0, y: 0 }))); });
  const T = (id) => tw.current[id] ?? targets[id];
  const nodes = $derived([...kept].map((id) => ({ id, ...T(id) })));
  const rad = (id) => (big ? 16 + Math.min(12, (activity[id] ?? 0) * 2) : R);
  const edges = $derived(rel.pairs.filter((p) => kept.has(p.a) && kept.has(p.b)).map((p) => ({
    ...p, ab: rel.directed[`${p.a}>${p.b}`] ?? null, ba: rel.directed[`${p.b}>${p.a}`] ?? null,
  })));
  const boxTarget = $derived.by(() => {
    const ps = Object.values(targets);
    if (!ps.length) return { o: { x: -100, y: -100 }, s: { x: 200, y: 200 } };
    const xs = ps.map((n) => n.x), ys = ps.map((n) => n.y);
    const pad = 70;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
    return { o: { x: x0, y: y0 }, s: { x: Math.max(w, 260), y: Math.max(h, 200) } };
  });
  const bt = new PosTween();
  $effect(() => { const b = boxTarget; const ms = store.animMs; untrack(() => bt.to(b, ms)); });
  const box = $derived.by(() => {
    const b = bt.current.o ? bt.current : boxTarget;
    return `${b.o.x} ${b.o.y} ${b.s.x} ${b.s.y}`;
  });
  const R = 24;
  const dash = (r) => (!r ? '1 5' : r.n < 0 ? '7 5' : null);
  const width = (r) => (!r ? 1.2 : 1.6 + Math.abs(r.n) * 1.3);
  const img = (id) => store.imageFor(id);
  const dead = (id) => /dead/.test(store.snap?.status[id] ?? '');
</script>

<figure class="web" style:height={`${height}px`}>
  <svg viewBox={box} role="img" aria-label="Relationship web">
    <defs>
      {#each nodes as n (n.id)}<clipPath id={`c-${n.id.replace(/\W/g, '_')}`}><circle cx={n.x} cy={n.y} r={rad(n.id)} /></clipPath>{/each}
    </defs>
    <g class="edges">
      {#each edges as e (e.a + e.b)}
        {@const A = T(e.a)} {@const B = T(e.b)} {@const mx = (A.x + B.x) / 2} {@const my = (A.y + B.y) / 2}
        <g in:fade={{ duration: 350 }} class:table={(e.ab?.src ?? e.ba?.src) === 'table'} class:side={radial && e.a !== focus && e.b !== focus}>
          {#if !e.ab && !e.ba}
            <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="var(--rule)" stroke-width={Math.min(4, 0.8 + e.co * 0.5)}><title>{store.name(e.a)} & {store.name(e.b)} appear together in {e.co} chapter(s)</title></line>
          {:else}
            <line x1={A.x} y1={A.y} x2={mx} y2={my} stroke={colorOf(e.ab?.n)} stroke-width={width(e.ab)} stroke-dasharray={dash(e.ab)} class:inf={e.ab?.inferred}><title>{e.ab ? describe(store, e.ab) : `${store.name(e.a)} → ${store.name(e.b)}: unknown`}</title></line>
            <line x1={B.x} y1={B.y} x2={mx} y2={my} stroke={colorOf(e.ba?.n)} stroke-width={width(e.ba)} stroke-dasharray={dash(e.ba)} class:inf={e.ba?.inferred}><title>{e.ba ? describe(store, e.ba) : `${store.name(e.b)} → ${store.name(e.a)}: unknown`}</title></line>
            <circle cx={mx} cy={my} r="2.5" fill="var(--card)" stroke="var(--ink-3)" stroke-width=".8" />
          {/if}
        </g>
      {/each}
    </g>
    <g class="nodes">
      {#each nodes as n (n.id)}
        {@const e = store.model.entities[n.id]}
        {@const r = rad(n.id)}
        <g in:fade={{ duration: 350 }} class="node" class:focus={n.id === focus} class:dead={dead(n.id)} class:future={store.isFuture(n.id)} class:onstage={store.snap?.onStage.includes(n.id)}
          tabindex="0" role="button" aria-label={e.title}
          onclick={() => (onpick ? onpick(n.id) : store.open(n.id))}
          onkeydown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), onpick ? onpick(n.id) : store.open(n.id))}>
          <circle class="halo" cx={n.x} cy={n.y} r={r + 4} />
          {#if img(n.id)}
            <image href={img(n.id)} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} clip-path={`url(#c-${n.id.replace(/\W/g, '_')})`} preserveAspectRatio="xMidYMid slice" />
          {:else}
            <circle cx={n.x} cy={n.y} r={r} class="mono" />
            <text x={n.x} y={n.y + 5} text-anchor="middle" class="ini">{e.title.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')}</text>
          {/if}
          {#if e.canon === 'expansion'}<circle cx={n.x + r * .72} cy={n.y + r * .72} r="5" fill="var(--exp)" stroke="var(--card)" stroke-width="2" />{/if}
          <text x={n.x} y={n.y + r + 15} text-anchor="middle" class="name">{e.title}{dead(n.id) ? ' †' : ''}</text>
        </g>
      {/each}
    </g>
  </svg>
  {#if !nodes.length}<p class="muted empty">No characters known at this point yet.</p>{/if}
  {#if hiddenCount > 0}<p class="more small muted">Showing {nodes.length} most present{win ? ` in the last ${win} chapters` : ''} · {hiddenCount} more hidden</p>{/if}
</figure>

<style>
  .web { margin: 0; position: relative; }
  svg { width: 100%; height: 100%; display: block; }
  line { transition: stroke .35s, stroke-width .35s, opacity .35s; stroke-linecap: round; }
  .table line { opacity: .6; }
  .side line, .side circle { opacity: .12; }
  line.inf { opacity: .45; }
  .node { cursor: pointer; outline: none; }
  .halo { fill: none; stroke: transparent; stroke-width: 3; transition: stroke .2s; }
  .node.onstage .halo { stroke: color-mix(in srgb, var(--accent) 45%, transparent); }
  .node.focus .halo { stroke: var(--accent); }
  .node:focus-visible .halo, .node:hover .halo { stroke: var(--ink-2); }
  .mono { fill: var(--paper-2); stroke: var(--rule); }
  .ini { font: 600 14px var(--serif); fill: var(--ink-2); pointer-events: none; }
  .name { font: 600 12px var(--sans); fill: var(--ink); paint-order: stroke; stroke: var(--paper); stroke-width: 4px; pointer-events: none; }
  .dead image, .dead .mono { opacity: .45; filter: grayscale(1); }
  .future { opacity: .35; }
  .empty { position: absolute; inset: 0; display: grid; place-items: center; }
  .more { position: absolute; left: .5rem; bottom: 0; margin: 0; }
</style>
