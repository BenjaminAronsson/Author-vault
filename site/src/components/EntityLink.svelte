<script>
  import { store } from '../lib/store.svelte.js';
  let { id, label = null } = $props();
  const e = $derived(store.model?.entities[id]);
</script>

{#if e}
  <button class="link" data-entity={id} class:future={store.isFuture(id)} onclick={() => store.open(id)}>{label ?? e.title}{#if e.canon === 'expansion'}&nbsp;<span class="exp-mark" title="Expansion">EXP</span>{/if}</button>
{:else}
  <span class="muted">{label ?? id}</span>
{/if}
