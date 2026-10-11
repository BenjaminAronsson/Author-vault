<script>
  // Ancestors above, the person and their spouses in the middle, descendants below. People appear when they are
  // born at the bookmark and turn grey when they have died; living people stay hidden unless shown.
  import { store } from '../lib/store.svelte.js';
  import { kinIndex, familyTree, lifespan, lifeLine, kinDetail } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';
  import Avatar from './Avatar.svelte';
  import PanZoom from './PanZoom.svelte';

  // viewHeight: the full Family view gives the tree the screen; compact (person pages) keeps a fixed size
  let { focus, up = 2, down = 2, onpick = (id) => store.open(id), compact = false, viewHeight = null } = $props();
  const idx = $derived((store.version, kinIndex(store.model)));
  const tree = $derived(familyTree(store.model, idx, focus, { up, down, keep: (id) => id === focus || store.visible(id) }));

  const W = $derived(compact ? 132 : 156), H = $derived(compact ? 64 : 76), GX = 30, GY = $derived(compact ? 44 : 56);
  const widest = $derived(Math.max(1, ...tree.rows.map((r) => r.ids.length)));
  const width = $derived(widest * (W + GX) + GX);
  const height = $derived(tree.rows.length * (H + GY) + GY / 2);
  const pos = $derived.by(() => {
    const p = {};
    tree.rows.forEach((r, ri) => {
      const rowW = r.ids.length * (W + GX) - GX;
      const x0 = (width - rowW) / 2;
      r.ids.forEach((id, k) => (p[id] = { x: x0 + k * (W + GX), y: GY / 4 + ri * (H + GY) }));
    });
    return p;
  });
  const now = $derived(store.chapter?.date ?? null);
  const dead = (id) => {
    if (/dead|död/.test(store.snap?.status[id] ?? '')) return true;
    const d = parseDate(store.model.entities[id]?.died);
    return !!(d && now && d.sort <= now.sort);
  };
  // relation types: ⚭ marriage, A adoptive, F foster, S step; line style = how sure (solid belagd, dashed trolig, dotted hypotes)
  const BADGE = { adoptiv: ['A', 'Adoptivförälder'], foster: ['F', 'Fosterförälder'], styv: ['S', 'Styvförälder'] };
  const detail = (a, b) => kinDetail(store.model, a, b);
  const genLabel = (g) => ({ '-2': 'Grandparents', '-1': 'Parents', 0: '', 1: 'Children', 2: 'Grandchildren' })[g] ?? (g < 0 ? `${-g} generations up` : `${g} generations down`);
</script>

<div class="ft" class:compact>
  {#key focus + up + down}
  <PanZoom height={viewHeight ?? Math.min(height + 8, 360)} fit={!!viewHeight} fitMax={1.4}>
  <div class="canvas" style:width={`${width}px`} style:height={`${height}px`}>
    <svg width={width} height={height} aria-hidden="true">
      {#each tree.edges as e (e.from + e.to)}
        {@const a = pos[e.from]}{@const b = pos[e.to]}{@const d = detail(e.to, e.from)}
        {#if a && b}
          <path class="conf-{d.confidence ?? 'none'}" d={`M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + GY / 2} ${b.x + W / 2},${b.y - GY / 2} ${b.x + W / 2},${b.y}`}><title>{store.name(e.from)} → {store.name(e.to)}{d.type ? ` · ${d.type}` : ''}{d.confidence ? ` · ${d.confidence}` : ''}</title></path>
          {#if BADGE[d.type]}
            <g class="badge {d.type}" transform={`translate(${(a.x + b.x) / 2 + W / 2},${(a.y + H + b.y) / 2})`}><title>{BADGE[d.type][1]}</title><circle r="9" /><text dy="3.5" text-anchor="middle">{BADGE[d.type][0]}</text></g>
          {/if}
        {/if}
      {/each}
      {#each tree.spouses as [s1, s2] (s1 + s2)}
        {@const a = pos[s1]}{@const b = pos[s2]}{@const d = detail(s1, s2)}
        {#if a && b}
          {@const x1 = Math.min(a.x, b.x) + W}{@const x2 = Math.max(a.x, b.x)}{@const y = a.y + H / 2}
          <line class="sp conf-{d.confidence ?? 'none'}" x1={x1} y1={y} x2={x2} y2={y} />
          <g class="ring" transform={`translate(${(x1 + x2) / 2},${y})`}><title>Gifta{d.from ? ` ${d.from}` : ''}{d.confidence ? ` · ${d.confidence}` : ''}</title><circle r="10" /><circle class="rg" cx="-2.6" r="4" /><circle class="rg" cx="2.6" r="4" /></g>
          {#if d.from}<text class="yr" x={(x1 + x2) / 2} y={y - 13} text-anchor="middle">{d.from}</text>{/if}
        {/if}
      {/each}
    </svg>
    {#each tree.rows as r (r.gen)}
      {#if genLabel(r.gen) && !compact}<span class="gl" style:top={`${pos[r.ids[0]].y - 15}px`}>{genLabel(r.gen)}</span>{/if}
      {#each r.ids as id (id)}
        {@const e = store.model.entities[id]}
        <button class="node" data-entity={id} class:focus={id === focus} class:dead={dead(id)} class:living={e.living}
          style:left={`${pos[id].x}px`} style:top={`${pos[id].y}px`} style:width={`${W}px`} style:height={`${H}px`}
          onclick={() => onpick(id)} title={`${e.title}${e.aliases.length ? ` (${e.aliases.join(', ')})` : ''}`}>
          <Avatar {id} size={compact ? 30 : 38} />
          <span class="txt"><span class="n">{e.title.replace(/\s*\([^)]*\)\s*$/, '')}</span><span class="y">{lifeLine(e)}{dead(id) ? ' †' : ''}</span></span>
        </button>
      {/each}
    {/each}
  </div>
  </PanZoom>
  {/key}
  {#if !compact}
    <div class="legend small muted" aria-label="Legend">
      <span><svg class="lg" width="20" height="20" viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9" class="o" /><circle class="rg" cx="-2.6" r="4" /><circle class="rg" cx="2.6" r="4" /></svg> gifta</span><span><b class="bl">A</b> adoptiv</span><span><b class="bl">F</b> foster</span><span><b class="bl">S</b> styv</span>
      <span><i class="ln"></i> belagd</span><span><i class="ln trolig"></i> trolig</span><span><i class="ln hypotes"></i> hypotes</span><span>† död · streckad ram = levande</span>
    </div>
  {/if}
  {#if tree.rows.length === 1 && tree.rows[0].ids.length === 1}<p class="muted small empty">No family recorded yet{store.idx < store.sequence.length - 1 ? ' at this point in time' : ''}.</p>{/if}
</div>

<style>
  .ft { position: relative; }
  .canvas { position: relative; margin: 0 auto; }
  .canvas > svg { position: absolute; inset: 0; pointer-events: none; }
  .ring, .badge { pointer-events: all; cursor: help; }
  path { fill: none; stroke: var(--ink-3); stroke-width: 1.5; opacity: .7; }
  .sp { stroke: var(--accent); stroke-width: 2; }
  .conf-trolig { stroke-dasharray: 6 4; }
  .conf-hypotes { stroke-dasharray: 1.5 4; stroke-linecap: round; }
  .ring circle, .badge circle { fill: var(--card); stroke: var(--accent); stroke-width: 1.5; }
  .rg { fill: none !important; stroke: var(--accent); stroke-width: 1.6; }
  .lg { vertical-align: middle; margin-right: .2rem; }
  .lg .o { fill: var(--card); stroke: var(--accent); stroke-width: 1.5; }
  .badge text { font: 700 10px var(--sans); fill: var(--ink-2); }
  .badge.foster circle { stroke-dasharray: 2 2; }
  .yr { font: 600 10px var(--sans); fill: var(--ink-3); }
  .legend { display: flex; flex-wrap: wrap; gap: .9rem; justify-content: center; margin-top: .6rem; align-items: center; }
  .legend b { display: inline-grid; place-items: center; width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--accent); font: 700 10px var(--sans); margin-right: .2rem; }
  .ln { display: inline-block; width: 26px; border-top: 2px solid var(--ink-3); vertical-align: middle; margin-right: .25rem; }
  .ln.trolig { border-top-style: dashed; }
  .ln.hypotes { border-top-style: dotted; }
  .gl { position: absolute; left: 0; font: 600 .62rem var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
  .node { position: absolute; display: flex; align-items: center; gap: .45rem; padding: .3rem .45rem; text-align: left; background: var(--card); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; transition: left .3s, top .3s, opacity .3s; }
  .node:hover { border-color: var(--accent); }
  .node.focus { border: 2px solid var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
  .node.dead { opacity: .55; filter: grayscale(.8); }
  .node.living { border-style: dashed; }
  .txt { display: grid; min-width: 0; }
  .n { font-weight: 600; font-size: .82rem; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  .y { font-size: .72rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  .compact .n { font-size: .76rem; }
  .empty { text-align: center; }
</style>
