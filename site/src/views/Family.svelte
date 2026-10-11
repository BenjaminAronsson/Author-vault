<script>
  // Family tree around one person (genealogy worlds). Click someone to move the tree to them.
  import { store } from '../lib/store.svelte.js';
  import FamilyTree from '../components/FamilyTree.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import { lifespan } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';

  const people = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'sv')));
  const oldest = $derived([...people].sort((a, b) => (parseDate(a.born)?.sort ?? Infinity) - (parseDate(b.born)?.sort ?? Infinity))[0]?.id ?? null);
  const focus = $derived([store.sel, store.follow].find((id) => id && store.model.entities[id]?.type === 'character' && store.visible(id)) ?? oldest);
  let up = $state(2), down = $state(2);
  let winH = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  // the tree gets the screen: window minus header, toolbar, legend, note and the time scrubber
  const treeH = $derived(Math.max(320, winH - 330));
  const hiddenLiving = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && e.living).length);
</script>

<svelte:window bind:innerHeight={winH} />
<section class="fam">
  <header class="bar">
    <h1>Family</h1>
    <label class="small">Person
      <select value={focus ?? ''} onchange={(ev) => store.go('family', ev.currentTarget.value)}>
        {#each people as p (p.id)}<option value={p.id}>{p.title.replace(/\s*\([^)]*\)\s*$/, '')} {lifespan(p) && `(${lifespan(p)})`}</option>{/each}
      </select>
    </label>
    <label class="small">Generations up <input type="number" min="0" max="8" bind:value={up} /></label>
    <label class="small">down <input type="number" min="0" max="8" bind:value={down} /></label>
    {#if focus}<span class="small">· <EntityLink id={focus} label="Open person" /></span>{/if}
    <span class="grow"></span>
    {#if hiddenLiving}
      <button class="btn ghost small" aria-pressed={store.showLiving} onclick={() => { store.showLiving = !store.showLiving; store.go('family', focus); }}>
        {store.showLiving ? `Hide living people (${hiddenLiving})` : `${hiddenLiving} living ${hiddenLiving === 1 ? 'person' : 'people'} hidden · show`}</button>
    {/if}
  </header>
  {#if focus}
    <div class="card"><FamilyTree {focus} {up} {down} viewHeight={treeH} onpick={(id) => store.go('family', id)} /></div>
    <p class="small muted">Shown as of <strong>{store.chapter?.id}</strong>: people born later are not shown yet, people who have died are grey. Dashed = living (private).</p>
  {:else}
    <p class="muted">Nobody is known at this point in time yet. Move the bookmark forward.</p>
  {/if}
</section>

<style>
  .fam { padding: .8rem 1rem; display: grid; gap: .6rem; }
  .fam .card { padding: .4rem; }
  .bar { display: flex; align-items: center; gap: .8rem; flex-wrap: wrap; }
  h1 { margin: 0; }
  select, input { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: .15rem .3rem; margin-left: .3rem; }
  input { width: 3.2rem; }
  .grow { flex: 1; }
</style>
