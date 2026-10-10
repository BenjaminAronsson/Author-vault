<script>
  // Bridges back to authoring: Obsidian, /become, /expand-story.
  import { store } from '../lib/store.svelte.js';
  import { obsidianUrl, stepArg, copy } from '../lib/obsidian.js';
  import { T } from '../lib/strings.js';

  let { id } = $props();
  const e = $derived(store.model?.entities[id]);
  const vault = $derived(store.entry?.vault ?? store.source?.vault ?? 'book-universe');
  const url = $derived(e ? obsidianUrl(vault, store.model.world, e.path) : null);
  let done = $state('');
  async function cp(kind, text) { await copy(text); done = kind; setTimeout(() => (done = ''), 1500); }
  const become = $derived(e ? `/become ${e.title} at ${stepArg(store.sequence[store.idx])}${store.cont !== 'main' ? ' ' + store.cont : ''} ${store.model.world}` : '');
  const expand = $derived(e ? `/expand-story ${store.model.world} "${e.title}"` : '');
</script>

<div class="actions">
  {#if url}<a class="btn" href={url} title="obsidian:// link">◆ {T.openInObsidian}</a>{/if}
  {#if e?.type === 'character'}
    <button class="btn" class:on={store.follow === id} aria-pressed={store.follow === id} onclick={() => store.setFollow(store.follow === id ? null : id)} title="Keep this character in focus while you move through the story (▶ play to watch them)">👁 {store.follow === id ? 'Following' : 'Follow'}</button>
    <button class="btn" onclick={() => cp('become', become)} title={become}>🎭 {done === 'become' ? T.copied : T.copyBecome}</button>
  {/if}
  {#if e?.type === 'thread' || e?.type === 'plot'}
    <button class="btn" onclick={() => cp('expand', expand)} title={expand}>✎ {done === 'expand' ? T.copied : T.copyExpand}</button>
  {/if}
</div>

<style>.actions { display: flex; gap: .4rem; flex-wrap: wrap; } a.btn { text-decoration: none; } .btn.on { background: var(--accent); color: var(--paper); border-color: var(--accent); }</style>
