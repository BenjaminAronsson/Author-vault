<script module>
  let nextId = 0;
</script>

<script>
  let { options = [], value = null, onpick, placeholder = 'Search…', label = 'Choose a point in time' } = $props();
  let q = $state('');
  let open = $state(false);
  let i = $state(0);
  let input = $state(null);
  const listId = `step-picker-${++nextId}`;
  const fold = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const chosen = $derived(options.find((option) => option.id === value));
  const results = $derived.by(() => {
    const query = fold(q).trim();
    if (!query) return options.slice(0, 10);
    return options.filter((option) => fold(`${option.id} ${option.label} ${option.search ?? ''}`).includes(query)).slice(0, 12);
  });
  $effect(() => { q; i = 0; });
  function pick(option) {
    if (!option) return;
    onpick(option.id);
    q = '';
    open = false;
    input?.blur();
  }
  function key(ev) {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); open = true; i = Math.min(results.length - 1, i + 1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); i = Math.max(0, i - 1); }
    else if (ev.key === 'Enter') { ev.preventDefault(); pick(results[i]); }
    else if (ev.key === 'Escape') { q = ''; open = false; input?.blur(); }
    ev.stopPropagation();
  }
</script>

<div class="sp">
  {#if chosen && !open}
    <button class="chosen" title="Change point in time" onclick={() => { open = true; queueMicrotask(() => input?.focus()); }}>
      <span class="selected">{chosen.label}</span>
    </button>
  {:else}
    <input bind:this={input} bind:value={q} onfocus={() => (open = true)} onblur={() => setTimeout(() => (open = false), 150)} onkeydown={key}
      {placeholder} aria-label={label} role="combobox" aria-expanded={open} aria-controls={listId} autocomplete="off" />
  {/if}
  {#if open}
    <ul id={listId} role="listbox">
      {#if !q.trim()}<li class="hint muted small">Type a year, date, chapter number or title</li>{/if}
      {#each results as option, k (option.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <li role="option" aria-selected={k === i} class:on={k === i} onmousedown={(ev) => { ev.preventDefault(); pick(option); }} onmouseenter={() => (i = k)}>
          <span class="title">{option.label}</span>
        </li>
      {:else}{#if q.trim()}<li class="muted small">No matching point in time</li>{/if}{/each}
    </ul>
  {/if}
</div>

<style>
  .sp { position: relative; min-width: 0; flex: 1 1 55%; }
  input, .chosen { width: 100%; min-width: 0; box-sizing: border-box; font: inherit; font-size: .85rem; padding: .2rem .3rem; border: 1px solid var(--rule); border-radius: 6px; background: var(--paper); color: var(--ink); }
  .chosen { display: flex; text-align: left; cursor: pointer; }
  .selected, .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  ul { position: absolute; left: 0; top: 100%; z-index: 40; width: max(100%, 18rem); max-width: 92vw; max-height: 45vh; overflow: auto; list-style: none; margin: .2rem 0 0; padding: .25rem; background: var(--paper); border: 1px solid var(--rule); border-radius: 8px; box-shadow: 0 6px 20px rgb(0 0 0 / 18%); }
  li { display: flex; align-items: center; padding: .3rem .4rem; border-radius: 5px; cursor: pointer; }
  li.on { background: var(--paper-2); }
  li.hint { cursor: default; }
</style>
