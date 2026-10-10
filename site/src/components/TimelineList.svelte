<script>
  import { store } from '../lib/store.svelte.js';
  import Markdown from './Markdown.svelte';
  import EntityLink from './EntityLink.svelte';
  import { colorOf } from '../lib/relations.js';

  let { entity } = $props();
  const items = $derived(entity.timeline
    .filter((t) => store.canonOk(t.canon ?? entity.canon) && store.stepVisible(t.step))
    .sort((a, b) => (store.stepIndex[a.step] ?? -1) - (store.stepIndex[b.step] ?? -1)));
</script>

{#if items.length}
  <ol class="tl">
    {#each items as t, i (i)}
      <li class:future={store.stepIsFuture(t.step) && t.step} class:exp={(t.canon ?? entity.canon) === 'expansion'}>
        <span class="mk">{t.marker}</span>
        <div>
          <Markdown text={t.text} />
          <div class="tags">
            {#if t.tags.at}<span class="chip">@ <EntityLink id={t.tags.at} /></span>{/if}
            {#each t.tags.rel as r (r.to)}<span class="chip"><span class="sw" style:background={colorOf(r.n)}></span>{r.bond} → <EntityLink id={r.toId} label={r.to} /></span>{/each}
            {#if t.tags.status}<span class="chip">status: {t.tags.status}</span>{/if}
            {#each t.tags.goal as g (g.goal)}<span class="chip">goal “{g.goal}”: {g.status}</span>{/each}
            {#if t.pov && t.pov !== 'objective'}<span class="chip">pov {t.pov}</span>{/if}
            {#if (t.canon ?? entity.canon) === 'expansion'}<span class="exp-mark">EXP</span>{/if}
          </div>
        </div>
      </li>
    {/each}
  </ol>
{:else}<p class="muted small">Nothing on the timeline yet at this point.</p>{/if}

<style>
  .tl { list-style: none; padding: 0; margin: 0; }
  li { display: grid; grid-template-columns: 7.5rem 1fr; gap: .6rem; padding: .4rem 0; border-bottom: 1px solid var(--rule); }
  li.exp { background: var(--exp-tint); box-shadow: inset 3px 0 0 var(--exp); }
  .mk { font: 600 .78rem var(--sans); color: var(--ink-2); padding-top: .2rem; }
  .tags { display: flex; gap: .3rem; flex-wrap: wrap; }
  .sw { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: .2rem; }
  li :global(.prose p) { margin: 0; }
</style>
