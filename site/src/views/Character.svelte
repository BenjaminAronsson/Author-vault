<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import Avatar from '../components/Avatar.svelte';
  import EntityLink from '../components/EntityLink.svelte';
  import Markdown from '../components/Markdown.svelte';
  import Actions from '../components/Actions.svelte';
  import Web from '../components/Web.svelte';
  import TimelineList from '../components/TimelineList.svelte';
  import FamilyTree from '../components/FamilyTree.svelte';
  import { lifespan } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';
  import { relationsAt, colorOf, describe } from '../lib/relations.js';
  import { sectionMarkdown, wikilinks } from '../parser/markdown.js';

  let { id } = $props();
  const e = $derived(store.model.entities[id]);
  const S = $derived(e.sections);
  const ok = (cid) => store.stepVisible(cid);
  const fut = (cid) => store.stepIsFuture(cid);
  const status = $derived(store.snap?.status[id] ?? (store.intro[id] <= store.idx ? 'alive' : '—'));
  const place = $derived(store.snap?.presence[id]?.place ?? null);
  const links = (v) => wikilinks(v).map((n) => store.model.nameIndex[n.toLowerCase()]).filter(Boolean);
  const chips = $derived([...links(e.fm.culture), ...links(e.fm.religion), ...links(e.fm.magic), ...links(e.fm.factions), ...links(e.fm.languages)]);
  const signature = $derived.by(() => {
    const q = /"(.+?)"[^\n]*?(\[\[[^\]]+\]\])?/.exec(e.preamble);
    return q ? { text: q[1], source: q[2] ? q[2].slice(2, -2) : null } : null;
  });

  // Goals with their history from goal: tags
  const goalHist = $derived.by(() => (e.goals ?? []).map((g) => {
    const changes = e.timeline.filter((t) => t.step && t.tags.goal.some((x) => x.goal.toLowerCase() === g.goal.toLowerCase()))
      .map((t) => ({ step: t.step, status: t.tags.goal.find((x) => x.goal.toLowerCase() === g.goal.toLowerCase()).status }));
    const visibleChanges = changes.filter((c) => !fut(c.step));
    const now = store.snap?.goals[id]?.[g.goal] ?? (visibleChanges.at(-1)?.status) ?? (fut(g.since) ? null : g.status || 'active');
    return { ...g, changes, now };
  }).filter((g) => g.goal && (!g.since || ok(g.since))));
  const fears = $derived((e.fears ?? []).filter((f) => ok(f.source)));
  const dreams = $derived((e.dreams ?? []).filter((d) => ok(d.source)));
  const rel = $derived((store.version, relationsAt(store)));
  const mine = $derived(Object.values(rel.directed).filter((r) => r.from === id).sort((a, b) => b.n - a.n));
  const theirs = $derived(Object.values(rel.directed).filter((r) => r.to === id));
  const voiceMoods = $derived((e.voice?.moods ?? []).map((m) => ({ ...m, quotes: m.quotes.filter((q) => ok(q.source)) })).filter((m) => m.quotes.length));
  let mood = $state(null);
  const curMood = $derived(voiceMoods.find((m) => m.mood === mood) ?? voiceMoods[0]);
  const nowQuote = $derived(voiceMoods.flatMap((m) => m.quotes.map((q) => ({ ...q, mood: m.mood }))).filter((q) => !fut(q.source)).sort((a, b) => (store.stepIndex[b.source] ?? -1) - (store.stepIndex[a.source] ?? -1))[0]);
  const memories = $derived((e.memories ?? []).filter((m) => store.canonOk(m.canon) && ok(m.when)));
  let revealed = $state({});
  const eventTruth = (evId) => (evId ? (store.model.entities[evId]?.sections['What happened (objective)']?.text ?? '').trim() : '');
  const knows = $derived((e.knowledge ?? []).filter((k) => ok(k.source)));
  const seenBy = $derived((e.perspectives ?? []).filter((p) => p.by && store.visible(p.by)));
  const arc = $derived(S.Arc ? sectionMarkdown(S.Arc) : '');
  const handled = new Set(['Goals', 'Fears', 'Dreams', 'Relations', 'Timeline', 'Knowledge', 'Perspectives', 'Memories', 'Voice', 'Arc']);
  const rest = $derived(e.sectionOrder.filter((h) => !handled.has(h) && sectionMarkdown(S[h]).replace(/[_\-|*:\s]/g, '').length > 20));
  const marks = { achieved: '✓', abandoned: '✕', betrayed: '⚡', active: '●' };
  const accColor = { faithful: 'var(--pos)', partial: 'var(--neu)', distorted: 'var(--neg)', false: 'var(--neg)', unknown: 'var(--neu)' };
  const gen = $derived(!!store.model.genealogy);
  const age = $derived.by(() => { const b = parseDate(e.born), n = store.chapter?.date; if (!b || !n || n.sort < b.sort) return null; const d = parseDate(e.died); const end = d && d.sort <= n.sort ? d : n; return Math.floor((end.sort - b.sort) / 10000); });
  const hasInner = $derived(goalHist.length || fears.length || dreams.length);
  const seqUpTo = $derived(store.sequence.slice(0, store.idx + 1));
  const gx = (cid) => (Math.max(0, seqUpTo.indexOf(cid)) / Math.max(1, seqUpTo.length - 1)) * 100;
</script>

<article class="char">
  <header class="card head" class:exp={e.canon === 'expansion'}>
    <div class="avcol"><Avatar {id} size={128} upload /></div>
    <div class="who">
      <div class="label">Character{#if e.canon === 'expansion'} · <span class="exp-mark">EXP</span> {e.origin ?? ''}{/if}</div>
      <h1>{e.title}{#if /dead/.test(status)} <span class="muted">†</span>{/if}</h1>
      {#if gen && lifespan(e)}<div class="life">{lifespan(e)}{#if e.living} <span class="chip">living · private</span>{/if}</div>{/if}
      {#if e.aliases.length}<div class="muted small">also: {e.aliases.join(', ')}</div>{/if}
      <div class="chips">{#each chips as c (c)}<span class="chip"><EntityLink id={c} /></span>{/each}</div>
      {#if signature && ok(signature.source)}<p class="quote sig">“{signature.text}”</p>{/if}
      <Actions {id} />
    </div>
  </header>

  {#if !store.visible(id)}
    <div class="card"><p class="muted">{T.notYet}</p></div>
  {:else}
  <section class="card now">
    <div class="label">{T.now} · {store.chapter?.id}</div>
    <div class="nowgrid">
      <div><div class="k">Where</div>{#if place}<EntityLink id={place} />{:else}<span class="muted">{T.unknown}</span>{/if}</div>
      <div><div class="k">Status</div>{status}</div>
      {#if gen}
      <div><div class="k">Age</div>{#if age !== null}{age}{#if parseDate(e.born)?.qual !== 'exact' || parseDate(e.born)?.precision !== 'day'} <span class="small muted">(about)</span>{/if}{:else}<span class="muted">—</span>{/if}</div>
      <div><div class="k">Born</div>{e.born ?? '—'}</div>
      <div><div class="k">Died</div>{e.died && store.chapter?.date && parseDate(e.died)?.sort <= store.chapter.date.sort ? e.died : '—'}</div>
      {:else}
      <div><div class="k">Wants</div>{#each goalHist.filter((g) => g.now === 'active') as g (g.goal)}<div>{g.goal}</div>{:else}<span class="muted">—</span>{/each}</div>
      <div><div class="k">Afraid of</div>{#each fears.slice(0, 2) as f (f.fear)}<div>{f.fear}</div>{:else}<span class="muted">—</span>{/each}</div>
      <div><div class="k">Warmest</div>{#if mine[0] && mine[0].n > 0}<EntityLink id={mine[0].to} /> <span class="small muted">{mine[0].bond}</span>{:else}<span class="muted">—</span>{/if}</div>
      <div><div class="k">Coldest</div>{#if mine.at(-1) && mine.at(-1).n < 0}<EntityLink id={mine.at(-1).to} /> <span class="small muted">{mine.at(-1).bond}</span>{:else}<span class="muted">—</span>{/if}</div>
      {/if}
    </div>
    {#if nowQuote}<p class="quote">“{nowQuote.text}” <span class="small muted">— {nowQuote.mood.toLowerCase()}, {nowQuote.source}</span></p>{/if}
  </section>

  {#if gen || e.kin}
    <section class="card">
      <h2>Family <button class="btn ghost small" onclick={() => store.go('family', id)}>Open family tree →</button></h2>
      <FamilyTree focus={id} up={1} down={1} compact />
    </section>
  {/if}

  {#if !gen || hasInner}
  <div class="cols">
    <section class="card">
      <h2>{T.goals}</h2>
      {#each goalHist as g (g.goal)}
        <div class="goal">
          <div class="gl"><span class="gm" data-s={g.now}>{marks[g.now] ?? '●'}</span> {g.goal} <span class="small muted">{g.horizon} · {g.now ?? '—'}</span></div>
          <div class="track" aria-hidden="true">
            {#if g.since && seqUpTo.includes(g.since)}
              {@const end = g.changes.filter((c) => c.status !== 'active' && seqUpTo.includes(c.step)).at(-1)}
              <span class="span" data-s={g.now} style:left={`${gx(g.since)}%`} style:width={`${(end ? gx(end.step) : 100) - gx(g.since)}%`}></span>
            {/if}
          </div>
        </div>
      {:else}<p class="muted small">No goals recorded yet.</p>{/each}
    </section>
    <section class="card">
      <h2>{T.fears}</h2>
      {#each fears as f (f.fear)}<div class="item"><strong>{f.fear}</strong>{#if f.root}<div class="small muted">root: {f.root}</div>{/if}{#if f.shows}<div class="small">shows: {f.shows}</div>{/if}</div>
      {:else}<p class="muted small">None recorded yet.</p>{/each}
      <h2 class="mt">{T.dreams}</h2>
      {#each dreams as d (d.text)}<div class="item"><Markdown text={d.text} /></div>{:else}<p class="muted small">None recorded yet.</p>{/each}
    </section>
  </div>
  {/if}

  {#if voiceMoods.length || e.voice?.expansion?.length}
    <section class="card">
      <h2>{T.voice}</h2>
      <div class="tabs" role="tablist">
        {#each voiceMoods as m (m.mood)}<button role="tab" class="btn" class:on={curMood?.mood === m.mood} aria-selected={curMood?.mood === m.mood} onclick={() => (mood = m.mood)}>{m.mood} <span class="muted">{m.quotes.length}</span></button>{/each}
      </div>
      {#each curMood?.quotes ?? [] as q (q.text)}
        <blockquote class="quote" class:future={fut(q.source)}>“{q.text}” <span class="small muted">— {q.source ?? ''}</span></blockquote>
      {/each}
      {#if store.canonOk('expansion') && e.voice?.expansion?.length}
        <div class="label mt">Expansion lines</div>
        {#each e.voice.expansion.filter((q) => ok(q.source)) as q (q.text)}<blockquote class="quote expq">“{q.text}” <span class="exp-mark">EXP</span></blockquote>{/each}
      {/if}
      {#if e.voice?.diction?.length}<div class="small muted mt">{#each e.voice.diction as d (d)}<div><Markdown text={d} /></div>{/each}</div>{/if}
    </section>
  {/if}

  {#if memories.length}
    <section class="card">
      <h2>{T.memories}</h2>
      {#each memories as m (m.id)}
        <div class="mem" class:exp={m.canon === 'expansion'}>
          <div class="memh">
            <EntityLink id={m.event ?? m.id} label={m.event ? store.name(m.event) : m.title} />
            <span class="chip" style:border-color={accColor[m.accuracy]} style:color={accColor[m.accuracy]}>{m.accuracy}</span>
            {#if m.charge}<span class="chip">{m.charge}</span>{/if}
            <span class="small muted">{m.when}</span>
          </div>
          <div class="memgrid">
            <div><div class="label">As {e.title} remembers it</div><Markdown text={m.text} /></div>
            <div>
              <div class="label">{T.truth}</div>
              {#if revealed[m.id]}
                <Markdown text={eventTruth(m.event) || '_No objective account recorded._'} />
                {#if m.divergence}<div class="div"><div class="label">Where memory and truth part</div><Markdown text={m.divergence} /></div>{/if}
              {:else}
                <button class="btn" onclick={() => (revealed = { ...revealed, [m.id]: true })}>{T.reveal}</button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </section>
  {/if}

  <div class="cols">
    <section class="card">
      <h2>{T.relations}</h2>
      <Web focus={id} hops={1} height={300} />
      {#each mine as r (r.to)}
        <div class="rel small"><span class="sw" style:background={colorOf(r.n)}></span> feels <strong>{r.bond || r.feels}</strong> toward <EntityLink id={r.to} />
          {#if rel.directed[`${r.to}>${id}`]}{@const b = rel.directed[`${r.to}>${id}`]}<span class="muted"> · gets back {b.bond || b.feels} ({b.n > 0 ? '+' : ''}{b.n})</span>{/if}
          <span class="muted" title={describe(store, r)}> ⓘ</span></div>
      {/each}
    </section>
    <section class="card">
      <h2>{T.asSeenBy}</h2>
      {#each seenBy as p (p.heading)}
        <div class="seen"><Avatar id={p.by} size={28} /><div><EntityLink id={p.by} /><Markdown text={p.text} /></div></div>
      {/each}
      {#each theirs.filter((r) => !seenBy.some((p) => p.by === r.from)) as r (r.from)}
        <div class="seen"><Avatar id={r.from} size={28} /><div><EntityLink id={r.from} /> <span class="small">feels {r.bond || r.feels} <span class="sw" style:background={colorOf(r.n)}></span></span></div></div>
      {/each}
      {#if !seenBy.length && !theirs.length}<p class="muted small">Nobody's view recorded yet.</p>{/if}
      <h2 class="mt">{T.knowsNow}</h2>
      {#each knows as k (k.text)}<div class="small"><Markdown text={'- ' + k.text} /></div>{:else}<p class="muted small">No knowledge recorded yet.</p>{/each}
      <p class="small muted">This is what <code>/become</code> loads at {store.chapter?.id}.</p>
    </section>
  </div>

  {#if arc}<section class="card"><h2>Arc</h2><Markdown text={arc} /></section>{/if}
  <section class="card"><h2>{T.timeline}</h2><TimelineList entity={e} /></section>
  {#each rest as h (h)}<details class="card"><summary><strong>{h}</strong></summary><Markdown text={sectionMarkdown(S[h])} /></details>{/each}
  {/if}
</article>

<style>
  .char { padding: 1rem; display: grid; gap: 1rem; max-width: 1100px; margin: 0 auto; }
  .head { display: flex; gap: 1.4rem; align-items: flex-start; }
  .head.exp { background: var(--exp-tint); border-left: 4px solid var(--exp); }
  .avcol { display: grid; justify-items: center; flex: none; }
  .who { flex: 1; display: grid; gap: .4rem; }
  .who h1 { margin: 0; }
  .chips { display: flex; gap: .3rem; flex-wrap: wrap; }
  .life { font: 600 1rem var(--sans); color: var(--ink-2); font-variant-numeric: tabular-nums; }
  .sig { font-size: 1.2rem; margin: .2rem 0; }
  .nowgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: .8rem; }
  .k { font: 600 .7rem var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
  .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .goal { margin: .5rem 0; }
  .gm { display: inline-block; width: 1.1em; text-align: center; }
  .gm[data-s='achieved'] { color: var(--pos); } .gm[data-s='abandoned'] { color: var(--neu); } .gm[data-s='betrayed'] { color: var(--neg); } .gm[data-s='active'] { color: var(--accent); }
  .track { position: relative; height: 6px; background: var(--paper-2); border-radius: 3px; margin-top: .3rem; }
  .span { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: var(--accent); opacity: .75; min-width: 4px; }
  .span[data-s='betrayed'] { background: var(--neg); } .span[data-s='achieved'] { background: var(--pos); } .span[data-s='abandoned'] { background: var(--neu); }
  .item { margin: .4rem 0; }
  .mt { margin-top: 1rem; }
  .tabs { display: flex; gap: .3rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .tabs .on { background: var(--ink); color: var(--paper); }
  blockquote.quote { margin: .4rem 0; padding-left: .8rem; border-left: 3px solid var(--accent); }
  blockquote.expq { border-color: var(--exp); background: var(--exp-tint); padding: .3rem .8rem; border-radius: 0 6px 6px 0; }
  .mem { border-top: 1px solid var(--rule); padding: .8rem 0; }
  .mem.exp { background: var(--exp-tint); border-left: 4px solid var(--exp); padding-left: .8rem; }
  .memh { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; margin-bottom: .4rem; }
  .memgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .div { margin-top: .5rem; padding: .5rem .7rem; background: color-mix(in srgb, var(--neg) 10%, transparent); border-left: 3px solid var(--neg); border-radius: 4px; }
  .rel { padding: .2rem 0; }
  .sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; vertical-align: middle; }
  .seen { display: flex; gap: .6rem; align-items: flex-start; margin: .4rem 0; }
  details summary { cursor: pointer; }
  @media (max-width: 800px) { .cols, .memgrid { grid-template-columns: 1fr; } .head { flex-direction: column; } }
</style>
