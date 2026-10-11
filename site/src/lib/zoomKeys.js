// Page-wide + / − / 0: zoom the view under (or last under) the pointer, else the first one on screen.
const targets = new Set();
let last = null;

/** Register a zoomable view: { el, zoom(factor), reset() }. Returns an unregister function. */
export function registerZoom(t) {
  targets.add(t);
  const enter = () => (last = t);
  t.el.addEventListener('pointerenter', enter);
  return () => { targets.delete(t); t.el.removeEventListener('pointerenter', enter); if (last === t) last = null; };
}

const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; };

/** Handle a key; returns true if it was a zoom key and a view took it. */
export function zoomKey(ev) {
  const f = ev.key === '+' || ev.key === '=' ? 1.25 : ev.key === '-' || ev.key === '_' ? 0.8 : ev.key === '0' ? 0 : null;
  if (f === null || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  const t = (last && targets.has(last) && onScreen(last.el) ? last : null) ?? [...targets].find((x) => onScreen(x.el));
  if (!t) return false;
  if (f) t.zoom(f); else t.reset();
  return true;
}
