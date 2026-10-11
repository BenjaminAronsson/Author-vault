<script>
  // Family tree around one person (genealogy worlds). Click someone to move the tree to them.
  import { store } from '../lib/store.svelte.js';
  import FamilyTree from '../components/FamilyTree.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import { lifeLine as lifespan } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';
  import { STYLES } from '../lib/familyLayout.js';
  import { load, save } from '../lib/storage.js';

  const people = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id))
    .sort((a, b) => a.title.localeCompare(b.title, 'sv')));
  const oldest = $derived([...people].sort((a, b) => (parseDate(a.born)?.sort ?? Infinity) - (parseDate(b.born)?.sort ?? Infinity))[0]?.id ?? null);
  const focus = $derived([store.sel, store.follow].find((id) => id && store.model.entities[id]?.type === 'character' && store.visible(id)) ?? oldest);
  let up = $state(2), down = $state(2);
  // remembered layout, if it is still one we have
  let style = $state(load('familyStyle') in STYLES ? load('familyStyle') : 'tree');
  $effect(() => save('familyStyle', style));
  // the tree gets the rest of the screen: from where its card starts down to the time scrubber
  let winH = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
  let card = $state(null), top = $state(200), below = $state(150);
  const measure = () => {
    if (!card) return;
    top = card.getBoundingClientRect().top + (card.closest('main')?.scrollTop ?? 0);
    const scrub = document.querySelector('footer.scrub');
    below = (scrub?.getBoundingClientRect().height ?? 110) + 70; // legend + note
  };
  $effect(() => { card; winH; measure(); });
  const treeH = $derived(Math.max(300, winH - top - below));
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
    <div class="seg" role="group" aria-label="Layout">
      {#each Object.entries(STYLES) as [k, label] (k)}<button class="btn ghost small" aria-pressed={style === k} onclick={() => (style = k)}>{label}</button>{/each}
    </div>
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
    <div class="card" bind:this={card}><FamilyTree {focus} {up} {down} {style} viewHeight={treeH} onpick={(id) => store.go('family', id)} /></div>
    <p class="small muted">Shown as of <strong>{store.chapter?.id}</strong>: people born later are not shown yet, people who have died are grey. Dashed = living (private). Right-click (or hold a finger on) someone for a quick card.</p>
  {:else}
    <p class="muted">Nobody is known at this point in time yet. Move the bookmark forward.</p>
  {/if}
</section>

<style>
  .fam { padding: .8rem 1rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: .6rem; }
  .fam .card { padding: .4rem; }
  .bar { display: flex; align-items: center; gap: .8rem; flex-wrap: wrap; }
  h1 { margin: 0; }
  select, input { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: .15rem .3rem; margin-left: .3rem; }
  input { width: 3.2rem; }
  .grow { flex: 1; }
  @media (max-width: 760px) { .fam { padding: .5rem; } .bar { gap: .5rem; } .bar label:first-of-type { width: 100%; } .bar select { max-width: 70vw; } .seg { display: flex; width: 100%; } .seg .btn { flex: 1 1 0; min-width: 0; justify-content: center; min-height: 40px; } }
  .seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; }
  .seg .btn { border-radius: 0; border: 0; }
  .seg .btn[aria-pressed='true'] { background: var(--accent); color: var(--card); }
</style>
