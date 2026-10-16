<script>
  import PanZoom from './PanZoom.svelte';
  import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, forceX, forceY } from 'd3';
  import { store } from '../lib/store.svelte.js';
  import Avatar from './Avatar.svelte';

  let { places, moves, parentOf, whoAt } = $props();
  const layout = $derived.by(() => {
    const nodes = places.map((p) => ({ id: p.id }));
    const ids = new Set(nodes.map((n) => n.id));
    const links = [
      ...places.map((p) => [p.id, parentOf(p)]).filter(([, b]) => b && ids.has(b)).map(([a, b]) => ({ source: a, target: b, kind: 'part' })),
      ...moves.filter((m) => ids.has(m.a) && ids.has(m.b)).map((m) => ({ source: m.a, target: m.b, kind: 'move', n: m.who.length })),
    ];
    nodes.forEach((n, i) => { const a = (i / nodes.length) * Math.PI * 2; n.x = Math.cos(a) * 150; n.y = Math.sin(a) * 150; });
    const sim = forceSimulation(nodes).force('link', forceLink(links).id((d) => d.id).distance((l) => (l.kind === 'part' ? 70 : 130)))
      .force('charge', forceManyBody().strength(-500)).force('center', forceCenter(0, 0)).force('collide', forceCollide(60))
      .force('x', forceX(0).strength(0.09)).force('y', forceY(0).strength(0.09)).stop();
    for (let i = 0; i < 300; i++) sim.tick();
    return { nodes, links };
  });
  const tokens = $derived.by(() => {
    const at = Object.fromEntries(layout.nodes.map((n) => [n.id, n]));
    const by = {};
    for (const n of layout.nodes) for (const w of whoAt(n.id).filter((id) => !store.follow || id === store.follow)) (by[n.id] ??= []).push(w);
    const out = [];
    for (const [pl, list] of Object.entries(by)) {
      list.sort((a, b) => (a === store.follow ? -1 : b === store.follow ? 1 : store.name(a).localeCompare(store.name(b))));
      list.slice(0, 6).forEach((c, k) => out.push({ c, x: at[pl].x + (k - (Math.min(list.length, 6) - 1) / 2) * 24, y: at[pl].y + 24 }));
    }
    return out.sort((a, b) => (a.c < b.c ? -1 : 1)); // stable DOM order keeps transitions running
  });
  const box = $derived.by(() => {
    const xs = layout.nodes.map((n) => n.x), ys = layout.nodes.map((n) => n.y);
    if (!xs.length) return '0 0 100 100';
    const x0 = Math.min(...xs) - 90, y0 = Math.min(...ys) - 60;
    return `${x0} ${y0} ${Math.max(...xs) - x0 + 90} ${Math.max(...ys) - y0 + 70}`;
  });
</script>

<PanZoom>
<svg viewBox={box} class="tg" role="img" aria-label="Travel graph of places">
  {#each layout.links as l, i (i)}
    <line x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y} class={l.kind} stroke-width={l.kind === 'move' ? 1.5 + l.n * 1.2 : 1} />
  {/each}
  {#each layout.nodes as n (n.id)}
    <g class="pn" data-entity={n.id} role="button" tabindex="0" onclick={() => store.open(n.id)} onkeydown={(ev) => ev.key === 'Enter' && store.open(n.id)}>
      <circle cx={n.x} cy={n.y} r="9" class:here={store.follow && store.snap?.presence[store.follow]?.place === n.id} />
      <text x={n.x} y={n.y - 15} text-anchor="middle">{store.name(n.id)}</text>
    </g>
  {/each}
  <!-- people as tokens that travel between places (CSS transform transitions) -->
  {#each tokens as t (t.c)}
    <g class="tok" class:me={t.c === store.follow} class:fade={store.follow && t.c !== store.follow}
      style:transform={`translate(${t.x}px, ${t.y}px)`} style:transition-duration={`${store.animMs}ms`}>
      <foreignObject x={t.c === store.follow ? -16 : -11} y={t.c === store.follow ? -16 : -11} width={t.c === store.follow ? 32 : 22} height={t.c === store.follow ? 32 : 22}>
        <Avatar id={t.c} size={t.c === store.follow ? 30 : 20} ring={t.c === store.follow ? 'var(--accent)' : null} />
      </foreignObject>
      <title>{store.name(t.c)}</title>
    </g>
  {/each}
</svg>
</PanZoom>

<style>
  .tg { width: 100%; height: 420px; display: block; }
  line.part { stroke: var(--rule); stroke-dasharray: 3 3; }
  line.move { stroke: var(--accent); opacity: .55; stroke-linecap: round; }
  .pn { cursor: pointer; }
  .pn circle { fill: var(--card); stroke: var(--accent); stroke-width: 2.5; }
  .pn:hover circle, .pn:focus-visible circle { fill: var(--accent); }
  .pn circle.here { fill: var(--accent); r: 12; }
  .tok { transition-property: transform, opacity; transition-timing-function: cubic-bezier(.65, 0, .35, 1); }
  .tok.fade { opacity: .45; }
  text { font: 600 12px var(--sans); fill: var(--ink); paint-order: stroke; stroke: var(--paper); stroke-width: 4px; }
</style>
