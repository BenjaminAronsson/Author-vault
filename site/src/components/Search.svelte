<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Avatar from './Avatar.svelte';

  let q = $state('');
  let i = $state(0);
  let input = $state(null);
  const skip = new Set(['voice', 'memory', 'chronology', 'style']);
  const all = $derived(Object.values(store.model.entities).filter((e) => !skip.has(e.type) && store.visible(e.id)));
  const score = (e, s) => {
    const names = [e.title, e.name, ...e.aliases].map((n) => n.toLowerCase());
    if (names.some((n) => n === s)) return 0;
    if (names.some((n) => n.startsWith(s))) return 1;
    if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(s)))) return 2;
    if (names.some((n) => n.includes(s))) return 3;
    return 9;
  };
  // "B3 C12", "b3c12", "3.12", "3 12" → a chapter to jump to; book titles → start of that book
  const jumps = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out = [];
    const m = /^(?:b(?:ook)?\s*)?(\d+)[\s.:,-]*(?:c(?:h(?:apter)?)?\s*)?(\d+)$/.exec(s);
    if (m) {
      const b = store.books.filter((x) => !x.branch)[+m[1] - 1];
      if (b) { const cid = store.sequence.slice(b.start, b.end + 1).find((c) => store.model.chapters[c].story === b.story && store.model.chapters[c].num === +m[2]); if (cid) out.push({ cid, label: `${b.title} · chapter ${m[2]} — ${store.model.chapters[cid].title}` }); }
    }
    for (const b of store.books) if (b.title.toLowerCase().includes(s)) out.push({ cid: store.sequence[b.start], label: `${b.title} · start of book` });
    return out.slice(0, 4);
  });
  const results = $derived.by(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((e) => e.type === 'character').slice(0, 8);
    return all.map((e) => [score(e, s), e]).filter(([sc]) => sc < 9).sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, 12).map(([, e]) => e);
  });
  $effect(() => { q; i = 0; });
  $effect(() => { input?.focus(); });
  function jump(cid) { store.setAt(cid); store.searchOpen = false; }
  function key(ev) {
    const total = jumps.length + results.length;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); i = Math.min(total - 1, i + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); i = Math.max(0, i - 1); }
    else if (ev.key === 'Enter') { if (i < jumps.length) jump(jumps[i].cid); else if (results[i - jumps.length]) store.open(results[i - jumps.length].id); }
    else if (ev.key === 'Escape') store.searchOpen = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="veil" onclick={() => (store.searchOpen = false)}>
  <div class="box card" role="dialog" tabindex="-1" aria-label={T.search} onclick={(ev) => ev.stopPropagation()}>
    <input bind:this={input} bind:value={q} onkeydown={key} placeholder={T.searchPlaceholder} aria-label={T.search}
      role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={results[i] ? `sr-${i}` : undefined} />
    <ul id="search-results" role="listbox">
      {#each jumps as j, k (j.cid + k)}
        <li id={`sr-${k}`} role="option" aria-selected={k === i} class:on={k === i} onclick={() => jump(j.cid)} onmouseenter={() => (i = k)}>
          <span class="jmp">⤓</span><span class="t">I've read up to: {j.label}</span>
        </li>
      {/each}
      {#each results as e, k0 (e.id)}
        {@const k = k0 + jumps.length}
        <li id={`sr-${k}`} role="option" aria-selected={k === i} class:on={k === i} onclick={() => store.open(e.id)} onmouseenter={() => (i = k)}>
          <Avatar id={e.id} size={28} />
          <span class="t">{e.title}</span>
          {#if e.aliases.length}<span class="small muted">{e.aliases.slice(0, 2).join(', ')}</span>{/if}
          <span class="chip">{e.type}</span>
          {#if e.canon === 'expansion'}<span class="exp-mark">EXP</span>{/if}
        </li>
      {:else}{#if !jumps.length}<li class="muted">No matches known at this point in the story.</li>{/if}{/each}
    </ul>
  </div>
</div>

<style>
  .veil { position: fixed; inset: 0; background: rgb(20 15 5 / 35%); display: grid; justify-items: center; align-items: start; padding-top: 12vh; z-index: 50; }
  .box { width: min(560px, 92vw); padding: .6rem; }
  input { width: 100%; font: 1.05rem var(--sans); padding: .6rem .7rem; border: 1px solid var(--rule); border-radius: 8px; background: var(--paper); color: var(--ink); }
  ul { list-style: none; margin: .4rem 0 0; padding: 0; max-height: 50vh; overflow: auto; }
  li { display: flex; gap: .6rem; align-items: center; padding: .4rem .5rem; border-radius: 6px; cursor: pointer; }
  li.on { background: var(--paper-2); }
  .t { font-weight: 600; }
  .jmp { width: 28px; text-align: center; color: var(--accent); font-size: 1.1rem; }
  .chip { margin-left: auto; }
</style>
