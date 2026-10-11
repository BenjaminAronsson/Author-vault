<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import Markdown from '../components/Markdown.svelte';
  import Actions from '../components/Actions.svelte';
  import TimelineList from '../components/TimelineList.svelte';
  import { sectionMarkdown, wikilinks } from '../parser/markdown.js';
  import Gallery from '../components/Gallery.svelte';

  let { id } = $props();
  const e = $derived(store.model.entities[id]);
  const imageTypes = new Set(['location', 'item', 'creature', 'faction', 'religion', 'culture', 'world', 'magic', 'technology', 'concept', 'language', 'event', 'era']);
  const res = (v) => wikilinks(v).map((n) => store.model.nameIndex[n.toLowerCase()]).filter(Boolean);
  const children = $derived(Object.values(store.model.entities).filter((x) => x.type === 'location' && res(x.fm.part_of).includes(id) && store.visible(x.id)));
  const here = $derived.by(() => {
    if (e.type !== 'location' || !store.snap) return [];
    const places = new Set([id, ...children.map((c) => c.id)]);
    return Object.entries(store.snap.presence).filter(([who, p]) => places.has(p.place) && store.visible(who) && !/dead/.test(store.snap.status[who] ?? '')).map(([who, p]) => ({ who, place: p.place }));
  });
  const memoriesOf = $derived(e.type === 'event' ? Object.values(store.model.entities).flatMap((c) => (c.memories ?? []).filter((m) => m.event === id).map((m) => ({ ...m, who: c.id }))) : []);
  const chapter = $derived(e.chapterId ? store.model.chapters[e.chapterId] : null);
  const backlinks = $derived(Object.values(store.model.entities).filter((x) => x.id !== id && x.links?.includes(id) && store.visible(x.id) && x.type !== 'voice').slice(0, 40));
  const fmRows = $derived(['kind', 'scale', 'span', 'when', 'in_world', 'status', 'potential', 'domain', 'hardness', 'sapience', 'rarity', 'maturity', 'availability', 'origin']
    .filter((k) => e.fm[k] !== undefined && e.fm[k] !== '' && e.fm[k] !== null).map((k) => [k, e.fm[k]]));
</script>

<article class="ent">
  <header class="card head" class:exp={e.canon === 'expansion'}>
    {#if imageTypes.has(e.type)}<div class="avcol"><Avatar {id} size={96} upload /></div>{/if}
    <div class="who">
      <div class="label">{e.type}{#if e.canon !== 'book'} · <span class="exp-mark">{e.canon.toUpperCase()}</span> {e.origin ?? ''}{/if}{#if e.continuity !== 'main'} · {e.continuity}{/if}</div>
      <h1>{e.title}</h1>
      {#if e.aliases.length}<div class="muted small">also: {e.aliases.join(', ')}</div>{/if}
      {#if fmRows.length}<div class="chips">{#each fmRows as [k, v] (k)}<span class="chip">{k}: {Array.isArray(v) ? v.join(', ') : v}</span>{/each}</div>{/if}
      <Actions {id} />
    </div>
  </header>

  {#if !store.visible(id)}
    <div class="card"><p class="muted">{T.notYet}</p><button class="btn" onclick={() => (store.future = 'dim')}>{T.showFuture.dim}</button></div>
  {:else}
    {#if chapter}
      <div class="card row">
        <span>Chapter {chapter.num} of <strong>{store.model.stories[chapter.story]?.title}</strong></span>
        {#if chapter.id in store.stepIndex}<button class="btn primary" onclick={() => store.setAt(chapter.id)}>Set bookmark here</button>{/if}
        <span class="small">{#each chapter.characters as c, i (c)}{#if i}{', '}{/if}<EntityLink id={c} />{/each}</span>
      </div>
    {/if}
    {#if e.type === 'location'}
      <div class="card">
        <div class="label">Here at {store.chapter?.id}</div>
        {#each here as h (h.who)}<div class="hererow"><Avatar id={h.who} size={30} /><EntityLink id={h.who} />{#if h.place !== id}<span class="small muted">in <EntityLink id={h.place} /></span>{/if}</div>
        {:else}<p class="muted small">Nobody known to be here right now.</p>{/each}
        {#if children.length}<div class="label mt">Contains</div><div class="chips">{#each children as c (c.id)}<span class="chip"><EntityLink id={c.id} /></span>{/each}</div>{/if}
      </div>
    {/if}
    {#if memoriesOf.length}
      <div class="card">
        <div class="label">Remembered by</div>
        {#each memoriesOf.filter((m) => store.stepVisible(m.when) && store.canonOk(m.canon)) as m (m.id)}
          <div class="hererow"><Avatar id={m.who} size={30} /><EntityLink id={m.who} /> <span class="chip">{m.accuracy}</span> <span class="small muted">{m.charge}</span></div>
        {/each}
      </div>
    {/if}
    {#if e.type === 'thread' || e.type === 'plot'}
      <div class="card small">Opened {e.openedAt ?? '—'} · {e.closedAt && store.stepVisible(e.closedAt) ? `closed ${e.closedAt}` : 'still open'}
        {#if e.cast?.length} · {#each e.cast as c, i (c)}{#if i}{', '}{/if}<EntityLink id={c} />{/each}{/if}</div>
    {/if}
    {#if e.type === 'media' || e.media?.length || e.gallery?.length || (store.source?.dir && ['location', 'event'].includes(e.type))}<section class="card"><h2>{e.type === 'media' ? 'Photo' : 'Photos'}</h2><Gallery id={e.id} add={['location', 'event'].includes(e.type)} /></section>{/if}
    {#if e.preamble}<div class="card"><Markdown text={e.preamble} /></div>{/if}
    {#each e.sectionOrder as h, hi (hi)}
      {#if h === 'Timeline'}
        <section class="card"><h2>{T.timeline}</h2><TimelineList entity={e} /></section>
      {:else if sectionMarkdown(e.sections[h]).replace(/[_\-|*:\s]/g, '').length > 3}
        <section class="card"><h2>{h}</h2><Markdown text={sectionMarkdown(e.sections[h])} /></section>
      {/if}
    {/each}
    {#if backlinks.length}
      <section class="card"><div class="label">Mentioned in</div><div class="chips">{#each backlinks as b (b.id)}<span class="chip"><EntityLink id={b.id} /></span>{/each}</div></section>
    {/if}
  {/if}
</article>

<style>
  .ent { padding: 1rem; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1rem; max-width: 1000px; margin: 0 auto; }
  .head { display: flex; gap: 1.2rem; align-items: flex-start; }
  .head.exp { background: var(--exp-tint); border-left: 4px solid var(--exp); }
  .avcol { display: grid; justify-items: center; flex: none; }
  .who { flex: 1; display: grid; gap: .4rem; }
  .who h1 { margin: 0; }
  .chips { display: flex; gap: .3rem; flex-wrap: wrap; }
  .row { display: flex; gap: .8rem; align-items: center; flex-wrap: wrap; }
  .hererow { display: flex; gap: .5rem; align-items: center; padding: .25rem 0; }
  .mt { margin-top: .8rem; }
</style>
