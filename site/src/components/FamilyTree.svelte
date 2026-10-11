<script>
  // Ancestors above, the person and their spouses in the middle, descendants below. People appear when they are
  // born at the bookmark and turn grey when they have died; living people stay hidden unless shown.
  import { store } from '../lib/store.svelte.js';
  import { kinIndex, familyTree, lifespan } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';
  import Avatar from './Avatar.svelte';

  let { focus, up = 2, down = 2, onpick = (id) => store.open(id), compact = false } = $props();
  const idx = $derived((store.version, kinIndex(store.model)));
  const tree = $derived(familyTree(store.model, idx, focus, { up, down, keep: (id) => id === focus || store.visible(id) }));

  const W = $derived(compact ? 132 : 156), H = $derived(compact ? 64 : 76), GX = 18, GY = $derived(compact ? 44 : 56);
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
  const genLabel = (g) => ({ '-2': 'Grandparents', '-1': 'Parents', 0: '', 1: 'Children', 2: 'Grandchildren' })[g] ?? (g < 0 ? `${-g} generations up` : `${g} generations down`);
</script>

<div class="ft" class:compact style:min-height={`${height}px`}>
  <div class="canvas" style:width={`${width}px`} style:height={`${height}px`}>
    <svg width={width} height={height} aria-hidden="true">
      {#each tree.edges as e (e.from + e.to)}
        {@const a = pos[e.from]}{@const b = pos[e.to]}
        {#if a && b}
          <path d={`M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + GY / 2} ${b.x + W / 2},${b.y - GY / 2} ${b.x + W / 2},${b.y}`} />
        {/if}
      {/each}
      {#each tree.spouses as [s1, s2] (s1 + s2)}
        {@const a = pos[s1]}{@const b = pos[s2]}
        {#if a && b}<line class="sp" x1={Math.min(a.x, b.x) + W} y1={a.y + H / 2} x2={Math.max(a.x, b.x)} y2={b.y + H / 2} />{/if}
      {/each}
    </svg>
    {#each tree.rows as r (r.gen)}
      {#if genLabel(r.gen) && !compact}<span class="gl" style:top={`${pos[r.ids[0]].y - 15}px`}>{genLabel(r.gen)}</span>{/if}
      {#each r.ids as id (id)}
        {@const e = store.model.entities[id]}
        <button class="node" class:focus={id === focus} class:dead={dead(id)} class:living={e.living}
          style:left={`${pos[id].x}px`} style:top={`${pos[id].y}px`} style:width={`${W}px`} style:height={`${H}px`}
          onclick={() => onpick(id)} title={`${e.title}${e.aliases.length ? ` (${e.aliases.join(', ')})` : ''}`}>
          <Avatar {id} size={compact ? 30 : 38} />
          <span class="txt"><span class="n">{e.title.replace(/\s*\([^)]*\)\s*$/, '')}</span><span class="y">{lifespan(e)}{dead(id) ? ' †' : ''}</span></span>
        </button>
      {/each}
    {/each}
  </div>
  {#if tree.rows.length === 1 && tree.rows[0].ids.length === 1}<p class="muted small empty">No family recorded yet{store.idx < store.sequence.length - 1 ? ' at this point in time' : ''}.</p>{/if}
</div>

<style>
  .ft { overflow: auto; position: relative; }
  .canvas { position: relative; margin: 0 auto; }
  svg { position: absolute; inset: 0; pointer-events: none; }
  path { fill: none; stroke: var(--ink-3); stroke-width: 1.5; opacity: .7; }
  .sp { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 4 3; }
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
