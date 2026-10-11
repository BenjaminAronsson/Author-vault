<script>
  // Reading companion: big type, one chapter at a time — for a tablet next to the book.
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import Markdown from '../components/Markdown.svelte';
  import { colorOf } from '../lib/relations.js';

  const ch = $derived(store.chapter);
  const cast = $derived((store.snap?.onStage ?? []).filter((id) => store.visible(id)));
  const changes = $derived((store.snap?.relChanges ?? []).filter((r) => store.visible(r.from) && store.visible(r.to)));
  const story = $derived(ch ? store.model.stories[ch.story] : null);
  const isDead = (id) => /dead/.test(store.snap?.status[id] ?? '');
  // genealogy: everything recorded on this date, with its source
  const facts = $derived(ch?.timeStep ? Object.values(store.model.entities).flatMap((e) => (e.timeline ?? []).filter((t) => t.step === ch.id && store.visible(e.id)).map((t) => ({ e, t }))) : []);
  // (the step's summary lists the same facts for Home and Timeline; here each gets its evidence chip)
</script>

<div class="reader">
  {#if ch}
    {#if ch.timeStep}
      <div class="where small muted">date {ch.num} of {story?.chapters.length}{#if ch.date && ch.date.qual !== 'exact'} · uncertain{/if}</div>
      <h1>{ch.title}</h1>
      {#each facts as { e, t } (e.id + t.text)}
        <p class="fact big"><EntityLink id={e.id} />: <Markdown text={t.text} />{#if t.evidence} <span class="chip">{t.evidence}</span>{/if}</p>
      {:else}<p class="muted">Nothing recorded on this date.</p>{/each}
    {:else}
    <div class="where small muted">{story?.title} · chapter {ch.num} of {story?.chapters.length}{#if ch.canon === 'expansion'} · <span class="exp-mark">EXP</span>{/if}</div>
    <h1>{ch.title}</h1>
    <div class="prose big"><Markdown text={ch.summary || '_No summary yet._'} /></div>
    {/if}

    <div class="label">{T.onStage}</div>
    <div class="cast">
      {#each cast as id (id)}
        <button class="who" onclick={() => store.open(id)}>
          <Avatar {id} size={64} />
          <span class="n">{store.name(id)}{isDead(id) ? ' †' : ''}</span>
          {#if store.snap?.presence[id]}<span class="small muted">{store.name(store.snap.presence[id].place)}</span>{/if}
        </button>
      {/each}
    </div>

    {#if changes.length}
      <div class="label">In this chapter, feelings changed</div>
      {#each changes as r (r.from + r.to)}
        <p class="chg"><EntityLink id={r.from} /> → <EntityLink id={r.to} />: <span class="sw" style:background={colorOf(r.n)}></span> <strong>{r.bond}</strong>{#if r.prev} <span class="muted">(was {r.prev.bond})</span>{/if}</p>
      {/each}
    {/if}
  {/if}
  <div class="pager">
    <button class="btn big" onclick={() => store.move(-1)} disabled={store.idx <= 0}>◀ Previous</button>
    <button class="btn big primary" onclick={() => store.move(1)} disabled={store.idx >= store.sequence.length - 1}>{ch?.timeStep ? 'Next date' : 'Next chapter'} ▶</button>
  </div>
</div>

<style>
  .reader { max-width: 760px; margin: 0 auto; padding: 1.5rem 1.2rem 3rem; display: grid; gap: .9rem; }
  h1 { font-size: 2.4rem; margin: 0; }
  .big { font-size: 1.25rem; line-height: 1.65; }
  .cast { display: flex; flex-wrap: wrap; gap: 1rem; }
  .who { background: none; border: 0; display: grid; justify-items: center; gap: .3rem; width: 96px; padding: .3rem; border-radius: 10px; }
  .who:hover { background: var(--paper-2); }
  .n { font-weight: 600; }
  .fact { margin: .2rem 0; display: flex; gap: .4rem; flex-wrap: wrap; align-items: baseline; }
  .fact :global(.prose p) { margin: 0; }
  .chg { margin: .2rem 0; font-size: 1.05rem; }
  .sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: middle; }
  .pager { display: flex; justify-content: space-between; margin-top: 1rem; }
  .btn.big { font-size: 1.05rem; padding: .7rem 1.2rem; }
</style>
