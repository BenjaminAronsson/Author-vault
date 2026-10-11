<script>
  import PanZoom from './PanZoom.svelte';
  // "Movie narrative chart": each character is a line across chapters; lines bunch together when they share a place.
  import { store } from '../lib/store.svelte.js';

  // distinct, colour-blind-friendlier palette assigned by order of introduction (purple is reserved for expansions)
  const PALETTE = ['#0072b2', '#d55e00', '#009e73', '#e69f00', '#56b4e9', '#a6761d', '#cc79a7', '#666666', '#1b9e77', '#b8860b'];
  const LEFT = 150, GAP = 14;
  const COLW = (n) => (n > 30 ? 52 : n > 15 ? 70 : 96);
  let span = $state(store.books.length > 1 ? 'book' : 'all'); // book | recent | all
  let picked = $state(null); // explicit character selection (null = automatic)
  const last = $derived(store.future === 'dim' && span === 'book' ? store.book.end : store.future === 'dim' ? store.sequence.length - 1 : store.idx);
  const first = $derived(span === 'book' ? store.book.start : span === 'recent' ? Math.max(0, store.idx - 14) : 0);
  const steps = $derived(store.sequence.slice(first, last + 1));
  const COL = $derived(COLW(steps.length));
  const appear = $derived.by(() => { const a = {}; for (const cid of steps) for (const c of store.model.chapters[cid].characters) a[c] = (a[c] ?? 0) + 1; return a; });
  const allChars = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id)).map((e) => e.id));
  const auto = $derived(allChars.filter((c) => appear[c]).sort((a, b) => appear[b] - appear[a]).slice(0, 8));
  const chars = $derived((picked ?? auto).filter((c) => allChars.includes(c)).sort((a, b) => (store.intro[a] ?? 0) - (store.intro[b] ?? 0)));
  function toggle(c) { const cur = picked ?? auto; picked = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]; }
  let adding = $state('');
  const mainStory = $derived(store.book?.story ?? store.model.chapters[store.sequence[0]]?.story);
  const stepLabel = (cid) => { const c = store.model.chapters[cid]; return c.story === mainStory ? `C${c.num}` : `${c.story} C${c.num}`; };
  const placeOrder = $derived.by(() => {
    const seen = [];
    steps.forEach((_, i) => { for (const c of chars) { const p = store.snaps[first + i]?.presence[c]?.place; if (p && !seen.includes(p)) seen.push(p); } });
    return seen;
  });
  const layout = $derived.by(() => {
    // max group size per place → lane heights
    const maxIn = {};
    steps.forEach((_, i) => {
      const g = {};
      for (const c of chars) { const p = store.snaps[first + i]?.presence[c]?.place; if (p) g[p] = (g[p] ?? 0) + 1; }
      for (const [p, n] of Object.entries(g)) maxIn[p] = Math.max(maxIn[p] ?? 0, n);
    });
    let y = 30;
    const lane = {};
    for (const p of placeOrder) { const h = Math.max(1, maxIn[p] ?? 1) * GAP + 26; lane[p] = { y, h }; y += h; }
    const pts = Object.fromEntries(chars.map((c) => [c, []]));
    steps.forEach((cid, i) => {
      const s = store.snaps[first + i];
      const groups = {};
      for (const c of chars) {
        const p = s?.presence[c]?.place;
        if (!p || /dead/.test(store.snaps[first + i - 1]?.status[c] ?? '')) continue;
        (groups[p] ??= []).push(c);
      }
      for (const [p, list] of Object.entries(groups)) {
        list.sort((a, b) => chars.indexOf(a) - chars.indexOf(b));
        const mid = lane[p].y + lane[p].h / 2;
        list.forEach((c, k) => pts[c].push({ i: first + i, x: LEFT + i * COL + COL / 2, y: mid + (k - (list.length - 1) / 2) * GAP, on: s.onStage.includes(c), place: p, step: cid }));
      }
    });
    return { lane, pts, height: y + 20 };
  });
  const width = $derived(LEFT + steps.length * COL + 40);
  const pathD = (ps) => ps.map((p, k) => {
    if (!k) return `M${p.x} ${p.y}`;
    const q = ps[k - 1];
    if (p.i - q.i > 1) return `M${p.x} ${p.y}`;
    const mx = (q.x + p.x) / 2;
    return `C${mx} ${q.y} ${mx} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  let hover = $state(null);
  let scroller = $state(null);
  // keep the bookmark in view (smoothly) as the story plays
  $effect(() => {
    const x = LEFT + (store.idx - first) * COL;
    if (!scroller) return;
    const { scrollLeft, clientWidth } = scroller;
    if (x < scrollLeft + LEFT || x > scrollLeft + clientWidth - 120) scroller.scrollTo({ left: Math.max(0, x - clientWidth / 2), behavior: 'smooth' });
  });
  // if the followed character isn't among the lines, add them
  $effect(() => { if (store.follow && allChars.includes(store.follow) && !chars.includes(store.follow) && !picked) picked = [...auto, store.follow]; });
</script>

<div class="ctl">
  <label class="small">Chapters
    <select bind:value={span}>
      {#if store.books.length > 1}<option value="book">this book ({store.book.title})</option>{/if}
      <option value="recent">last 15 chapters</option>
      <option value="all">everything so far</option>
    </select>
  </label>
  <span class="small muted">People:</span>
  {#each chars as c (c)}<button class="chip on" onclick={() => toggle(c)} title="Remove">{store.name(c)} ✕</button>{/each}
  <select aria-label="Add a character" bind:value={adding} onchange={() => { if (adding) { toggle(adding); adding = ''; } }}>
    <option value="">+ add someone…</option>
    {#each allChars.filter((c) => !chars.includes(c)).sort((a, b) => (appear[b] ?? 0) - (appear[a] ?? 0)) as c (c)}<option value={c}>{store.name(c)}{appear[c] ? ` (${appear[c]})` : ''}</option>{/each}
  </select>
  {#if picked}<button class="link small" onclick={() => (picked = null)}>reset to most present</button>{/if}
</div>
<div class="sl" bind:this={scroller}>
  <PanZoom>
  <svg {width} height={layout.height} role="img" aria-label="Storylines: characters across chapters, grouped by place">
    {#each placeOrder as p, k (p)}
      {@const L = layout.lane[p]}
      <rect x="0" y={L.y} width={width} height={L.h} class:alt={k % 2} class="lane" />
      <text x="10" y={L.y + L.h / 2 + 4} class="pname" role="button" tabindex="0" onclick={() => store.open(p)} onkeydown={(ev) => ev.key === 'Enter' && store.open(p)}>{store.name(p)}</text>
    {/each}
    {#each steps as cid, i (cid)}
      <text x={LEFT + i * COL + COL / 2} y="18" text-anchor="middle" class="step" class:cur={first + i === store.idx} class:fut={first + i > store.idx} class:xs={store.model.chapters[cid].canon === 'expansion'}>{stepLabel(cid)}</text>
    {/each}
    {#each chars as c (c)}
      {@const ps = layout.pts[c]}
      {#if ps.length}
        <g class="line" class:dim={(hover && hover !== c) || (!hover && store.follow && store.follow !== c && chars.includes(store.follow))} class:me={store.follow === c} style:--c={PALETTE[chars.indexOf(c) % PALETTE.length]}
          onpointerenter={() => (hover = c)} onpointerleave={() => (hover = null)} role="button" tabindex="0"
          onclick={() => store.open(c)} onkeydown={(ev) => ev.key === 'Enter' && store.open(c)}>
          <path d={pathD(ps)} />
          {#each ps as p (p.i)}<circle cx={p.x} cy={p.y} r={p.on ? 5 : 2.5} class:on={p.on} class:fut={p.i > store.idx}><title>{store.name(c)} · {p.step} · {store.name(p.place)}{p.on ? '' : ' (off-page)'}</title></circle>{/each}
          <text x={ps[0].x - 8} y={ps[0].y + 4} text-anchor="end" class="cname">{store.name(c)}</text>
        </g>
      {/if}
    {/each}
    <g class="bookg" style:transform={`translateX(${LEFT + (store.idx - first) * COL + COL / 2}px)`} style:transition-duration={`${store.animMs}ms`}>
      <line x1="0" x2="0" y1="24" y2={layout.height - 10} class="book" />
    </g>
  </svg>
  </PanZoom>
  <p class="small muted">Lines run through the place each character is in. Big dots: on the page in that chapter; small dots: last known place. Hover a line to isolate it.</p>
</div>

<style>
  .sl { overflow-x: auto; }
  .ctl { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; margin-bottom: .6rem; }
  .ctl select { font: inherit; font-size: .82rem; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; margin-left: .3rem; }
  .chip.on { cursor: pointer; }
  .chip.on:hover { border-color: var(--neg); }
  svg { display: block; }
  .lane { fill: transparent; }
  .lane.alt { fill: var(--paper-2); opacity: .55; }
  .pname { font: 600 12px var(--sans); fill: var(--ink-2); cursor: pointer; }
  .step { font: 600 11px var(--sans); fill: var(--ink-3); }
  .step.cur { fill: var(--accent); }
  .step.fut { opacity: .4; }
  .step.xs { fill: var(--exp); font-size: 9px; }
  .line { cursor: pointer; transition: opacity .2s; }
  .line.dim { opacity: .15; }
  .line path { fill: none; stroke: var(--c); stroke-width: 3; stroke-linecap: round; opacity: .85; }
  .line circle { fill: var(--card); stroke: var(--c); stroke-width: 2; }
  .line circle.on { fill: var(--c); }
  .line circle.fut { opacity: .35; }
  .cname { font: 600 12px var(--sans); fill: var(--c); paint-order: stroke; stroke: var(--card); stroke-width: 4px; }
  .book { stroke: var(--accent); stroke-width: 2; opacity: .5; }
  .bookg { transition-property: transform; transition-timing-function: cubic-bezier(.65, 0, .35, 1); }
  .line.me path { stroke-width: 5; opacity: 1; }
</style>
