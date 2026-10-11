<script>
  // Right-click on anyone (or anything) with data-entity: a small card about them at this point in time,
  // without leaving the view. Esc, a click outside or scrolling closes it.
  import { store } from '../lib/store.svelte.js';
  import Avatar from './Avatar.svelte';
  import EntityLink from './EntityLink.svelte';
  import Markdown from './Markdown.svelte';
  import { kinIndex, lifespan, lifeLine, ageAt, ageLabel } from '../lib/kin.js';
  import { parseDate } from '../lib/dates.js';
  import { relationsAt } from '../lib/relations.js';
  import { stepArg, copy } from '../lib/obsidian.js';

  const c = $derived(store.card);
  const e = $derived(c ? store.model?.entities[c.id] : null);
  const person = $derived(e?.type === 'character');
  const gen = $derived(!!store.model?.genealogy);
  const known = $derived(e ? store.visible(e.id) : false);
  // aliases that only repeat the name without its "(1815)" aren't worth showing
  const aliases = $derived(e ? e.aliases.filter((a) => a.toLowerCase() !== e.title.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()) : []);
  const strip = (t) => String(t ?? '').replace(/\s*\(\[\[[^\]]+\]\]\)\s*$/, '');

  const now = $derived(store.chapter?.date ?? null);
  const died = $derived.by(() => { if (!e) return null; const d = parseDate(e.died); return d && now && d.sort <= now.sort ? e.died : /dead/.test(store.snap?.status[e.id] ?? '') ? '†' : null; });
  const life = $derived(e ? ageAt(e, now) : null);
  const place = $derived(e && !died && !(life?.deathUnknown) ? store.snap?.presence[e.id]?.place ?? null : null);
  const kidx = $derived(gen && person ? kinIndex(store.model) : null);
  const fam = (k) => [...(kidx?.[k].get(e.id) ?? [])].filter((x) => store.visible(x));
  const rel = $derived(person && !gen ? relationsAt(store) : null);
  const bonds = $derived(rel ? Object.values(rel.directed).filter((r) => r.from === e.id).sort((a, b) => b.n - a.n) : []);
  const last = $derived(e ? (e.timeline ?? []).filter((t) => t.step && store.stepVisible(t.step) && !store.stepIsFuture(t.step)).sort((a, b) => (store.stepIndex[a.step] ?? -1) - (store.stepIndex[b.step] ?? -1)).at(-1) : null);
  const blurb = $derived.by(() => {
    if (!e || person) return '';
    const sec = Object.values(e.sections ?? {}).map((s) => s.text).find((t) => t && t.replace(/[_\-|*:\s]/g, '').length > 30) ?? e.preamble;
    return String(sec ?? '').split('\n').filter((l) => l.trim() && !/^\s*_.*_\s*$/.test(l)).slice(0, 3).join('\n');
  });
  const sig = $derived.by(() => { const q = /"(.+?)"/.exec(e?.preamble ?? ''); return q?.[1] ?? null; });

  let el = $state(null);
  let pos = $state({ x: 0, y: 0 });
  $effect(() => {
    if (!c || !el) return;
    // keep the card on screen
    const r = el.getBoundingClientRect();
    pos = { x: Math.min(c.x + 4, innerWidth - r.width - 8), y: Math.min(c.y + 4, innerHeight - r.height - 8) };
  });
  $effect(() => {
    if (!c) return;
    const close = (ev) => { if (ev.type === 'keydown' && ev.key !== 'Escape') return; if (ev.type === 'pointerdown' && el?.contains(ev.target)) return; store.card = null; };
    const t = setTimeout(() => { addEventListener('pointerdown', close, true); addEventListener('keydown', close); addEventListener('wheel', close, { passive: true }); addEventListener('resize', close); });
    return () => { clearTimeout(t); removeEventListener('pointerdown', close, true); removeEventListener('keydown', close); removeEventListener('wheel', close); removeEventListener('resize', close); };
  });
  let copied = $state(false);
  async function become() {
    await copy(`/become ${e.title} at ${stepArg(store.sequence[store.idx])}${store.cont !== 'main' ? ' ' + store.cont : ''} ${store.model.world}`);
    copied = true; setTimeout(() => (copied = false), 1200);
  }
  const go = (fn) => { fn(); store.card = null; };
</script>

{#if c && e}
  <div class="card ic" bind:this={el} role="dialog" aria-label={`About ${e.title}`} style:left={`${pos.x}px`} style:top={`${pos.y}px`}>
    <div class="hd">
      <Avatar id={e.id} size={56} />
      <div class="who">
        <div class="label">{person ? (gen ? 'Person' : 'Character') : e.type}{#if e.canon === 'expansion'} · <span class="exp-mark">EXP</span>{/if}</div>
        <div class="nm">{e.title}{#if died} <span class="muted">†</span>{/if}</div>
        {#if gen && person && lifespan(e)}<div class="small muted">{lifeLine(e)}{#if e.living} · living{/if}</div>{/if}
        {#if aliases.length}<div class="small muted">also {aliases.slice(0, 3).join(', ')}</div>{/if}
      </div>
    </div>

    {#if !known}
      <p class="small muted">Not known yet at {store.chapter?.id}.</p>
    {:else}
      <dl>
        {#if person}
          <dt>At {store.chapter?.id}</dt>
          <dd>{#if died}died {died !== '†' ? died : ''}{#if life?.age !== null}, {ageLabel({ ...life, atDeath: false })} years old{/if}{:else if life?.deathUnknown}<span class="muted">death not recorded</span>{:else if life?.age !== null}{ageLabel(life)} years{#if place}{' · '}<EntityLink id={place} />{/if}{:else if place}<EntityLink id={place} />{:else}<span class="muted">—</span>{/if}</dd>
          {#if gen}
            {#each [['parents', 'Parents'], ['spouses', 'Married to'], ['children', 'Children'], ['siblings', 'Siblings']] as [k, h] (k)}
              {#if fam(k).length}<dt>{h}</dt><dd>{#each fam(k) as x, i (x)}{#if i}{', '}{/if}<EntityLink id={x} label={store.name(x).replace(/\s*\([^)]*\)\s*$/, '')} />{/each}</dd>{/if}
            {/each}
          {:else}
            {#if bonds[0]?.n > 0}<dt>Warmest</dt><dd><EntityLink id={bonds[0].to} /> <span class="muted small">{bonds[0].bond}</span></dd>{/if}
            {#if bonds.at(-1)?.n < 0}<dt>Coldest</dt><dd><EntityLink id={bonds.at(-1).to} /> <span class="muted small">{bonds.at(-1).bond}</span></dd>{/if}
            {#if (e.goals ?? []).find((g) => g.goal && store.snap?.goals[e.id]?.[g.goal] !== 'achieved')}<dt>Wants</dt><dd>{(e.goals ?? []).find((g) => g.goal).goal}</dd>{/if}
          {/if}
        {/if}
        {#if last}<dt>Latest</dt><dd class="lt"><span class="muted small">{last.marker}</span> <Markdown text={strip(last.text)} /></dd>{/if}
      </dl>
      {#if sig && !gen}<p class="quote small">“{sig}”</p>{/if}
      {#if blurb}<div class="small blurb"><Markdown text={blurb} /></div>{/if}
    {/if}

    <div class="acts">
      <button class="btn primary" onclick={() => go(() => store.open(e.id))}>Open</button>
      {#if person && gen}<button class="btn" onclick={() => go(() => store.go('family', e.id))}>Family tree</button>{/if}
      {#if person}
        <button class="btn" class:on={store.follow === e.id} onclick={() => go(() => store.setFollow(store.follow === e.id ? null : e.id))}>👁 {store.follow === e.id ? 'Following' : 'Follow'}</button>
        <button class="btn" onclick={become} title="Copy the /become command">🎭 {copied ? 'Copied' : '/become'}</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .ic { position: fixed; z-index: 60; width: 320px; max-width: calc(100vw - 16px); padding: .8rem .9rem; box-shadow: 0 12px 32px rgba(0, 0, 0, .22); display: grid; gap: .5rem; animation: pop .12s ease-out; }
  @keyframes pop { from { opacity: 0; transform: scale(.97); } }
  .hd { display: flex; gap: .7rem; align-items: center; }
  .who { min-width: 0; }
  .nm { font: 600 1.1rem var(--serif); line-height: 1.2; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .25rem .7rem; margin: 0; font-size: .86rem; }
  dt { font: 600 .66rem var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); padding-top: .2rem; }
  dd { margin: 0; min-width: 0; }
  .lt :global(.prose), .lt :global(p) { display: inline; margin: 0; font: inherit; }
  .blurb { max-height: 6.5em; overflow: hidden; color: var(--ink-2); }
  .blurb :global(p) { margin: .2rem 0; }
  .quote { margin: 0; font-style: italic; color: var(--ink-2); }
  .acts { display: flex; gap: .3rem; flex-wrap: wrap; }
  .acts .btn { font-size: .78rem; padding: .2rem .55rem; }
  .btn.on { background: var(--accent); color: var(--paper); border-color: var(--accent); }
</style>
