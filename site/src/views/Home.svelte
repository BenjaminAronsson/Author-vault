<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import Markdown from '../components/Markdown.svelte';
  import Web from '../components/Web.svelte';
  import { colorOf } from '../lib/relations.js';

  const recap = $derived(store.sequence.slice(Math.max(0, store.idx - 2), store.idx + 1).map((c) => store.model.chapters[c]));
  const onStage = $derived((store.snap?.onStage ?? []).filter((id) => store.visible(id)));
  const mentioned = $derived((store.snap?.mentioned ?? []).filter((id) => store.visible(id)));
  const changes = $derived.by(() => {
    const out = [];
    for (let i = store.idx; i >= Math.max(0, store.idx - 2); i--) for (const r of store.snaps[i]?.relChanges ?? []) if (store.visible(r.from) && store.visible(r.to)) out.push({ ...r, at: store.sequence[i] });
    return out.slice(0, 8);
  });
  const threads = $derived(Object.values(store.model.entities)
    .filter((e) => (e.type === 'thread' || e.type === 'plot') && store.canonOk(e.canon) && store.stepVisible(e.openedAt) && !(e.closedAt && store.stepIndex[e.closedAt] <= store.idx))
    .sort((a, b) => (b.fm.potential ?? 0) - (a.fm.potential ?? 0)));
  const pov = $derived((store.follow && store.visible(store.follow) ? store.follow : null) ?? store.chapter?.pov ?? onStage[0] ?? null);
  const povQuote = $derived.by(() => {
    const v = store.model.entities[pov]?.voice;
    const qs = (v?.moods ?? []).flatMap((m) => m.quotes).filter((q) => store.stepVisible(q.source) && !store.stepIsFuture(q.source));
    return qs.at(-1) ?? null;
  });
  const place = (id) => store.snap?.presence[id]?.place;
</script>

<div class="home">
  <section class="main">
    <div class="card recap">
      <div class="label">{T.storySoFar} · {T.through} {store.chapter?.id}</div>
      <h1>{store.chapter?.title}</h1>
      {#each recap as c, i (c.id)}
        <article class:current={i === recap.length - 1} class:exp={c.canon === 'expansion'}>
          <h3><button class="link" onclick={() => store.open(c.entity)}>{c.id === c.title ? c.id : `${c.id} — ${c.title}`}</button>
            {#if c.canon === 'expansion'}<span class="exp-mark">EXP</span>{/if}
            {#if c.pov}<span class="chip">POV {store.name(c.pov)}</span>{/if}</h3>
          <Markdown text={c.summary || '_No summary yet._'} />
        </article>
      {/each}
      <p class="small muted hint">{T.bookmarkHint}</p>
    </div>
    <div class="card">
      <div class="label">Around {pov ? store.name(pov) : 'the cast'}{store.follow === pov && pov ? ' · following' : ''}</div>
      {#if pov}<Web focus={pov} hops={2} height={340} />{:else}<p class="muted">No point-of-view character in this chapter.</p>{/if}
      {#if povQuote}<p class="quote">“{povQuote.text}” <span class="small muted">— {store.name(pov)}</span></p>{/if}
    </div>
  </section>

  <aside class="side">
    {#if store.books.length > 1}
      <div class="card">
        <div class="label">Books</div>
        {#each store.books as b (b.story + b.start)}
          {@const n = b.end - b.start + 1}
          {@const read = Math.max(0, Math.min(n, store.idx - b.start + 1))}
          <button class="brow" class:cur={b === store.book} onclick={() => store.setAt(store.sequence[read && read < n ? b.start + read - 1 : b.start])} title={read === n ? 'Read' : read ? `Jump to where you are in ${b.title}` : `Start ${b.title}`}>
            <span class="bname">{b.branch ? '⑂ ' : ''}{b.title}</span>
            <span class="bmeter"><span style:width={`${(read / n) * 100}%`}></span></span>
            <span class="small muted">{read === n ? '✓' : `${read}/${n}`}</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="card">
      <div class="label">{T.onStage}</div>
      {#each onStage as id (id)}
        <div class="who">
          <Avatar {id} size={36} />
          <div><EntityLink {id} />{#if /dead/.test(store.snap?.status[id] ?? '')}<span class="muted"> †</span>{/if}
            <div class="small muted" title={store.snap?.presence[id]?.src === 'chapter' ? "From the chapter's places (no at: tag)" : undefined}>{#if place(id)}@ <EntityLink id={place(id)} />{/if}</div>
          </div>
        </div>
      {:else}<p class="muted small">Nobody on stage.</p>{/each}
      {#if mentioned.length}
        <div class="label mt">{T.mentioned}</div>
        <div class="small mentioned" title="Named or talked about in this step, but not there">{#each mentioned as id, i (id)}{#if i}{', '}{/if}<EntityLink {id} />{/each}</div>
      {/if}
    </div>
    <div class="card">
      <div class="label">{T.relChanged}</div>
      {#each changes as r, ri (ri)}
        <div class="chg small">
          <EntityLink id={r.from} /> → <EntityLink id={r.to} />
          <span class="sw" style:background={colorOf(r.n)}></span> {r.bond} {r.n > 0 ? '+' : ''}{r.n}
          {#if r.prev}<span class="muted">(was {r.prev.bond} {r.prev.n})</span>{/if}
          <span class="muted nw">· {r.at}</span>
        </div>
      {:else}<p class="muted small">No relation changes in the last chapters.</p>{/each}
    </div>
    <div class="card">
      <div class="label">{T.openThreads}</div>
      {#each threads as t (t.id)}
        <div class="thr">
          <EntityLink id={t.id} /> <span class="chip">{t.type}</span>
          {#if t.fm.potential}<span class="stars" title="Potential {t.fm.potential}/5">{'★'.repeat(t.fm.potential)}</span>{/if}
          <div class="small muted">opened {t.openedAt ?? '—'}{t.fm.kind ? ` · ${t.fm.kind}` : ''}</div>
        </div>
      {:else}<p class="muted small">{T.noThreads}</p>{/each}
    </div>
  </aside>
</div>

<style>
  .home { display: grid; grid-template-columns: minmax(0, 1fr) 20rem; gap: 1rem; padding: 1rem; max-width: 1300px; margin: 0 auto; }
  .main, .side { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 1rem; align-content: start; }
  .recap h1 { margin-bottom: .6rem; }
  article { padding: .5rem 0 .5rem .8rem; border-left: 3px solid var(--rule); margin: .4rem 0; opacity: .75; }
  article.current { border-color: var(--accent); opacity: 1; }
  article.exp { background: var(--exp-tint); border-color: var(--exp); }
  article h3 { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; font-size: 1rem; }
  .hint { margin-top: .8rem; }
  .who { display: flex; gap: .6rem; align-items: center; padding: .3rem 0; }
  .chg { padding: .25rem 0; border-bottom: 1px solid var(--rule); }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; margin: 0 .2rem; }
  .thr { padding: .3rem 0; }
  .brow { display: grid; grid-template-columns: 1fr 70px 2.6rem; gap: .5rem; align-items: center; width: 100%; background: none; border: 0; padding: .3rem .2rem; border-radius: 6px; text-align: left; }
  .brow:hover { background: var(--paper-2); }
  .brow.cur .bname { font-weight: 700; color: var(--accent); }
  .bname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--serif); }
  .bmeter { height: 5px; background: var(--paper-2); border-radius: 3px; overflow: hidden; }
  .bmeter span { display: block; height: 100%; background: var(--accent); }
  .nw { white-space: nowrap; }
  .stars { color: var(--accent); font-size: .75rem; letter-spacing: 1px; }
  @media (max-width: 900px) { .home { grid-template-columns: minmax(0, 1fr); } }
</style>
