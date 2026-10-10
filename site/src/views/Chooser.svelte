<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import { canWrite, worldsFromDirectoryHandle, worldsFromFileList } from '../lib/loader.js';
  import { rememberFolder, recentFolder, reopen, hasRecent, noteRecent } from '../lib/recent.js';
  import { onMount } from 'svelte';

  let recent = $state(null);
  // only the folder's name is read at start; the handle itself is read when you click Reopen
  onMount(() => { if (canWrite()) recent = hasRecent(); });
  async function openRecent() {
    err = '';
    try {
      const h = await recentFolder();
      if (!h) { err = 'That folder is no longer remembered. Pick it again.'; recent = null; return; }
      const dir = await reopen(h);
      if (!dir) { err = 'Permission was not granted for that folder.'; return; }
      busy = true;
      found(await worldsFromDirectoryHandle(dir, (n) => (store.progress = `Finding notes… ${n.toLocaleString()}`)));
    } catch (e) { err = `Could not reopen "${recent}": ${e.message}`; busy = false; }
  }

  import { listLocal, forgetLocal, storageEstimate, fmtBytes } from '../lib/localWorlds.js';

  let { onopen, onfolder, onlocal } = $props();
  let saved = $state([]);
  let est = $state(null);
  let confirming = $state(null);
  let refreshing = $state(null); // name of the saved world being refreshed (picked folder must contain it)
  async function reloadSaved() { saved = await listLocal(); est = await storageEstimate(); }
  onMount(reloadSaved);
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso)) / 60000); return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
  async function forget(name) { await forgetLocal(name); confirming = null; reloadSaved(); }
  async function refresh(meta) {
    err = ''; refreshing = meta.name;
    try {
      const stored = meta.hasDir && canWrite() ? await recentFolder(`world:${meta.name}`) : null;
      if (stored) {
        const dir = await reopen(stored);
        if (!dir) { err = 'Permission was not granted for that folder.'; return; }
        busy = true;
        found(await worldsFromDirectoryHandle(dir, (n) => (store.progress = `Finding notes… ${n.toLocaleString()}`)));
      } else if (canWrite()) {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'world-folder' });
        busy = true; rememberFolder(dir);
        found(await worldsFromDirectoryHandle(dir, (n) => (store.progress = `Finding notes… ${n.toLocaleString()}`)));
      } else input.click();
    } catch (e) { if (e.name !== 'AbortError') err = e.message; busy = false; }
  }
  let groups = $state(null);
  let busy = $state(false);
  let err = $state('');
  let input = $state(null);
  const worlds = $derived(store.index.filter((w) => !w.demo));
  const demos = $derived(store.index.filter((w) => w.demo));

  async function pickFolder() {
    err = '';
    try {
      if (canWrite()) {
        const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'world-folder' });
        busy = true;
        rememberFolder(dir).then((ok) => { if (ok !== null) { noteRecent(dir.name); recent = dir.name; } });
        found(await worldsFromDirectoryHandle(dir, (n) => (store.progress = `Finding notes… ${n.toLocaleString()}`)));
      } else input.click();
    } catch (e) { if (e.name !== 'AbortError') err = e.message; busy = false; }
  }
  async function fromInput(files) { busy = true; found(await worldsFromFileList(files)); }
  function found(gs) {
    busy = false;
    if (!gs.length) { err = 'No world found there. Pick a folder that contains World.md (or a vault with world folders).'; return; }
    if (refreshing) {
      const g = gs.find((x) => x.name === refreshing);
      const want = refreshing; refreshing = null;
      if (g) return onfolder(g);
      if (gs.length > 1) { groups = gs; return; }
      err = `That folder holds "${gs[0].name}", not "${want}". Opening it anyway.`;
    }
    if (gs.length === 1) onfolder(gs[0]); else groups = gs;
  }
</script>

<div class="chooser">
  <header>
    <h1>{T.appName}</h1>
    <p class="muted">Follow a story visually: who knows whom, who is where, and how everyone changes, chapter by chapter.</p>
  </header>

  {#if saved.length}
    <div class="label">On this device</div>
    <div class="cards">
      {#each saved as m (m.name)}
        <div class="wcard card local">
          <div class="wt">{m.title}</div>
          <div class="small muted">{m.chapters} chapters · {m.characters} characters · {fmtBytes(m.bytes)}</div>
          <div class="small muted">loaded {ago(m.savedAt)}</div>
          <div class="acts">
            <button class="btn primary" onclick={() => onlocal(m)}>Open</button>
            <button class="btn" onclick={() => refresh(m)} title="Re-read the notes from your folder (after editing in Obsidian)">↻ Refresh</button>
            {#if confirming === m.name}
              <button class="btn danger" onclick={() => forget(m.name)}>Forget it</button>
              <button class="btn ghost" onclick={() => (confirming = null)}>Keep</button>
            {:else}
              <button class="btn ghost" onclick={() => (confirming = m.name)} title="Remove this world and everything the viewer stored about it from this browser">Forget</button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#if worlds.length}<div class="label">{T.chooseWorld}</div>{/if}
  <div class="cards">
    {#each worlds as w (w.name)}
      <button class="wcard card" onclick={() => onopen(w)}>
        {#if w.image}<img src={`./${w.image}`} alt="" />{/if}
        <div class="wt">{w.title}</div>
        <div class="small muted">{w.stories} stories · {w.chapters} chapters · {w.characters} characters</div>
      </button>
    {/each}
    {#each demos as w (w.name)}
      <button class="wcard card demo" onclick={() => onopen(w)}>
        {#if w.image}<img src={`./${w.image}`} alt="" />{/if}
        <div class="wt">{T.tryDemo}</div>
        <div class="small muted">{w.title} · {w.chapters} chapters · a tiny example world</div>
      </button>
    {/each}
    {#if recent}
      <button class="wcard card folder" onclick={openRecent} disabled={busy}>
        <div class="big">↺</div>
        <div class="wt">Reopen “{recent}”</div>
        <div class="small muted">The folder you opened last time, read live from disk.</div>
      </button>
    {/if}
    <button class="wcard card folder" onclick={pickFolder} disabled={busy}>
      <div class="big">📂</div>
      <div class="wt">{T.openFolder}</div>
      <div class="small muted">{T.openFolderHint}</div>
    </button>
  </div>
  <input bind:this={input} type="file" webkitdirectory multiple hidden onchange={(ev) => fromInput(ev.currentTarget.files)} />
  {#if busy}<p class="muted" aria-live="polite">{store.progress ?? 'Reading notes…'}</p>{/if}
  {#if err}<p class="err">{err}</p>{/if}

  {#if groups}
    <div class="card">
      <div class="label">Worlds in that folder</div>
      {#each groups as g (g.name)}<button class="btn" onclick={() => onfolder(g)}>{g.name}</button> {/each}
    </div>
  {/if}

  <p class="privacy small muted">🔒 Your worlds are read on this device and never uploaded: this page can't send data anywhere. Saved worlds stay in this browser until you click Forget.{#if est} Using {fmtBytes(est.used)} of {fmtBytes(est.quota)} available.{/if}</p>

  {#if !worlds.length && !saved.length}
    <div class="card empty">
      <h2>{T.emptyTitle}</h2>
      <p>{T.emptyBody}</p>
      <ol>{#each T.emptySteps as s (s)}<li><code>{s}</code></li>{/each}</ol>
      <p class="small muted">Then reload this page. Or open a world folder directly above.</p>
    </div>
  {/if}
</div>

<style>
  .chooser { max-width: 960px; margin: 0 auto; padding: 3rem 1.2rem; display: grid; gap: 1.2rem; }
  header h1 { font-size: 2.6rem; margin-bottom: .2rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem; }
  .wcard { text-align: left; display: grid; gap: .3rem; align-content: start; cursor: pointer; transition: transform .15s, box-shadow .15s; }
  .wcard:hover { transform: translateY(-2px); }
  .wcard img { width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; }
  .wt { font: 600 1.2rem var(--serif); }
  .demo { border-style: dashed; }
  .folder .big { font-size: 2rem; }
  .err { color: var(--neg); }
  .local { cursor: default; }
  .local:hover { transform: none; }
  .acts { display: flex; gap: .3rem; flex-wrap: wrap; margin-top: .4rem; }
  .danger { background: var(--neg); color: #fff; border-color: var(--neg); }
  .privacy { margin: 0; }
  .empty code { background: var(--paper-2); padding: .1rem .3rem; border-radius: 4px; }
</style>
