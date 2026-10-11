<script>
  import PanZoom from '../components/PanZoom.svelte';
  // Saga → book → chapter. The saga view shows books as blocks; click one to see its chapters.
  import { store } from '../lib/store.svelte.js';
  import EntityLink from '../components/EntityLink.svelte';
  import Markdown from '../components/Markdown.svelte';
  import Storylines from '../components/Storylines.svelte';

  let mode = $state('chapters');
  let level = $state(store.books.length > 1 ? 'saga' : 'book');
  let zoomIdx = $state(null); // index into store.books; null = follow the bookmark
  let threadFilter = $state('open');
  let showAllThreads = $state(false);
  let picked = $state(null);
  let cw = $state(1000);

  const seq = $derived(store.sequence);
  const books = $derived(store.books);
  const zb = $derived(books[zoomIdx ?? books.indexOf(store.book)] ?? books[0]);
  const range = $derived(level === 'saga' ? [0, seq.length - 1] : [zb.start, zb.end]);
  const LEFT = 130;
  const n = $derived(range[1] - range[0] + 1);
  const COL = $derived(level === 'saga' ? Math.max(2, (cw - LEFT - 30) / Math.max(1, n)) : Math.max(30, Math.min(60, (cw - LEFT - 30) / Math.max(1, n))));
  const x = (i) => LEFT + (i - range[0]) * COL;
  const width = $derived(Math.max(cw - 4, LEFT + n * COL + 30));
  const ch = (cid) => store.model.chapters[cid];
  const hidden = (i) => store.future === 'hide' && i > store.idx;

  // Branch continuities (always drawn from the main sequence's point of view)
  const branches = $derived(Object.entries(store.clock.forks).map(([cont, f]) => {
    const main = store.clock.sequences.main;
    const at = main.indexOf(f.at);
    const chs = store.clock.sequences[cont].filter((c) => !main.includes(c));
    return { cont, at, story: f.story, chapters: chs, title: store.model.stories[f.story]?.title ?? cont };
  }));
  const viewingBranch = $derived(store.cont !== 'main');

  // Threads & plots, filtered
  const threadsAll = $derived(Object.values(store.model.entities).filter((e) => (e.type === 'thread' || e.type === 'plot') && e.openedAt && store.canonOk(e.canon) && e.openedAt in store.stepIndex && store.stepVisible(e.openedAt)));
  const closedIdx = (t) => (t.closedAt && t.closedAt in store.stepIndex && !(store.future === 'hide' && store.stepIndex[t.closedAt] > store.idx) ? store.stepIndex[t.closedAt] : null);
  const threads = $derived.by(() => {
    let list = threadsAll.map((t) => ({ t, a: store.stepIndex[t.openedAt], b: closedIdx(t) }));
    if (threadFilter === 'open') list = list.filter(({ a, b }) => a <= store.idx && (b == null || b > store.idx));
    if (level === 'book') list = list.filter(({ a, b }) => a <= range[1] && (b ?? seq.length) >= range[0]);
    list.sort((p, q) => p.a - q.a);
    return list;
  });
  const shownThreads = $derived(showAllThreads ? threads : threads.slice(0, 12));

  const LANE = 46, TOP = 28;
  const lanes = $derived(['main', 'side', ...branches.map((b) => b.cont)]);
  const height = $derived(TOP + lanes.length * LANE + 26 + shownThreads.length * 20 + 10);
  const bookX = $derived(x(store.idx) + COL / 2);
  $effect(() => { if (!picked || !(picked in store.stepIndex)) picked = seq[store.idx]; });
  const pc = $derived(picked ? ch(picked) : null);
  function zoomTo(k) { zoomIdx = k; level = 'book'; }
</script>

<div class="tl">
  {#if viewingBranch}
    <div class="banner">Viewing <strong>{store.cont}</strong> · forks at {store.fork?.at} <button class="btn" onclick={() => store.setCont('main')}>Back to main</button></div>
  {/if}
  <div class="bar">
    <div class="modes" role="tablist">
      <button role="tab" class="btn" class:on={mode === 'chapters'} aria-selected={mode === 'chapters'} onclick={() => (mode = 'chapters')}>Books & chapters</button>
      <button role="tab" class="btn" class:on={mode === 'lines'} aria-selected={mode === 'lines'} onclick={() => (mode = 'lines')}>Storylines</button>
    </div>
    {#if mode === 'chapters'}
      <nav class="crumbs" aria-label="Zoom">
        <button class="link" class:on={level === 'saga'} onclick={() => (level = 'saga')}>Whole saga</button>
        {#if level === 'book'}
          <span>›</span><strong>{zb.title}</strong>
          <button class="btn ghost" aria-label="Previous book" disabled={books.indexOf(zb) <= 0} onclick={() => (zoomIdx = books.indexOf(zb) - 1)}>◀</button>
          <button class="btn ghost" aria-label="Next book" disabled={books.indexOf(zb) >= books.length - 1} onclick={() => (zoomIdx = books.indexOf(zb) + 1)}>▶</button>
          {#if zb !== store.book}<button class="btn" onclick={() => (zoomIdx = null)}>Back to where I am</button>{/if}
        {:else}
          <span class="small muted">· click a book to see its chapters</span>
        {/if}
      </nav>
      <span class="grow"></span>
      <label class="small">Threads
        <select bind:value={threadFilter}><option value="open">open at my bookmark</option><option value="all">all so far</option></select>
      </label>
    {/if}
  </div>

  {#if mode === 'lines'}
    <div class="card"><Storylines /></div>
  {:else}
  <div class="scroll card" bind:clientWidth={cw}>
    <PanZoom>
    <svg {width} {height} role="img" aria-label="Timeline">
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--card)" /><line x1="0" y1="0" x2="0" y2="6" stroke="var(--exp)" stroke-width="2" opacity=".45" /></pattern>
      </defs>
      <!-- lane labels -->
      <text x="10" y={TOP + 22} class="lane">{level === 'saga' ? 'Books' : zb.title.length > 16 ? zb.title.slice(0, 15) + '…' : zb.title}</text>
      <text x="10" y={TOP + LANE + 22} class="lane exp">Side stories</text>
      {#each branches as b, k (b.cont)}<text x="10" y={TOP + (2 + k) * LANE + 22} class="lane exp">⑂ {b.title.length > 16 ? b.title.slice(0, 15) + '…' : b.title}</text>{/each}
      {#each lanes as _, k (k)}<line x1={LEFT} x2={width} y1={TOP + (k + 1) * LANE - 4} y2={TOP + (k + 1) * LANE - 4} class="rule" />{/each}

      {#if level === 'saga'}
        {#each books.filter((b) => !b.branch) as b, k (b.story + b.start)}
          {@const bi = books.indexOf(b)}
          {@const read = Math.max(0, Math.min(b.end, store.idx) - b.start + 1)}
          <g class="book" class:cur={b === store.book} class:fut={hidden(b.start)} role="button" tabindex="0" aria-label={`${b.title}, ${b.end - b.start + 1} chapters`}
            onclick={() => zoomTo(bi)} onkeydown={(ev) => ev.key === 'Enter' && zoomTo(bi)}>
            <rect x={x(b.start) + 1} y={TOP + 4} width={Math.max(4, (b.end - b.start + 1) * COL - 3)} height="34" rx="5" class="bk" />
            <rect x={x(b.start) + 1} y={TOP + 4} width={Math.max(0, read * COL - 3)} height="34" rx="5" class="rd" />
            <text x={x(b.start) + 8} y={TOP + 19} class="bt">{b.title}</text>
            <text x={x(b.start) + 8} y={TOP + 32} class="bn">{b.end - b.start + 1} ch.{read && read <= b.end - b.start ? ` · ${read} read` : read ? ' · read' : ''}</text>
            {#each b.inserts as ins (ins.story + ins.start)}
              <rect x={x(ins.start)} y={TOP + LANE + 6} width={Math.max(5, (ins.end - ins.start + 1) * COL - 1)} height="26" rx="3" fill="url(#hatch)" class="ins" class:fut={hidden(ins.start)}><title>{store.model.stories[ins.story]?.title} (side story)</title></rect>
            {/each}
          </g>
        {/each}
      {:else}
        {#each seq.slice(range[0], range[1] + 1) as cid, k (cid)}
          {@const i = range[0] + k}
          {@const c = ch(cid)}
          {@const side = c.story !== zb.story}
          <g class="chap" class:cur={i === store.idx} class:fut={hidden(i)} class:read={i <= store.idx} class:picked={cid === picked} role="button" tabindex="0"
            aria-label={hidden(i) ? 'Chapter after your bookmark' : `${cid} ${c.title}`} onclick={() => (picked = cid)} onkeydown={(ev) => ev.key === 'Enter' && (picked = cid)}>
            <rect x={x(i) + 2} y={TOP + (side ? LANE : 0) + 6} width={COL - 4} height="30" rx="4" fill={c.canon === 'expansion' ? 'url(#hatch)' : null} />
            {#if !hidden(i) || store.future === 'dim'}<text x={x(i) + COL / 2} y={TOP + (side ? LANE : 0) + 25} text-anchor="middle" class="cn">{side ? '·' : c.timeStep ? (c.date?.year ?? '–') : c.num}</text>
              {#each c.events.slice(0, 3) as ev, e (ev)}<circle cx={x(i) + COL / 2 - 6 + e * 6} cy={TOP + (side ? LANE : 0) + 2} r="2.6" class="evt"><title>{store.name(ev)}</title></circle>{/each}
              <title>{cid} · {c.title}{c.pov ? ` · POV ${store.name(c.pov)}` : ''}</title>{/if}
          </g>
        {/each}
      {/if}

      {#each branches as b, k (b.cont)}
        {#if b.at >= range[0] && b.at <= range[1]}
          {@const y = TOP + (2 + k) * LANE}
          {@const fx = x(b.at) + COL}
          <path d={`M${fx} ${TOP + 38} C ${fx} ${y + 10}, ${fx} ${y + 20}, ${fx + 10} ${y + 20}`} class="forkline" />
          <rect x={fx + 10} y={y + 6} width={Math.max(8, Math.min(b.chapters.length * COL, width - fx - 20))} height="28" rx="4" fill="url(#hatch)" class="ins" class:fut={hidden(b.at + 1) && store.cont === 'main'}
            role="button" tabindex="0" onclick={() => store.setCont(b.cont)} onkeydown={(ev) => ev.key === 'Enter' && store.setCont(b.cont)}><title>{b.title}: what if… ({b.chapters.length} chapters) — click to view this branch</title></rect>
        {/if}
      {/each}

      <g transform={`translate(0 ${TOP + lanes.length * LANE + 18})`}>
        <text x="10" y="0" class="lane">Threads & plots</text>
        {#each shownThreads as { t, a, b }, k (t.id)}
          {@const x1 = x(Math.max(a, range[0])) + COL / 2}
          {@const x2 = b != null && b <= range[1] ? x(b) + COL / 2 : Math.min(bookX + 8, x(range[1]) + COL)}
          <g class="loop" class:exp={t.canon === 'expansion'} transform={`translate(0 ${10 + k * 20})`} role="button" tabindex="0" onclick={() => store.open(t.id)} onkeydown={(ev) => ev.key === 'Enter' && store.open(t.id)}>
            <line x1={x1} x2={Math.max(x1 + 2, x2)} y1="0" y2="0" class:open={b == null} />
            {#if a >= range[0]}<circle cx={x1} cy="0" r="3.5" />{/if}
            {#if b != null && b <= range[1]}<circle cx={x2} cy="0" r="3.5" class="closed" />{/if}
            <text x={LEFT - 8} y="4" text-anchor="end" class="tname">{t.title.length > 18 ? t.title.slice(0, 17) + '…' : t.title}<title>{t.title}</title></text>
          </g>
        {/each}
      </g>
      <line x1={bookX} x2={bookX} y1="6" y2={height - 6} class="bookline" />
      <text x={bookX} y="16" text-anchor="middle" class="here">you are here</text>
    </svg>
    </PanZoom>
    {#if threads.length > 12}<button class="link small" onclick={() => (showAllThreads = !showAllThreads)}>{showAllThreads ? 'Show fewer threads' : `Show all ${threads.length} threads`}</button>{/if}
  </div>

  {#if level === 'book' && pc}
    {@const pi = store.stepIndex[pc.id]}
    <div class="card detail" class:exp={pc.canon === 'expansion'}>
      {#if hidden(pi)}
        <p class="muted">This chapter is after where you've read to. <button class="btn" onclick={() => store.setAt(pc.id)}>I've read up to here</button></p>
      {:else}
        <div class="row">
          <h2>{pc.timeStep ? pc.title : `Chapter ${pc.num} — ${pc.title}`}</h2>
          {#if pc.canon === 'expansion'}<span class="exp-mark">EXP</span>{/if}
          <span class="sp"></span>
          {#if pi !== store.idx}<button class="btn primary" onclick={() => store.setAt(pc.id)}>I've read up to here</button>{:else}<span class="chip">you are here</span>{/if}
          {#if pc.entity}<button class="btn" onclick={() => store.open(pc.entity)}>Open chapter</button>{/if}
        </div>
        <Markdown text={pc.summary} />
        <div class="small">
          {#if pc.pov}<span class="chip">POV</span> <EntityLink id={pc.pov} /> · {/if}
          {#each pc.characters as id, i (id)}{#if i}{', '}{/if}<EntityLink {id} />{/each}
          {#if pc.places.length} · @ {#each pc.places as id, i (id)}{#if i}{', '}{/if}<EntityLink {id} />{/each}{/if}
        </div>
      {/if}
    </div>
  {/if}
  {/if}
</div>

<style>
  .tl { padding: 1rem; display: grid; gap: .8rem; max-width: 1500px; margin: 0 auto; }
  .banner { background: var(--exp-tint); border: 1px solid var(--exp); border-left-width: 4px; border-radius: var(--radius); padding: .5rem .8rem; display: flex; gap: .6rem; align-items: center; }
  .bar { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .modes { display: flex; gap: .3rem; }
  .modes .on { background: var(--ink); color: var(--paper); }
  .crumbs { display: flex; gap: .4rem; align-items: center; }
  .crumbs .on { font-weight: 700; }
  .grow { flex: 1; }
  select { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; margin-left: .3rem; }
  .scroll { overflow-x: auto; padding: .5rem; }
  svg { display: block; }
  .lane { font: 600 12px var(--sans); fill: var(--ink-2); }
  .lane.exp { fill: var(--exp); }
  .rule { stroke: var(--rule); }
  .book { cursor: pointer; outline: none; }
  .bk { fill: var(--paper-2); stroke: var(--rule); }
  .rd { fill: color-mix(in srgb, var(--accent) 22%, transparent); pointer-events: none; }
  .book:hover .bk, .book:focus-visible .bk { stroke: var(--ink-2); }
  .book.cur .bk { stroke: var(--accent); stroke-width: 2; }
  .book.fut { opacity: .55; }
  .bt { font: 600 12px var(--serif); fill: var(--ink); pointer-events: none; }
  .bn { font: 10px var(--sans); fill: var(--ink-3); pointer-events: none; }
  .ins { stroke: var(--exp); stroke-width: 1; cursor: pointer; }
  .ins.fut { opacity: .45; }
  .forkline { fill: none; stroke: var(--exp); stroke-width: 2; stroke-dasharray: 4 3; }
  .chap { cursor: pointer; outline: none; }
  .chap rect { fill: var(--paper-2); stroke: var(--rule); }
  .chap.read rect { fill: color-mix(in srgb, var(--accent) 16%, var(--card)); }
  .chap:hover rect, .chap:focus-visible rect, .chap.picked rect { stroke: var(--ink-2); stroke-width: 1.5; }
  .chap.cur rect { stroke: var(--accent); stroke-width: 2.5; }
  .chap.fut rect { fill: transparent; stroke-dasharray: 3 3; }
  .cn { font: 600 11px var(--sans); fill: var(--ink-2); pointer-events: none; }
  .evt { fill: var(--accent); }
  .loop { cursor: pointer; }
  .loop line { stroke: var(--ink-2); stroke-width: 3; stroke-linecap: round; }
  .loop line.open { stroke-dasharray: 6 4; }
  .loop.exp line, .loop.exp circle { stroke: var(--exp); }
  .loop circle { fill: var(--card); stroke: var(--ink-2); stroke-width: 2; }
  .loop circle.closed { fill: var(--ink-2); }
  .tname { font: 11px var(--sans); fill: var(--ink); }
  .loop:hover .tname { text-decoration: underline; }
  .bookline { stroke: var(--accent); stroke-width: 2; opacity: .8; pointer-events: none; }
  .here { font: 700 9px var(--sans); fill: var(--accent); text-transform: uppercase; letter-spacing: .05em; }
  .detail.exp { background: var(--exp-tint); border-left: 4px solid var(--exp); }
  .row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
  .row h2 { margin: 0; }
  .sp { flex: 1; }
</style>
