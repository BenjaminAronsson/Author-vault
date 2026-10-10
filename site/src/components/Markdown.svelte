<script>
  import { marked } from 'marked';
  import { store } from '../lib/store.svelte.js';

  let { text = '' } = $props();
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const html = $derived.by(() => {
    const src = String(text ?? '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_, t, label) => {
        const id = store.model?.nameIndex[t.trim().toLowerCase()];
        const shown = esc(label ?? t);
        return id ? `<a class="wl" href="#" data-id="${esc(id)}">${shown}</a>` : `<span class="wl missing">${shown}</span>`;
      })
      .replace(/^>\s*\[!(\w+)\][^\n]*\n?/gm, '> ');
    return marked.parse(src, { gfm: true, breaks: false });
  });
  function click(ev) {
    const a = ev.target.closest?.('a.wl');
    if (a) { ev.preventDefault(); store.open(a.dataset.id); }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="prose" onclick={click}>{@html html}</div>
