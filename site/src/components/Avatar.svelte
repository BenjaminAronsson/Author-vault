<script>
  import { store } from '../lib/store.svelte.js';
  import { uploadImage } from '../lib/images.js';
  import { T } from '../lib/strings.js';

  let { id, size = 40, upload = false, ring = null } = $props();
  const e = $derived(store.model?.entities[id]);
  const url = $derived((store.version, store.imageFor(id)));
  const initials = $derived((e?.title ?? '?').split(/\s+/).filter((w) => /^[A-Za-zÀ-ž]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase());
  const hue = $derived.by(() => {
    const key = String(e?.fm?.culture ?? e?.fm?.factions ?? e?.type ?? id);
    let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
    return h;
  });

  let over = $state(false);
  let choosing = $state(null); // File waiting for "main" vs "from here"
  let busy = $state(false);
  let msg = $state('');
  let input = $state(null);

  function pick(files) {
    const f = [...(files ?? [])].find((f) => f.type.startsWith('image/'));
    if (f) choosing = f;
  }
  async function apply(mode) {
    const f = choosing; choosing = null; busy = true; msg = '';
    try { const r = await uploadImage(e, f, mode); msg = r.saved ? 'Saved to vault' : 'Kept in browser — save to vault from the banner'; }
    catch (err) { msg = err.message; }
    busy = false;
  }
</script>

<div class="av" style="--s:{size}px; --h:{hue}" class:over class:ring={ring}
  style:--ring={ring}
  ondragover={(ev) => { if (upload) { ev.preventDefault(); over = true; } }}
  ondragleave={() => (over = false)}
  ondrop={(ev) => { if (!upload) return; ev.preventDefault(); over = false; pick(ev.dataTransfer.files); }}
  role={upload ? 'group' : undefined} aria-label={upload ? `${e?.title} image — drop an image to upload` : undefined}>
  {#if url}
    <img src={url} alt={e?.title ?? ''} />
  {:else}
    <span class="mono" aria-hidden="true">{initials}</span>
  {/if}
  {#if store.model?.entities[id]?.canon === 'expansion'}<span class="dot-exp" title="Expansion"></span>{/if}
  {#if over}<span class="drop">{T.dropHere}</span>{/if}
</div>

{#if upload}
  <div class="up">
    <button class="btn" disabled={busy} onclick={() => input.click()}>⬆ {T.uploadPortrait}</button>
    <input bind:this={input} type="file" accept="image/*" hidden onchange={(ev) => pick(ev.currentTarget.files)} />
    {#if choosing}
      <div class="choice card" role="dialog" aria-label="Where should this image go?">
        <button class="btn" onclick={() => apply('main')}>{T.uploadMain}</button>
        <button class="btn" onclick={() => apply('from')}>{T.uploadFromHere(store.sequence[store.idx])}</button>
        <button class="btn ghost" onclick={() => (choosing = null)}>Cancel</button>
      </div>
    {/if}
    {#if msg}<div class="small muted">{msg}</div>{/if}
  </div>
{/if}

<style>
  .av { position: relative; width: var(--s); height: var(--s); border-radius: 50%; flex: none; overflow: hidden;
    background: hsl(var(--h) 35% 78%); display: grid; place-items: center; box-shadow: 0 0 0 2px var(--card); }
  :global([data-theme='dark']) .av { background: hsl(var(--h) 25% 32%); }
  .av.ring { box-shadow: 0 0 0 2px var(--card), 0 0 0 4px var(--ring); }
  img { width: 100%; height: 100%; object-fit: cover; }
  .mono { font: 600 calc(var(--s) * .38)/1 var(--serif); color: hsl(var(--h) 40% 25%); }
  :global([data-theme='dark']) .mono { color: hsl(var(--h) 40% 85%); }
  .dot-exp { position: absolute; right: 6%; bottom: 6%; width: 22%; height: 22%; border-radius: 50%; background: var(--exp); box-shadow: 0 0 0 2px var(--card); }
  .over { outline: 3px dashed var(--accent); }
  .drop { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 45%); color: #fff; font-size: .7rem; text-align: center; }
  .up { margin-top: .5rem; display: grid; gap: .4rem; justify-items: center; max-width: 220px; }
  .choice { display: flex; gap: .4rem; flex-wrap: wrap; padding: .5rem; }
</style>
