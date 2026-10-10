<script>
  // First-run guided tour: spotlights one part of the screen at a time.
  import { store } from '../lib/store.svelte.js';

  const world = $derived(store.model?.entities[store.model.worldEntity]?.title ?? store.model?.world);
  const steps = $derived([
    { title: `Welcome to ${world}`, body: 'A quick tour to get you going: about 30 seconds. You can replay it any time with the ? button at the top.' },
    { target: 'bookmark', title: "You've read up to…", body: 'This is your place in the story. Pick a book and chapter here, or click the numbered chapters. Everything after this point is hidden, so there are no spoilers. ← → moves one chapter, and the strip above jumps between books.' },
    { target: 'follow', title: 'Follow someone, then press ▶', body: 'Pick a character to follow and press play (or Space). The story moves on by itself: they travel across the map, the web turns around them, their storyline is highlighted, and a caption here tells you what just happened to them. Choose slow, normal or fast.' },
    { target: 'nav', title: 'Five ways to look at the story', body: 'Home: the story so far. Timeline: books, chapters and storylines. People: who feels what about whom. Places & History: maps and eras. Reader: one chapter at a time, in big print.' },
    { target: 'search', title: 'Find anything, jump anywhere', body: 'Search people, places and events by name or nickname. Or type “B3 C12” or a book title to move your bookmark there. Shortcut: ⌘K or /.' },
    { target: 'filters', title: 'Book vs. your additions', body: 'Book is what the author wrote. Expansion is what you and Claude added (shown hatched and purple). Turn either off. Continuity switches to “what if” versions of the story.' },
    { target: 'coverage', title: 'What the viewer knows', body: "Data coverage shows how complete your notes are (relations over time, places, portraits) and how to fill the gaps." },
    { title: 'Now meet the characters', body: 'Open anyone to see their goals, fears and dreams, their own words, and their memories next to what really happened. “Copy /become” lets you talk to them in Claude Code. Drop an image on any avatar to give them a face.' },
  ]);
  let k = $state(0);
  const step = $derived(steps[k]);
  let rect = $state(null);
  $effect(() => {
    k; store.view;
    const el = step?.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    rect = el ? el.getBoundingClientRect() : null;
  });
  function close() { store.tourOpen = false; try { localStorage.setItem('tour:done', '1'); } catch {} }
  function key(ev) {
    if (ev.key === 'Escape') close();
    else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); k < steps.length - 1 ? k++ : close(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ev.stopPropagation(); if (k) k--; }
  }
  const PAD = 6;
  const cardStyle = $derived.by(() => {
    if (!rect) return 'left:50%;top:50%;transform:translate(-50%,-50%)';
    const below = rect.bottom + 16 + 220 < innerHeight;
    const left = Math.min(Math.max(12, rect.left), innerWidth - 392);
    return below ? `left:${left}px;top:${rect.bottom + 14}px` : `left:${left}px;bottom:${innerHeight - rect.top + 14}px`;
  });
  let card = $state(null);
  $effect(() => { card?.focus(); });
</script>

<svelte:window onkeydown={key} onresize={() => (k = k)} />

<div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
  {#if rect}
    <div class="spot" style:left={`${rect.left - PAD}px`} style:top={`${rect.top - PAD}px`} style:width={`${rect.width + PAD * 2}px`} style:height={`${rect.height + PAD * 2}px`}></div>
  {:else}
    <div class="dim"></div>
  {/if}
  <div class="card tcard" style={cardStyle} bind:this={card} tabindex="-1">
    <div class="label">Step {k + 1} of {steps.length}</div>
    <h2 id="tour-title">{step.title}</h2>
    <p>{step.body}</p>
    <div class="dots" aria-hidden="true">{#each steps as _, j (j)}<span class:on={j === k}></span>{/each}</div>
    <div class="row">
      <button class="btn ghost" onclick={close}>Skip tour</button>
      <span class="sp"></span>
      {#if k}<button class="btn" onclick={() => k--}>Back</button>{/if}
      <button class="btn primary" onclick={() => (k < steps.length - 1 ? k++ : close())}>{k < steps.length - 1 ? 'Next' : 'Start exploring'}</button>
    </div>
  </div>
</div>

<style>
  .tour { position: fixed; inset: 0; z-index: 80; }
  .dim { position: absolute; inset: 0; background: rgb(20 15 5 / 55%); }
  .spot { position: absolute; border-radius: 10px; box-shadow: 0 0 0 9999px rgb(20 15 5 / 55%), 0 0 0 3px var(--accent) inset; transition: all .25s ease; pointer-events: none; }
  .tcard { position: absolute; width: 380px; max-width: calc(100vw - 24px); outline: none; }
  h2 { margin: .1rem 0 .4rem; }
  p { margin: 0 0 .7rem; }
  .dots { display: flex; gap: 5px; margin-bottom: .7rem; }
  .dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--rule); }
  .dots span.on { background: var(--accent); }
  .row { display: flex; gap: .4rem; align-items: center; }
  .sp { flex: 1; }
</style>
