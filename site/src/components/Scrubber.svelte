<script>
  // "You've read up to …": book + chapter pickers, a labelled books strip and a numbered chapter strip.
  import { store } from '../lib/store.svelte.js';

  const seq = $derived(store.sequence);
  const ch = (cid) => store.model.chapters[cid];
  const book = $derived(store.book);
  const bookSteps = $derived(book ? seq.slice(book.start, book.end + 1).map((cid, k) => ({ cid, i: book.start + k })) : []);
  const total = $derived(seq.length);
  const label = (cid) => { const c = ch(cid); return `${c.story === book?.story ? `Chapter ${c.num}` : `${store.model.stories[c.story]?.title ?? c.story} · ${c.num}`} — ${c.title}`; };
  const density = $derived.by(() => {
    const d = Object.fromEntries(seq.map((c) => [c, ch(c).events.length + ch(c).characters.length / 3]));
    for (const e of Object.values(store.model.entities)) for (const t of e.timeline ?? []) if (t.step in d) d[t.step] += 0.5;
    const max = Math.max(1, ...Object.values(d));
    return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v / max]));
  });

  // Play (chapter by chapter, at the chosen speed)
  const playing = $derived(store.playing);
  let timer = null;
  function tick() { if (!store.playing) return; if (store.idx >= total - 1) stop(); else { store.move(1); timer = setTimeout(tick, store.speed); } }
  function play() {
    if (store.playing) return stop();
    if (store.idx >= total - 1) store.setAt(seq[0]);
    store.playing = true;
    timer = setTimeout(tick, Math.min(700, store.speed));
  }
  function stop() { store.playing = false; clearTimeout(timer); }
  $effect(() => () => clearTimeout(timer));

  // Follow: who the views keep in focus, and a one-line caption of what just happened to them
  const people = $derived(Object.values(store.model.entities).filter((e) => e.type === 'character' && store.visible(e.id))
    .sort((a, b) => a.title.localeCompare(b.title)));
  const caption = $derived.by(() => {
    const f = store.follow;
    if (!f || !store.snap) return null;
    const cur = store.snap, prev = store.snaps[store.idx - 1];
    const name = store.name(f);
    const parts = [];
    const a = prev?.presence[f]?.place, b = cur.presence[f]?.place;
    if (b && a && a !== b) parts.push(`goes from ${store.name(a)} to ${store.name(b)}`);
    else if (b && !a) parts.push(`arrives at ${store.name(b)}`);
    else if (b) parts.push(`at ${store.name(b)}`);
    if ((cur.status[f] ?? '') !== (prev?.status[f] ?? '') && cur.status[f]) parts.push(`now ${cur.status[f]}`);
    for (const r of cur.relChanges.filter((r) => r.from === f)) parts.push(`${r.n > 0 ? 'warm' : r.n < 0 ? 'cold' : 'neutral'} toward ${store.name(r.to)} (${r.bond})`);
    for (const r of cur.relChanges.filter((r) => r.to === f)) parts.push(`${store.name(r.from)} feels ${r.bond} toward them`);
    for (const [g, st] of Object.entries(cur.goals[f] ?? {})) if (prev?.goals[f]?.[g] !== st) parts.push(`goal “${g}”: ${st}`);
    const on = cur.onStage.includes(f);
    return { name, text: parts.join(' · ') || 'nothing changes', on };
  });

  function pickBook(ev) { stop(); const b = store.books[+ev.currentTarget.value]; if (b) store.setAt(seq[b.start]); }
  function pickChapter(ev) { stop(); store.setAt(ev.currentTarget.value); }

  let strip = $state(null);
  let dragging = false;
  function fromPointer(ev) {
    const cells = [...strip.querySelectorAll('[data-i]')];
    let best = null, bd = Infinity;
    for (const t of cells) { const r = t.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - ev.clientX); if (d < bd) { bd = d; best = +t.dataset.i; } }
    if (best != null) store.setAt(seq[best]);
  }
  function key(ev) {
    const k = ev.key;
    if (k !== ' ') stop();
    if (k === 'ArrowRight' || k === 'ArrowLeft') { ev.preventDefault(); ev.shiftKey ? store.moveBook(k === 'ArrowRight' ? 1 : -1) : store.move(k === 'ArrowRight' ? 1 : -1); }
    else if (k === ' ') { ev.preventDefault(); play(); return; }
    else if (k === 'PageDown' || k === 'PageUp') { ev.preventDefault(); store.moveBook(k === 'PageDown' ? 1 : -1); }
    else if (k === 'Home') { ev.preventDefault(); store.setAt(seq[book.start]); }
    else if (k === 'End') { ev.preventDefault(); store.setAt(seq[book.end]); }
  }
  const showNums = $derived(bookSteps.length <= 45);
</script>

<footer class="scrub" aria-label="Reading position" data-tour="bookmark">
  <div class="here">
    <div class="label">You've read up to</div>
    <div class="pickers">
      <select class="bk" aria-label="Book" value={store.books.indexOf(book)} onchange={pickBook} data-tour="book-picker">
        {#each store.books as b, k (b.story + b.start)}
          <option value={k}>{b.branch ? '⑂ ' : ''}{b.title}{k < store.books.indexOf(book) ? ' ✓' : ''}</option>
        {/each}
      </select>
      <select class="cp" aria-label="Chapter" value={seq[store.idx]} onchange={pickChapter}>
        {#each bookSteps as { cid } (cid)}<option value={cid}>{label(cid)}{ch(cid).canon === 'expansion' ? ' (expansion)' : ''}</option>{/each}
      </select>
    </div>
    {#if caption}
      <div class="cap" aria-live="polite"><strong>{caption.name}</strong> {caption.text}{#if !caption.on}<span class="muted"> · off the page</span>{/if}</div>
    {:else}
      <div class="small muted pos">{store.idx + 1} of {total} chapters · later chapters {store.future === 'hide' ? 'hidden' : 'dimmed'}</div>
    {/if}
  </div>

  <div class="ctrl">
    <button class="btn ghost nav" aria-label="Previous chapter" title="Previous chapter (←)" onclick={() => { stop(); store.move(-1); }} disabled={store.idx <= 0}>◀</button>
    <button class="btn play" onclick={play} aria-pressed={playing} aria-label={playing ? 'Pause' : 'Play the story'} title={playing ? 'Pause' : 'Play: step through chapter by chapter'}>{playing ? '❚❚' : '▶'}</button>
    <button class="btn ghost nav" aria-label="Next chapter" title="Next chapter (→)" onclick={() => { stop(); store.move(1); }} disabled={store.idx >= total - 1}>▶</button>
    <div class="follow" data-tour="follow">
      <select aria-label="Follow a character" value={store.follow ?? ''} onchange={(ev) => store.setFollow(ev.currentTarget.value)} title="Keep one character in focus while you move through the story">
        <option value="">Follow…</option>
        {#each people as p (p.id)}<option value={p.id}>👁 {p.title}</option>{/each}
      </select>
      <select aria-label="Playback speed" bind:value={store.speed} title="Playback speed">
        <option value={3200}>slow</option><option value={1800}>normal</option><option value={900}>fast</option>
      </select>
    </div>
  </div>

  <div class="strips">
    <div class="books" aria-label="Books">
      {#each store.books as b, k (b.story + b.start)}
        {@const n = b.end - b.start + 1}
        {@const read = Math.max(0, Math.min(n, store.idx - b.start + 1))}
        <button class="bseg" class:cur={b === book} class:branch={b.branch} class:exp={b.canon === 'expansion'} style:flex-grow={n}
          title={`${b.title} · ${n} chapters${read === n ? ' · read' : read ? ` · ${read} read` : ''}`} onclick={() => { stop(); store.setAt(seq[b === book ? b.start : b.start]); }}>
          <span class="fill" style:width={`${(read / n) * 100}%`}></span>
          <span class="bt">{b.title}</span>
        </button>
      {/each}
    </div>
    <div class="chapters" bind:this={strip} role="slider" tabindex="0"
      aria-label="Chapters of {book?.title}" aria-valuemin="1" aria-valuemax={total} aria-valuenow={store.idx + 1} aria-valuetext={label(seq[store.idx])}
      onkeydown={key}
      onpointerdown={(ev) => { stop(); dragging = true; strip.setPointerCapture(ev.pointerId); fromPointer(ev); }}
      onpointermove={(ev) => dragging && fromPointer(ev)}
      onpointerup={() => (dragging = false)}>
      {#each bookSteps as { cid, i } (cid)}
        {@const c = ch(cid)}
        <div class="cell" data-i={i} class:read={i <= store.idx} class:cur={i === store.idx} class:hatch={c.canon === 'expansion'} title={label(cid)}>
          <span class="bar" style:height={`${25 + density[cid] * 60}%`}></span>
          {#if showNums}<span class="num">{c.story === book.story ? c.num : '·'}</span>{/if}
          {#if i === store.idx}<span class="pin" aria-hidden="true">you are here</span>{/if}
        </div>
      {/each}
    </div>
  </div>
</footer>

<style>
  .scrub { display: grid; grid-template-columns: minmax(15rem, 22rem) auto 1fr; gap: .8rem; align-items: center; padding: .55rem 1rem .6rem; background: var(--card); border-top: 1px solid var(--rule); }
  .label { margin-bottom: .25rem; }
  .pickers { display: flex; gap: .3rem; }
  select { font: inherit; font-size: .85rem; background: var(--paper); color: var(--ink); border: 1px solid var(--rule); border-radius: 6px; padding: .2rem .3rem; min-width: 0; }
  .bk { flex: 0 1 45%; font-weight: 600; }
  .cp { flex: 1 1 55%; }
  .pos { margin-top: .2rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ctrl { display: flex; align-items: center; gap: .2rem; flex-wrap: wrap; max-width: 15rem; }
  .follow { display: flex; gap: .2rem; width: 100%; }
  .follow select:first-child { flex: 1; min-width: 0; }
  .cap { margin-top: .2rem; font-size: .8rem; line-height: 1.3; max-height: 2.6em; overflow: hidden; color: var(--ink-2); }
  .cap strong { color: var(--accent); }
  .nav { padding: .2rem .45rem; }
  .play { width: 2.3rem; height: 2.3rem; justify-content: center; padding: 0; background: var(--accent); color: var(--paper); border-color: var(--accent); }
  .strips { display: grid; gap: 6px; min-width: 0; }
  .books { display: flex; gap: 3px; }
  .bseg { position: relative; flex-basis: 0; min-width: 18px; height: 20px; border: 1px solid var(--rule); background: var(--paper-2); border-radius: 4px; padding: 0 .35rem; overflow: hidden; text-align: left; }
  .bseg .fill { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .bseg.cur { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
  .bseg.branch, .bseg.exp { background: var(--exp-tint); border-color: color-mix(in srgb, var(--exp) 45%, var(--rule)); }
  .bt { position: relative; font: 600 .68rem/18px var(--sans); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; color: var(--ink-2); }
  .bseg.cur .bt { color: var(--ink); }
  .chapters { display: flex; gap: 2px; height: 40px; align-items: flex-end; cursor: pointer; touch-action: none; user-select: none; border-radius: 4px; padding-top: 14px; }
  .cell { position: relative; flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; min-width: 4px; border-radius: 3px; }
  .cell.hatch { background: var(--hatch); }
  .bar { width: 100%; background: var(--ink-3); opacity: .3; border-radius: 2px 2px 0 0; }
  .cell.read .bar { background: var(--accent); opacity: .55; }
  .cell.cur .bar { opacity: 1; }
  .cell.cur { outline: 2px solid var(--accent); outline-offset: 1px; }
  .num { position: absolute; bottom: 2px; font: 600 .62rem var(--sans); color: var(--ink-2); pointer-events: none; }
  .cell.read .num { color: var(--paper); }
  .pin { position: absolute; top: -15px; white-space: nowrap; font: 700 .6rem var(--sans); color: var(--accent); text-transform: uppercase; letter-spacing: .04em; }
  @media (max-width: 800px) {
    .scrub { grid-template-columns: 1fr auto; }
    .strips { grid-column: 1 / -1; }
    .pos { display: none; }
  }
</style>
