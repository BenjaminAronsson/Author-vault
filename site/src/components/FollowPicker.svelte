<script>
  // Follow someone by typing part of a name: a dropdown of a thousand ancestors is unusable.
  // Matches title and aliases, word starts first, with or without å/ä/ö ("mansdotter" finds Månsdotter).
  import { store } from '../lib/store.svelte.js';
  import Avatar from './Avatar.svelte';
  import { ageAt } from '../lib/kin.js';

  let { up = false, placeholder = 'Follow…', label = 'Follow a person', selected = null, onpick = null, clearable = true } = $props();
  let q = $state('');
  let open = $state(false);
  let i = $state(0);
  let input = $state(null);
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const people = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id)));
  const score = (e, words) => {
    const names = [e.title, ...(e.aliases ?? [])].map(fold);
    let best = 9;
    for (const n of names) {
      const parts = n.split(/[\s(),–-]+/).filter(Boolean);
      if (!words.every((w) => n.includes(w))) continue;
      const starts = words.filter((w) => parts.some((p) => p.startsWith(w))).length;
      best = Math.min(best, n.startsWith(words[0]) ? 0 : starts === words.length ? 1 : 2);
    }
    return best;
  };
  const alive = (e) => { const l = ageAt(e, store.chapter?.date ?? null); return !l.dead && !l.deathUnknown && !/dead/.test(store.snap?.status[e.id] ?? ''); };
  const results = $derived.by(() => {
    const words = fold(q).trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      // nothing typed: who is alive somewhere at this date, those are the ones that can be followed now
      const here = Object.keys(store.snap?.presence ?? {}).map((id) => store.model.entities[id]).filter((e) => e && e.type === 'character' && store.visible(e.id) && alive(e));
      return here.sort((a, b) => a.title.localeCompare(b.title)).slice(0, 10);
    }
    return people.map((e) => [score(e, words), e]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title)).slice(0, 12).map(([, e]) => e);
  });
  $effect(() => { q; i = 0; });
  const chosen = $derived(onpick ? selected : store.follow);
  function pick(e) { const id = e?.id ?? null; if (onpick) onpick(id); else store.setFollow(id); q = ''; open = false; input?.blur(); }
  function key(ev) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); open = true; i = Math.min(results.length - 1, i + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); i = Math.max(0, i - 1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); if (results[i]) pick(results[i]); }
    else if (ev.key === 'Escape') { q = ''; open = false; input?.blur(); }
    ev.stopPropagation(); // ← → move the cursor here, not the bookmark
  }
</script>

<div class="fp" class:up>
  {#if chosen && !open}
    <button class="chosen" title={onpick ? 'Change person' : 'Change who you follow'} onclick={() => { open = true; queueMicrotask(() => input?.focus()); }}>
      <Avatar id={chosen} size={20} /><span class="nm">{store.name(chosen)}</span>
    </button>
    {#if clearable}<button class="x" aria-label={onpick ? 'Clear person' : 'Stop following'} title={onpick ? 'Clear person' : 'Stop following'} onclick={() => pick(null)}>×</button>{/if}
  {:else}
    <input bind:this={input} bind:value={q} onfocus={() => (open = true)} onblur={() => setTimeout(() => (open = false), 150)} onkeydown={key}
      {placeholder} aria-label={label} role="combobox" aria-expanded={open} aria-controls="fp-list" autocomplete="off" />
  {/if}
  {#if open}
    <ul id="fp-list" role="listbox">
      {#if !q.trim()}<li class="hint muted small">{results.length ? 'Here at this date. Type a name to find anyone' : 'Type part of a name'}</li>{/if}
      {#each results as e, k (e.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li role="option" aria-selected={k === i} class:on={k === i} onmousedown={(ev) => { ev.preventDefault(); pick(e); }} onmouseenter={() => (i = k)}>
          <Avatar id={e.id} size={22} /><span class="t">{e.title}</span>
          {#if store.snap?.presence[e.id]?.place}<span class="small muted">· {store.name(store.snap.presence[e.id].place)}</span>{/if}
        </li>
      {:else}{#if q.trim()}<li class="muted small">No one by that name</li>{/if}{/each}
    </ul>
  {/if}
</div>

<style>
  .fp { position: relative; display: flex; align-items: center; gap: .2rem; min-width: 0; }
  input { width: 100%; min-width: 9rem; font: inherit; padding: .3rem .5rem; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: var(--ink); }
  .chosen { display: flex; align-items: center; gap: .35rem; min-width: 0; flex: 1; font: inherit; padding: .2rem .5rem; border: 1px solid var(--accent); border-radius: 6px; background: var(--paper); color: var(--ink); cursor: pointer; }
  .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .x { font: inherit; border: none; background: none; color: var(--muted, inherit); cursor: pointer; padding: 0 .3rem; }
  ul { position: absolute; left: 0; top: 100%; z-index: 40; width: max(100%, 20rem); max-width: 92vw; max-height: 45vh; overflow: auto; list-style: none; margin: .2rem 0 0; padding: .25rem; background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; box-shadow: 0 6px 20px rgb(0 0 0 / 18%); }
  .up ul { top: auto; bottom: 100%; margin: 0 0 .2rem; }
  li { display: flex; align-items: center; gap: .45rem; padding: .3rem .4rem; border-radius: 5px; cursor: pointer; }
  li.on { background: var(--paper-2); }
  li.hint { cursor: default; }
  .t { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
</style>
