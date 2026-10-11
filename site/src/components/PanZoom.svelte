<script>
  // Zoom and drag-to-move for any view, with the hand: drag moves, a mouse wheel or a pinch zooms around the pointer,
  // two-finger trackpad scrolling pans, + / − / 0 zoom from anywhere on the page (lib/zoomKeys.js), double-click or ⟲ resets.
  // Zoom eases smoothly; the view can't be dragged out of sight; at the zoom limits (and when nothing is zoomed or
  // overflowing) the wheel scrolls the page as usual. A drag never counts as a click on what's underneath.
  import { registerZoom } from '../lib/zoomKeys.js';
  // fit: start (and reset) scaled to fit the content, centred — up to fitMax — and refit on resize until the user zooms/drags
  let { children, min = 0.3, max = 6, height = null, fill = false, fit = false, fitMax = 1.6 } = $props();
  let touched = false;
  let x = $state(0), y = $state(0), k = $state(1); // what is drawn
  let tx = 0, ty = 0, tk = 1; // where it is heading
  let vp = $state(null), inner = $state(null);
  let panning = $state(false);
  let moved = false, start = null, raf = 0;
  const pointers = new Map();
  let pinch = null;
  const KEEP = 80; // px of content that always stays in view

  /** keep at least KEEP px of the content inside the viewport */
  function bound() {
    if (!vp || !inner) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const w = Math.max(inner.scrollWidth, inner.offsetWidth) * tk, h = Math.max(inner.scrollHeight, inner.offsetHeight) * tk;
    tx = Math.min(vw - Math.min(KEEP, w), Math.max(Math.min(KEEP, w) - w, tx));
    ty = Math.min(vh - Math.min(KEEP, h), Math.max(Math.min(KEEP, h) - h, ty));
  }
  function frame() {
    const e = 0.3;
    x += (tx - x) * e; y += (ty - y) * e; k += (tk - k) * e;
    if (Math.abs(tx - x) < 0.3 && Math.abs(ty - y) < 0.3 && Math.abs(tk - k) < 0.0005) { x = tx; y = ty; k = tk; raf = 0; return; }
    raf = requestAnimationFrame(frame);
  }
  function go(now = false) {
    bound();
    if (now || matchMedia('(prefers-reduced-motion: reduce)').matches) { cancelAnimationFrame(raf); raf = 0; x = tx; y = ty; k = tk; return; }
    if (!raf) raf = requestAnimationFrame(frame);
  }
  /** zoom by f around (cx, cy) in viewport px; returns false at the limit (nothing changed) */
  function zoomAt(f, cx, cy, now = false) {
    touched = true;
    const nk = Math.max(min, Math.min(max, tk * f));
    if (Math.abs(nk - tk) < 1e-6) return false;
    tx = cx - (cx - tx) * (nk / tk);
    ty = cy - (cy - ty) * (nk / tk);
    tk = nk;
    go(now);
    return true;
  }
  const rel = (ev) => { const r = vp.getBoundingClientRect(); return [ev.clientX - r.left, ev.clientY - r.top]; };
  const overflowing = () => fit || inner && (inner.scrollWidth * tk > vp.clientWidth + 1 || inner.scrollHeight * tk > vp.clientHeight + 1);

  function onwheel(ev) {
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? vp.clientHeight : 1; // lines / pages → px (Firefox)
    const dx = ev.deltaX * unit, dy = ev.deltaY * unit;
    const [cx, cy] = rel(ev);
    // pinch on a trackpad (ctrlKey) or a mouse wheel (whole notches, no sideways part) → zoom
    const mouseWheel = ev.deltaMode !== 0 || (ev.deltaX === 0 && Math.abs(ev.deltaY) >= 40 && Number.isInteger(ev.deltaY));
    if (ev.ctrlKey || mouseWheel) {
      const f = Math.exp(-dy * (ev.ctrlKey ? 0.01 : 0.0018));
      if (zoomAt(f, cx, cy, ev.ctrlKey)) ev.preventDefault(); // at the limit: let the page scroll on
      else if (ev.ctrlKey) ev.preventDefault(); // never browser-zoom the page from inside a view
      return;
    }
    // two-finger trackpad scroll → pan, but only when there is something to pan to
    if (tk === 1 && !overflowing()) return;
    const bx = tx, by = ty;
    tx -= dx; ty -= dy; touched = true;
    go(true);
    if (tx !== bx || ty !== by) ev.preventDefault();
  }
  function down(ev) {
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    if (ev.target.closest?.('select, input, textarea, .pz-ctrl')) return;
    pointers.set(ev.pointerId, rel(ev));
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1 }; }
    start = { px: ev.clientX, py: ev.clientY, x: tx, y: ty, id: ev.pointerId };
    moved = false;
  }
  function move(ev) {
    if (!pointers.has(ev.pointerId)) return;
    pointers.set(ev.pointerId, rel(ev));
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      zoomAt(d / pinch.d, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, true);
      pinch.d = d;
      moved = true;
      return;
    }
    if (!start || ev.pointerId !== start.id) return;
    const dx = ev.clientX - start.px, dy = ev.clientY - start.py;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    if (!moved) { moved = true; panning = true; try { vp.setPointerCapture(ev.pointerId); } catch {} }
    tx = start.x + dx; ty = start.y + dy;
    touched = true;
    go(true);
  }
  function up(ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      start = null; panning = false;
      if (moved) setTimeout(() => (moved = false), 0); // after the click that ends the drag has been swallowed
    }
  }
  // swallow the click that ends a drag, so dragging over a node doesn't open it
  function click(ev) { if (moved) { ev.stopPropagation(); ev.preventDefault(); moved = false; } }
  function fitted() {
    const w = inner.scrollWidth, h = inner.scrollHeight, vw = vp.clientWidth, vh = vp.clientHeight;
    if (!w || !h || !vw || !vh) return { x: 0, y: 0, k: 1 };
    const kk = Math.max(min, Math.min(fitMax, (vw - 32) / w, (vh - 32) / h));
    return { x: (vw - w * kk) / 2, y: (vh - h * kk) / 2, k: kk };
  }
  export function reset() {
    touched = false;
    if (fit && vp && inner) { const f = fitted(); tx = f.x; ty = f.y; tk = f.k; } else { tx = 0; ty = 0; tk = 1; }
    go();
  }
  $effect(() => {
    if (!fit || !vp || !inner) return;
    const ro = new ResizeObserver(() => { if (!touched) { const f = fitted(); tx = f.x; ty = f.y; tk = f.k; go(true); } });
    ro.observe(vp); ro.observe(inner);
    return () => ro.disconnect();
  });
  const zoomCenter = (f) => { const r = vp.getBoundingClientRect(); zoomAt(f, r.width / 2, r.height / 2); };
  $effect(() => {
    if (!vp) return;
    vp.addEventListener('wheel', onwheel, { passive: false });
    vp.addEventListener('click', click, true);
    const unreg = registerZoom({ el: vp, zoom: zoomCenter, reset });
    return () => { unreg(); cancelAnimationFrame(raf); vp.removeEventListener('wheel', onwheel); vp.removeEventListener('click', click, true); };
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="pz" class:panning class:fill bind:this={vp} style:height={height ? `${height}px` : null}
  tabindex="0" role="application" aria-label="Zoomable view: drag to move, scroll or + and − to zoom, 0 to reset"
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} ondblclick={(ev) => { if (!ev.target.closest?.('button, a, .node')) reset(); }}>
  <div class="pz-inner" class:fit bind:this={inner} style:transform={`translate(${x}px, ${y}px) scale(${k})`}>
    {@render children()}
  </div>
  <div class="pz-ctrl" role="group" aria-label="Zoom">
    <button class="btn" onclick={() => zoomCenter(1.3)} aria-label="Zoom in" title="Zoom in (+)">+</button>
    <button class="btn" onclick={() => zoomCenter(1 / 1.3)} aria-label="Zoom out" title="Zoom out (−)">−</button>
    <button class="btn" onclick={reset} aria-label="Reset view" title="Reset (0 or double-click)" disabled={fit ? false : Math.abs(k - 1) < 0.001 && Math.abs(x) < 0.5 && Math.abs(y) < 0.5}>⟲</button>
  </div>
</div>

<style>
  .pz { position: relative; overflow: hidden; cursor: grab; touch-action: none; outline: none; }
  .pz.fill, .pz.fill .pz-inner { height: 100%; }
  .pz.fill .pz-inner { width: 100%; }
  .pz.panning { cursor: grabbing; }
  .pz.panning :global(*) { cursor: grabbing !important; user-select: none; }
  .pz:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
  .pz-inner { transform-origin: 0 0; }
  .pz-inner.fit { width: max-content; } /* measure the content itself, so it can be scaled to fit */
  .pz-ctrl { position: absolute; right: .5rem; top: .5rem; display: flex; gap: .2rem; align-items: center; opacity: .55; transition: opacity .2s; z-index: 2; }
  .pz:hover .pz-ctrl, .pz:focus-within .pz-ctrl { opacity: 1; }
  .pz-ctrl .btn { width: 1.8rem; height: 1.8rem; padding: 0; justify-content: center; background: var(--card); cursor: pointer; }
</style>
