<script>
  import { onMount } from 'svelte';
  import { store, applyHash, readHash, writeHash, isWritingHash } from './lib/store.svelte.js';
  import { loadDataWorld, parseWorldGroup } from './lib/loader.js';
  import { loadPending, savePending, pickWorldDir } from './lib/images.js';
  import { loadEdits, saveEdits, editsYaml } from './lib/edits.js';
  import { saveLocal, loadLocal, listLocal } from './lib/localWorlds.js';
  import { copy } from './lib/obsidian.js';
  import { T } from './lib/strings.js';
  import Chooser from './views/Chooser.svelte';
  import Home from './views/Home.svelte';
  import Timeline from './views/Timeline.svelte';
  import People from './views/People.svelte';
  import Places from './views/Places.svelte';
  import Reader from './views/Reader.svelte';
  import Character from './views/Character.svelte';
  import Entity from './views/Entity.svelte';
  import Scrubber from './components/Scrubber.svelte';
  import Search from './components/Search.svelte';
  import Coverage from './components/Coverage.svelte';
  import Tour from './components/Tour.svelte';

  let theme = $state(localStorage.getItem('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $effect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); });
  $effect(() => { document.title = store.model ? `${store.model.world} · ${T.appName}` : T.appName; });

  async function openData(entry) {
    store.loading = true; store.error = null;
    try {
      const model = await loadDataWorld(entry);
      start(model, { kind: 'data' });
    } catch (e) { store.error = e.message; }
    store.loading = false;
  }
  let localNote = $state('');
  async function openFolder(group) {
    store.loading = true; store.error = null;
    try {
      const model = await parseWorldGroup(group, (pr) => (store.progress = pr.phase === 'reading' ? `Reading notes… ${pr.done.toLocaleString()} / ${pr.total.toLocaleString()}` : 'Putting the world together…'));
      store.progress = null;
      start(model, { kind: 'folder', dir: group.dir ?? null });
      // keep a copy on this device so it reopens without picking the folder again
      localNote = 'Saving on this device…';
      saveLocal(model, { dir: group.dir ?? null })
        .then(() => { localNote = 'Saved on this device ✓'; setTimeout(() => (localNote = ''), 3000); })
        .catch((e) => { localNote = `Couldn't keep a copy on this device (${e.message}). It still works until you close the tab.`; });
    } catch (e) { store.error = e.message; }
    store.loading = false;
  }
  async function openLocal(meta) {
    store.loading = true; store.error = null;
    try {
      const model = await loadLocal(meta.name);
      if (!model) throw new Error(`"${meta.name}" is no longer stored on this device.`);
      start(model, { kind: 'local', dir: null, savedAt: meta.savedAt });
    } catch (e) { store.error = e.message; }
    store.loading = false;
  }
  function start(model, source) {
    store.model = model;
    store.source = source;
    const h = readHash();
    if (h.world === model.world) applyHash();
    else { store.view = 'home'; store.sel = null; store.at = localStorage.getItem(`bookmark:${model.world}`); store.cont = 'main'; }
    writeHash(store, true);
    loadPending(model.world);
    loadEdits(model.world);
    if (!localStorage.getItem('tour:done')) setTimeout(() => (store.tourOpen = true), 400);
  }
  function leave() { store.model = null; history.pushState(null, '', location.pathname); }

  onMount(() => {
    const h = readHash();
    if (h.world) {
      const entry = store.index.find((w) => w.name === h.world);
      if (entry) openData(entry);
      else listLocal().then((l) => { const m = l.find((x) => x.name === h.world); if (m) openLocal(m); });
    }
    const onHash = () => {
      if (isWritingHash()) return;
      const h = readHash();
      if (!h.world) { store.model = null; return; }
      if (store.model?.world === h.world) applyHash();
      else {
        const entry = store.index.find((w) => w.name === h.world);
        if (entry) openData(entry);
        else listLocal().then((l) => { const m = l.find((x) => x.name === h.world); if (m) openLocal(m); });
      }
    };
    addEventListener('popstate', onHash);
    addEventListener('hashchange', onHash);
    return () => { removeEventListener('popstate', onHash); removeEventListener('hashchange', onHash); };
  });

  function keys(ev) {
    if (!store.model) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || ev.target.isContentEditable;
    if ((ev.key === 'k' && (ev.metaKey || ev.ctrlKey)) || (ev.key === '/' && !typing)) { ev.preventDefault(); store.searchOpen = true; return; }
    if (ev.key === 'Escape') { store.searchOpen = false; store.coverageOpen = false; return; }
    if (store.tourOpen) return;
    if (typing || store.searchOpen || ev.target.closest?.('[role="slider"]')) return;
    if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') { ev.preventDefault(); ev.shiftKey ? store.moveStory(ev.key === 'ArrowRight' ? 1 : -1) : store.move(ev.key === 'ArrowRight' ? 1 : -1); }
  }

  const counts = $derived.by(() => {
    const c = { book: 0, expansion: 0, draft: 0 };
    for (const e of Object.values(store.model?.entities ?? {})) if (e.canon in c) c[e.canon]++;
    return c;
  });
  const nav = ['home', 'timeline', 'people', 'places', 'reader'];
  const selType = $derived(store.sel ? store.model?.entities[store.sel]?.type : null);
  const pendingHere = $derived(store.pending.filter((p) => p.world === store.model?.world));
  let saveMsg = $state('');
  const editsHere = $derived(store.pendingEdits);
  async function save() {
    saveMsg = '';
    try {
      if (!('showDirectoryPicker' in window)) {
        const r = pendingHere.length ? await savePending() : null;
        if (editsHere.length) await copy(editsYaml());
        saveMsg = [r?.snippets, editsHere.length ? `Copied the map changes as YAML: paste them into these notes:\n\n${editsYaml()}` : ''].filter(Boolean).join('\n\n');
        return;
      }
      const dir = store.source?.dir ?? (await pickWorldDir());
      const imgs = pendingHere.length ? (await savePending(dir))?.written ?? 0 : 0;
      const eds = await saveEdits(dir);
      saveMsg = `Saved ${[imgs && `${imgs} image(s)`, eds && `${eds} change(s)`].filter(Boolean).join(' and ')} to the vault.`;
    } catch (e) { if (e.name !== 'AbortError') saveMsg = e.message; }
  }
</script>

<svelte:window onkeydown={keys} />

{#if !store.model}
  <Chooser onopen={openData} onfolder={openFolder} onlocal={openLocal} />
  {#if store.loading || store.progress}<p class="center muted" aria-live="polite">{store.progress ?? 'Loading…'}</p>{/if}
  {#if store.error}<p class="center err">{store.error}</p>{/if}
{:else}
  <div class="shell">
    <header class="top">
      <button class="brand" onclick={leave} title="Choose another world">
        <span class="mark">◈</span> <span class="wname">{store.model.entities[store.model.worldEntity]?.title ?? store.model.world}</span>
      </button>
      <nav aria-label="Views" data-tour="nav">
        {#each nav as v (v)}
          <button class="navb" class:on={store.view === v} aria-current={store.view === v ? 'page' : undefined} onclick={() => store.go(v)}>{T.nav[v]}</button>
        {/each}
      </nav>
      <button class="btn searchb" data-tour="search" onclick={() => (store.searchOpen = true)} aria-keyshortcuts="Control+K">⌕ {T.search} <kbd>⌘K</kbd></button>
      <span class="grow"></span>
      <span class="ftour" data-tour="filters">
      <div class="filters" role="group" aria-label="Canon filter">
        {#each ['book', 'expansion', 'draft'] as c (c)}
          {#if counts[c] || c === 'book'}
            <button class="fchip {c}" class:on={store.canon.includes(c)} aria-pressed={store.canon.includes(c)} onclick={() => store.toggleCanon(c)}>{T.canon[c]} <span>{counts[c]}</span></button>
          {/if}
        {/each}
      </div>
      {#if store.clock && store.clock.continuities.length > 1}
        <label class="small cont">{T.continuity}
          <select value={store.cont} onchange={(ev) => store.setCont(ev.currentTarget.value)}>
            {#each store.clock.continuities as c (c)}<option value={c}>{c === 'main' ? 'main' : `⑂ ${c}`}</option>{/each}
          </select>
        </label>
      {/if}
      </span>
      <button class="btn ghost" onclick={() => { store.future = store.future === 'hide' ? 'dim' : 'hide'; writeHash(store); }} aria-pressed={store.future === 'dim'} title="Spoilers after the bookmark">
        {store.future === 'hide' ? '🙈' : '👁'} <span class="hide-sm">{store.future === 'hide' ? T.showFuture.hide : T.showFuture.dim}</span></button>
      <button class="btn ghost" data-tour="coverage" onclick={() => (store.coverageOpen = true)} title={T.coverage}>ⓘ <span class="hide-sm">{T.coverage}</span></button>
      <button class="btn ghost" onclick={() => (store.tourOpen = true)} aria-label="Show the guided tour" title="Guided tour">?</button>
      <button class="btn ghost" onclick={() => (theme = theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode">{theme === 'dark' ? '☀' : '☾'}</button>
    </header>

    {#if store.fork && store.view !== 'timeline'}
      <div class="banner">⑂ {T.branchBanner(store.cont, store.fork.at)} <button class="btn" onclick={() => store.setCont('main')}>{T.backToMain}</button></div>
    {/if}
    {#if localNote}<div class="banner note">{localNote}</div>{/if}
    {#if pendingHere.length || editsHere.length}
      <div class="banner pend">{[pendingHere.length && T.pendingImages(pendingHere.length), editsHere.length && `${editsHere.length} map change${editsHere.length === 1 ? '' : 's'} not saved to the vault`].filter(Boolean).join(' · ')}
        <button class="btn primary" onclick={save}>{T.saveToVault}</button>
        {#if editsHere.length}<button class="btn" onclick={() => copy(editsYaml()).then(() => (saveMsg = 'Copied as YAML.'))}>Copy as YAML</button>{/if}
        {#if saveMsg}<pre class="small">{saveMsg}</pre>{/if}</div>
    {/if}

    <main>
      {#key store.model.world + store.cont}
        {#if store.view === 'entity' && store.sel && store.model.entities[store.sel]}
          {#if selType === 'character'}<Character id={store.sel} />{:else}<Entity id={store.sel} />{/if}
        {:else if store.view === 'timeline'}<Timeline />
        {:else if store.view === 'people'}<People />
        {:else if store.view === 'places'}<Places />
        {:else if store.view === 'reader'}<Reader />
        {:else}<Home />{/if}
      {/key}
    </main>

    <Scrubber />
  </div>
  {#if store.searchOpen}<Search />{/if}
  {#if store.coverageOpen}<Coverage />{/if}
  {#if store.tourOpen}<Tour />{/if}
{/if}

<style>
  .shell { height: 100vh; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; gap: .6rem; padding: .5rem 1rem; background: var(--card); border-bottom: 1px solid var(--rule); flex-wrap: wrap; }
  .brand { background: none; border: 0; font: 600 1.15rem var(--serif); display: flex; align-items: center; gap: .3rem; padding: 0 .4rem 0 0; }
  .mark { color: var(--accent); }
  nav { display: flex; gap: .1rem; }
  .navb { white-space: nowrap; background: none; border: 0; padding: .35rem .7rem; border-radius: 6px; color: var(--ink-2); font-weight: 500; }
  .navb:hover { background: var(--paper-2); }
  .navb.on { color: var(--ink); background: var(--paper-2); box-shadow: inset 0 -2px 0 var(--accent); }
  kbd { font: .7rem var(--sans); border: 1px solid var(--rule); border-radius: 4px; padding: 0 .3rem; color: var(--ink-3); }
  .grow { flex: 1; }
  .filters { display: flex; gap: .3rem; }
  .ftour { display: inline-flex; gap: .6rem; align-items: center; }
  .fchip { border: 1px solid var(--rule); background: transparent; border-radius: 999px; padding: .2rem .6rem; font-size: .8rem; color: var(--ink-3); }
  .fchip span { opacity: .7; font-variant-numeric: tabular-nums; }
  .fchip.on.book { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .fchip.on.expansion { background: var(--exp); color: #fff; border-color: var(--exp); }
  .fchip.on.draft { border-style: dotted; color: var(--ink); border-color: var(--ink-2); }
  .fchip:not(.on) { text-decoration: line-through; }
  .cont select { font: inherit; background: var(--card); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; margin-left: .3rem; }
  main { overflow: auto; min-height: 0; flex: 1; }
  .banner { padding: .45rem 1rem; background: var(--exp-tint); border-bottom: 1px solid var(--exp); border-left: 4px solid var(--exp); display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; font-size: .9rem; }
  .banner.note { background: var(--paper-2); border-color: var(--rule); border-left-color: var(--accent); }
  .banner.pend { background: color-mix(in srgb, var(--accent) 10%, var(--paper)); border-color: var(--accent); }
  .banner pre { width: 100%; white-space: pre-wrap; margin: .3rem 0 0; }
  .center { text-align: center; }
  .err { color: var(--neg); }
  @media (max-width: 1560px) { .hide-sm { display: none; } }
  @media (max-width: 760px) {
    .top { gap: .3rem; padding: .4rem .6rem; }
    nav { order: 10; width: 100%; overflow-x: auto; }
    .searchb kbd, .filters, .cont { display: none; }
  }
</style>
