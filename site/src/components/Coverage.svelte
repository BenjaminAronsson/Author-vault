<script>
  import { store } from '../lib/store.svelte.js';
  import { T } from '../lib/strings.js';
  import { copy } from '../lib/obsidian.js';

  const c = $derived(store.cover);
  const world = $derived(store.model.world);
  const rows = $derived([
    ['Relations over time (rel: tags)', c.withRel, c.characters, 'Faded/grey lines in the web come from Relations tables or shared chapters instead.'],
    ['Whereabouts (at: tags)', c.withAt, c.characters, 'Otherwise taken from each chapter\'s places.'],
    ['Portraits', c.withImage, c.characters, 'Drop an image on any avatar to add one.'],
    ['Voice quote banks', c.withVoice, c.characters, ''],
    ['Memories', c.withMemories, c.characters, ''],
    ['Goals', c.withGoals, c.characters, ''],
    ['Chapters with cast', c.chaptersWithCast, c.chapters, ''],
    ['Chapters with places', c.chaptersWithPlaces, c.chapters, ''],
  ]);
  const ago = $derived.by(() => {
    if (store.source?.kind === 'folder') return 'live from folder';
    const ms = Date.now() - new Date(store.model.generatedAt).getTime();
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min ago` : m < 2880 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
  });
  const backfill = $derived(`Run continuity-keeper on ${world} and backfill the viewer tags (at:, rel:, status:, goal:) on existing Timeline lines.`);
  let done = $state('');
  async function cp(k, t) { await copy(t); done = k; setTimeout(() => (done = ''), 1500); }
  const byKind = $derived(Object.entries(store.model.warnings.reduce((a, w) => ((a[w.kind] ??= []).push(w), a), {})));
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="veil" onclick={() => (store.coverageOpen = false)}>
  <div class="drawer card" role="dialog" tabindex="-1" aria-label={T.coverage} onclick={(ev) => ev.stopPropagation()}>
    <div class="top"><h2>{T.coverage}</h2><button class="btn ghost" onclick={() => (store.coverageOpen = false)} aria-label="Close">✕</button></div>
    <p class="small muted">{T.generated(ago)} · <button class="link" onclick={() => cp('vis', `/visualize ${world}`)}>{done === 'vis' ? T.copied : `copy /visualize ${world}`}</button></p>
    {#each rows as [label, n, of, hint] (label)}
      <div class="row">
        <div class="l">{label}<div class="small muted">{hint}</div></div>
        <div class="meter" aria-label={`${n} of ${of}`}><span style:width={`${of ? (n / of) * 100 : 0}%`}></span></div>
        <div class="n">{n}/{of}</div>
      </div>
    {/each}
    {#if c.withRel < c.characters || c.withAt < c.characters}
      <p><button class="btn" onclick={() => cp('bf', backfill)}>{done === 'bf' ? T.copied : 'Copy backfill request for Claude Code'}</button></p>
    {/if}
    {#if byKind.length}
      <h3>Parser warnings</h3>
      {#each byKind as [kind, list] (kind)}
        <details><summary>{kind} ({list.length})</summary>
          <ul class="small">{#each list.slice(0, 60) as w, i (i)}<li><code>{w.path}</code> — {w.msg}</li>{/each}</ul>
        </details>
      {/each}
    {:else}<p class="small muted">No parser warnings.</p>{/if}
  </div>
</div>

<style>
  .veil { position: fixed; inset: 0; background: rgb(20 15 5 / 30%); z-index: 50; display: flex; justify-content: flex-end; }
  .drawer { width: min(460px, 94vw); height: 100%; border-radius: 0; overflow: auto; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .row { display: grid; grid-template-columns: 1fr 90px 3rem; gap: .6rem; align-items: center; padding: .45rem 0; border-bottom: 1px solid var(--rule); }
  .meter { height: 6px; background: var(--paper-2); border-radius: 3px; overflow: hidden; }
  .meter span { display: block; height: 100%; background: var(--accent); }
  .n { text-align: right; font-variant-numeric: tabular-nums; }
  code { font-size: .78rem; }
</style>
