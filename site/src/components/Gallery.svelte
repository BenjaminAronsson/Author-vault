<script>
  // Photos of a person, place or event: tagged Media notes (`depicts`, `place`, `event`) and the note's own
  // `gallery`. Thumbnails load lazily; the large version loads only in the lightbox. Photos that show a hidden
  // living person stay hidden too.
  import { store } from '../lib/store.svelte.js';
  import EntityLink from './EntityLink.svelte';
  import { tag, untag, addPhoto, canAdd } from '../lib/photos.js';

  let { id, strip = false, max = strip ? 6 : 60, add = false } = $props();
  const e = $derived(store.model?.entities[id]);
  const url = (p) => store.model?.imageUrls?.[p] ?? null;
  const full = (p) => store.model?.imageFullUrls?.[p] ?? url(p);
  const hidden = (m) => m.depicts.some((d) => store.model.entities[d]?.living && !store.showLiving);
  const items = $derived.by(() => {
    store.version;
    if (!e) return [];
    const own = e.type === 'media' ? [e] : [];
    const tagged = (e.media ?? []).map((m) => store.model.entities[m]).filter((m) => m && !hidden(m) && store.canonOk(m.canon));
    const extra = (e.gallery ?? []).map((p) => ({ id: p, image: p, depicts: [id], caption: '', mediaDate: null }));
    return [...own, ...tagged, ...extra].filter((m) => url(m.image)).slice(0, max);
  });
  let open = $state.raw(null); // a model entity: not proxied, re-read on store.version
  let dlg = $state(null);
  $effect(() => { if (!dlg) return; if (open && !dlg.open) dlg.showModal(); else if (!open && dlg.open) dlg.close(); });
  const step = (d) => { if (tagging) return; const i = items.indexOf(open); open = items[(i + d + items.length) % items.length]; };

  // ---- tagging: drag a box over a face, pick who it is (or just pick someone, without a box) -------------
  let tagging = $state(false), box = $state(null), who = $state(''), msg = $state('');
  let pic = $state(null), drawing = null;
  const people = $derived(Object.values(store.model.entities).filter((x) => x.type === 'character' && store.visible(x.id)).sort((a, b) => a.title.localeCompare(b.title)));
  const editable = (m) => m?.type === 'media' && m.path; // gallery extras are plain files: nothing to tag
  const fr = (ev) => { const r = pic.getBoundingClientRect(); return [Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))]; };
  function bdown(ev) { if (!tagging) return; ev.preventDefault(); const [x, y] = fr(ev); drawing = { x, y }; box = { x, y, w: 0, h: 0 }; pic.setPointerCapture?.(ev.pointerId); }
  function bmove(ev) { if (!drawing) return; const [x, y] = fr(ev); box = { x: Math.min(x, drawing.x), y: Math.min(y, drawing.y), w: Math.abs(x - drawing.x), h: Math.abs(y - drawing.y) }; }
  function bup() { drawing = null; if (box && (box.w < 0.02 || box.h < 0.02)) box = null; }
  async function saveTag() {
    if (!who) return;
    const m = store.model.entities[open.id];
    const r = await tag(m, who, box);
    msg = r.saved ? `Tagged ${store.name(who)}.` : `Tagged ${store.name(who)}. Not saved to the vault yet (see the banner).`;
    open = m; box = null; who = '';
  }
  async function removeTag(d) {
    const m = store.model.entities[open.id];
    await untag(m, d);
    open = m; msg = `Removed ${store.name(d)}.`;
  }

  // ---- adding a photo here (folder mode) ---------------------------------------------------------------
  let input = $state(null), busy = $state(false), addMsg = $state('');
  async function pick(files) {
    const f = [...(files ?? [])].filter((x) => x.type.startsWith('image/'));
    if (!f.length) return;
    busy = true; addMsg = '';
    try { for (const x of f) await addPhoto(e, x); addMsg = `${f.length} photo${f.length > 1 ? 's' : ''} added. Tag who else is in ${f.length > 1 ? 'them' : 'it'} from the picture.`; }
    catch (err) { addMsg = err.message; }
    busy = false;
  }
</script>

{#if items.length || (add && !strip)}
  <div class="gal" class:strip>
    {#each items as m (m.id)}
      <button class="th" onclick={() => (open = m)} title={m.caption || m.title || ''}>
        <img src={url(m.image)} alt={m.caption || m.title || ''} loading="lazy" decoding="async" />
        {#if !strip && (m.mediaDate || m.caption)}<span class="cap small">{m.mediaDate ?? ''}{m.mediaDate && m.caption ? ' · ' : ''}{m.caption}</span>{/if}
      </button>
    {/each}
    {#if add && !strip}
      <button class="th addb" disabled={busy || !canAdd()} onclick={() => input.click()}
        ondragover={(ev) => ev.preventDefault()} ondrop={(ev) => { ev.preventDefault(); if (canAdd()) pick(ev.dataTransfer.files); }}
        title={canAdd() ? 'Add photos (or drop them here)' : 'Open the world folder (Open world folder… on the start page) to add photos'}>
        <span>{busy ? '…' : '＋'}</span><span class="small">{canAdd() ? 'Add photo' : 'Open the world folder to add photos'}</span>
      </button>
      <input bind:this={input} type="file" accept="image/*" multiple hidden onchange={(ev) => pick(ev.currentTarget.files)} />
    {/if}
  </div>
  {#if addMsg}<p class="small muted">{addMsg}</p>{/if}
{/if}

<dialog bind:this={dlg} onclose={() => { open = null; tagging = false; box = null; msg = ''; }} onclick={(ev) => { if (ev.target === dlg) open = null; }}
  onkeydown={(ev) => { if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1); }}>
  {#if open}
    <figure>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="pic" class:tagging bind:this={pic} onpointerdown={bdown} onpointermove={bmove} onpointerup={bup}>
        <img src={full(open.image)} alt={open.caption || open.title || ''} draggable="false" />
        {#if box}<span class="region new" style:left={`${box.x * 100}%`} style:top={`${box.y * 100}%`} style:width={`${box.w * 100}%`} style:height={`${box.h * 100}%`}></span>{/if}
        {#key store.version}{#each open.regions ?? [] as r (r.who)}
          <span class="region" style:left={`${r.x * 100}%`} style:top={`${r.y * 100}%`} style:width={`${r.w * 100}%`} style:height={`${r.h * 100}%`}><span>{store.name(r.who)}</span></span>
        {/each}{/key}
      </div>
      {#key store.version}
      <figcaption>
        {#if open.caption}<p>{open.caption}</p>{/if}
        <p class="small muted">
          {#if open.mediaDate}{open.mediaDate}{/if}
          {#if open.mediaPlace} · <EntityLink id={open.mediaPlace} />{/if}
          {#if open.mediaEvent} · <EntityLink id={open.mediaEvent} />{/if}
        </p>
        {#if open.depicts.length}<p class="small">In the picture: {#each open.depicts as d, i (d)}{#if i}{', '}{/if}<EntityLink id={d} />{#if tagging}<button class="x" onclick={() => removeTag(d)} aria-label={`Remove ${store.name(d)}`}>×</button>{/if}{/each}</p>{/if}
        {#if tagging}
          <div class="tagbar">
            <span class="small muted">{box ? 'Who is this?' : 'Drag a box over a face, or just pick someone.'}</span>
            <select bind:value={who}><option value="">Choose a person…</option>{#each people as p (p.id)}<option value={p.id}>{p.title}</option>{/each}</select>
            <button class="btn primary" disabled={!who} onclick={saveTag}>Tag</button>
          </div>
        {/if}
        {#if msg}<p class="small muted">{msg}</p>{/if}
        {#if open.type === 'media' && open.id !== id}<p class="small"><EntityLink id={open.id} label="Open photo note" /></p>{/if}
      </figcaption>
      {/key}
    </figure>
    <div class="nav">
      {#if editable(open)}<button class="btn" aria-pressed={tagging} onclick={() => { tagging = !tagging; box = null; msg = ''; }}>{tagging ? 'Done tagging' : '🏷 Tag people'}</button>{/if}
      <span class="sp"></span>
      {#if items.length > 1}<button class="btn" onclick={() => step(-1)} aria-label="Previous">‹</button><button class="btn" onclick={() => step(1)} aria-label="Next">›</button>{/if}
      <button class="btn" onclick={() => (open = null)}>Close</button>
    </div>
  {/if}
</dialog>

<style>
  .gal { display: grid; grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr)); gap: .5rem; }
  .gal.strip { grid-template-columns: repeat(auto-fill, minmax(3.5rem, 1fr)); gap: .3rem; }
  .th { position: relative; padding: 0; border: 1px solid var(--rule); border-radius: 8px; overflow: hidden; background: var(--card); aspect-ratio: 1; }
  .th img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .th:hover { border-color: var(--accent); }
  .cap { position: absolute; inset: auto 0 0 0; padding: .2rem .35rem; background: color-mix(in srgb, var(--bg, #000) 70%, transparent); color: var(--ink); text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  dialog { max-width: min(96vw, 1100px); max-height: 94dvh; padding: .8rem; border: 1px solid var(--rule); border-radius: 12px; background: var(--card); color: var(--ink); }
  dialog::backdrop { background: rgb(0 0 0 / .7); }
  figure { margin: 0; display: grid; gap: .5rem; }
  .pic { position: relative; justify-self: center; }
  .pic img { display: block; max-width: 100%; max-height: 72dvh; border-radius: 6px; }
  .region { position: absolute; border: 2px solid var(--accent); border-radius: 4px; }
  .region span { position: absolute; top: 100%; left: 0; font: 600 .7rem var(--sans); background: var(--accent); color: var(--card); padding: 0 .25rem; white-space: nowrap; }
  figcaption p { margin: .1rem 0; }
  .nav { display: flex; gap: .4rem; justify-content: flex-end; flex-wrap: wrap; }
  .nav .sp { flex: 1; }
  .pic.tagging { cursor: crosshair; touch-action: none; user-select: none; }
  .region.new { border-style: dashed; background: color-mix(in srgb, var(--accent) 15%, transparent); }
  .tagbar { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; margin-top: .3rem; }
  .tagbar select { font: inherit; background: var(--paper); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: .25rem; }
  .x { border: 0; background: none; color: var(--ink-3); padding: 0 .25rem; cursor: pointer; }
  .x:hover { color: var(--neg, red); }
  .addb { display: grid; place-content: center; gap: .2rem; border-style: dashed; color: var(--ink-3); text-align: center; padding: .4rem; }
  .addb > span:first-child { font-size: 1.6rem; }
  .addb:disabled { opacity: .6; cursor: not-allowed; }
  .nav .btn { min-width: 44px; min-height: 40px; }
</style>
