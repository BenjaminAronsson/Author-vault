<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Web from '../components/Web.svelte';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import { relationsAt, colorOf, describe } from '../lib/relations.js';

  let mode = $state('ego');
  let as = $state('graph');
  let hops = $state(1);
  let focus = $state(null);
  let recent = $state(15);
  let maxFull = $state(45);
  const chars = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id)));
  $effect(() => { if (store.follow && chars.some((c) => c.id === store.follow)) focus = store.follow; });
  $effect(() => { if (!focus || !chars.some((c) => c.id === focus)) focus = store.chapter?.pov ?? chars[0]?.id ?? null; });
  const rel = $derived((store.version, relationsAt(store)));
  const bonds = (id) => Object.values(rel.directed).filter((r) => r.from === id).sort((a, b) => b.n - a.n);
  let sortKey = $state('appear');
  let q = $state('');
  const rows = $derived([...chars].filter((c) => !q || [c.title, ...c.aliases].some((n) => n.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => sortKey === 'name' ? a.title.localeCompare(b.title) : (store.intro[a.id] ?? 0) - (store.intro[b.id] ?? 0)));
</script>

<div class="people">
  <div class="bar">
    <div class="seg" role="group" aria-label="View as">
      <button class="btn" class:on={as === 'graph'} onclick={() => (as = 'graph')}>{T.graph}</button>
      <button class="btn" class:on={as === 'list'} onclick={() => (as = 'list')}>{T.list}</button>
    </div>
    {#if as === 'graph'}
      <div class="seg" role="group" aria-label="Scope">
        <button class="btn" class:on={mode === 'ego'} onclick={() => (mode = 'ego')}>{T.ego}</button>
        <button class="btn" class:on={mode === 'full'} onclick={() => (mode = 'full')}>{T.full}</button>
      </div>
      {#if chars.length > 30}
        <label class="small">Seen in
          <select bind:value={recent}><option value={10}>last 10 chapters</option><option value={15}>last 15 chapters</option><option value={40}>last 40 chapters</option><option value={0}>the whole story so far</option></select>
        </label>
        {#if mode === 'full'}<label class="small">Show <select bind:value={maxFull}><option value={25}>25</option><option value={45}>45</option><option value={90}>90</option><option value={9999}>everyone</option></select></label>{/if}
      {/if}
      {#if mode === 'ego'}
        <label class="small">Focus
          <select bind:value={focus}>{#each chars as c (c.id)}<option value={c.id}>{c.title}</option>{/each}</select>
        </label>
        <label class="small">Hops <select bind:value={hops}><option value={1}>1</option><option value={2}>2</option></select></label>
      {/if}
    {/if}
    <span class="legend small muted">
      <span class="sw" style:background="var(--pos)"></span> warm
      <span class="sw dash" style:border-color="var(--neg)"></span> cold
      <span class="sw" style:background="var(--neu)"></span> neutral
      · each half of a line is one side's feeling · faded = from Relations table · grey = appear together
    </span>
  </div>

  {#if as === 'graph'}
    <div class="card"><Web {focus} {hops} {mode} recent={chars.length > 30 ? recent || store.sequence.length : null} max={mode === 'full' && chars.length > 30 ? maxFull : null} height={Math.max(420, (typeof window !== 'undefined' ? window.innerHeight : 800) - 260)} onpick={(id) => (focus === id ? store.open(id) : (focus = id))} /></div>
    <p class="small muted">Click someone to focus them, click again to open their page.</p>
  {:else}
    <div class="card">
      <input class="filter" placeholder="Filter by name…" bind:value={q} aria-label="Filter characters" />
      <table>
        <thead><tr>
          <th></th>
          <th><button class="link" onclick={() => (sortKey = 'name')}>Name</button></th>
          <th>Status</th><th>Now at</th><th>Warmest</th><th>Coldest</th>
          <th><button class="link" onclick={() => (sortKey = 'appear')}>First seen</button></th>
        </tr></thead>
        <tbody>
          {#each rows as c (c.id)}
            {@const b = bonds(c.id)}
            <tr class:future={store.isFuture(c.id)}>
              <td><Avatar id={c.id} size={32} /></td>
              <td><EntityLink id={c.id} /></td>
              <td class="small">{store.snap?.status[c.id] ?? '—'}</td>
              <td class="small">{#if store.snap?.presence[c.id]}<EntityLink id={store.snap.presence[c.id].place} />{:else}—{/if}</td>
              <td class="small">{#if b[0] && b[0].n > 0}<span class="sw" style:background={colorOf(b[0].n)}></span><span title={describe(store, b[0])}><EntityLink id={b[0].to} /></span>{:else}—{/if}</td>
              <td class="small">{#if b.at(-1) && b.at(-1).n < 0}<span class="sw" style:background={colorOf(b.at(-1).n)}></span><span title={describe(store, b.at(-1))}><EntityLink id={b.at(-1).to} /></span>{:else}—{/if}</td>
              <td class="small muted">{store.sequence[store.intro[c.id]] ?? '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .people { padding: 1rem; display: grid; gap: .8rem; max-width: 1400px; margin: 0 auto; }
  .bar { display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; }
  .seg { display: inline-flex; }
  .seg .btn { border-radius: 0; }
  .seg .btn:first-child { border-radius: 999px 0 0 999px; }
  .seg .btn:last-child { border-radius: 0 999px 999px 0; }
  .seg .btn.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  select { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: .15rem .3rem; margin-left: .3rem; }
  .legend { display: flex; gap: .35rem; align-items: center; flex-wrap: wrap; }
  .sw { display: inline-block; width: 14px; height: 4px; border-radius: 2px; vertical-align: middle; margin-right: .25rem; }
  .sw.dash { background: none; border-top: 3px dashed; height: 0; }
  table { width: 100%; border-collapse: collapse; }
  .filter { font: inherit; padding: .35rem .6rem; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: var(--ink); margin-bottom: .5rem; width: min(320px, 100%); }
  thead th { position: sticky; top: 0; background: var(--card); }
  th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid var(--rule); vertical-align: middle; }
  th { font: 600 .72rem var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
</style>
