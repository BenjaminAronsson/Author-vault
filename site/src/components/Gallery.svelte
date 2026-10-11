<script>
  // Photos of a person, place or event: tagged Media notes (`depicts`, `place`, `event`) and the note's own
  // `gallery`. Thumbnails load lazily; the large version loads only in the lightbox. Photos that show a hidden
  // living person stay hidden too.
  import { store } from '../lib/store.svelte.js';
  import EntityLink from './EntityLink.svelte';

  let { id, strip = false, max = strip ? 6 : 60 } = $props();
  const e = $derived(store.model?.entities[id]);
  const url = (p) => store.model?.imageUrls?.[p] ?? null;
  const full = (p) => store.model?.imageFullUrls?.[p] ?? url(p);
  const hidden = (m) => m.depicts.some((d) => store.model.entities[d]?.living && !store.showLiving);
  const items = $derived.by(() => {
    if (!e) return [];
    const own = e.type === 'media' ? [e] : [];
    const tagged = (e.media ?? []).map((m) => store.model.entities[m]).filter((m) => m && !hidden(m) && store.canonOk(m.canon));
    const extra = (e.gallery ?? []).map((p) => ({ id: p, image: p, depicts: [id], caption: '', mediaDate: null }));
    return [...own, ...tagged, ...extra].filter((m) => url(m.image)).slice(0, max);
  });
  let open = $state(null);
  let dlg = $state(null);
  $effect(() => { if (!dlg) return; if (open && !dlg.open) dlg.showModal(); else if (!open && dlg.open) dlg.close(); });
  const step = (d) => { const i = items.indexOf(open); open = items[(i + d + items.length) % items.length]; };
</script>

{#if items.length}
  <div class="gal" class:strip>
    {#each items as m (m.id)}
      <button class="th" onclick={() => (open = m)} title={m.caption || m.title || ''}>
        <img src={url(m.image)} alt={m.caption || m.title || ''} loading="lazy" decoding="async" />
        {#if !strip && (m.mediaDate || m.caption)}<span class="cap small">{m.mediaDate ?? ''}{m.mediaDate && m.caption ? ' · ' : ''}{m.caption}</span>{/if}
      </button>
    {/each}
  </div>
{/if}

<dialog bind:this={dlg} onclose={() => (open = null)} onclick={(ev) => { if (ev.target === dlg) open = null; }}
  onkeydown={(ev) => { if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1); }}>
  {#if open}
    <figure>
      <div class="pic">
        <img src={full(open.image)} alt={open.caption || open.title || ''} />
        {#each open.regions ?? [] as r (r.who)}
          <span class="region" style:left={`${r.x * 100}%`} style:top={`${r.y * 100}%`} style:width={`${r.w * 100}%`} style:height={`${r.h * 100}%`}><span>{store.name(r.who)}</span></span>
        {/each}
      </div>
      <figcaption>
        {#if open.caption}<p>{open.caption}</p>{/if}
        <p class="small muted">
          {#if open.mediaDate}{open.mediaDate}{/if}
          {#if open.mediaPlace} · <EntityLink id={open.mediaPlace} />{/if}
          {#if open.mediaEvent} · <EntityLink id={open.mediaEvent} />{/if}
        </p>
        {#if open.depicts.length}<p class="small">In the picture: {#each open.depicts as d, i (d)}{#if i}{', '}{/if}<EntityLink id={d} />{/each}</p>{/if}
        {#if open.type === 'media' && open.id !== id}<p class="small"><EntityLink id={open.id} label="Open photo note" /></p>{/if}
      </figcaption>
    </figure>
    <div class="nav">
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
  .nav { display: flex; gap: .4rem; justify-content: flex-end; }
  .nav .btn { min-width: 44px; min-height: 40px; }
</style>
