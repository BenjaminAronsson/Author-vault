// Smoothly tween a map of { id: {x, y} } positions (used for the web, maps and graphs).
export const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class PosTween {
  current = $state.raw({});
  #raf = 0;
  /** Animate from the current positions to `target`. New ids start at `enter(id)` (default: their target). */
  to(target, ms = 600, enter = null) {
    const from = this.current;
    const start = {};
    for (const k in target) start[k] = from[k] ?? enter?.(k) ?? target[k];
    // a position that can't animate (missing / not a number) jumps instead of breaking the frame
    for (const k in target) if (!Number.isFinite(start[k]?.x) || !Number.isFinite(start[k]?.y)) start[k] = target[k];
    cancelAnimationFrame(this.#raf);
    // first placement (nothing on screen yet) is instant; only changes animate
    if (reducedMotion() || ms <= 0 || !Object.keys(from).length) { this.current = target; return; }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / ms)), e = ease(t);
      const cur = {};
      for (const k in target) { const a = start[k], b = target[k]; if (!a || !b) { cur[k] = b; continue; } cur[k] = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }; }
      this.current = cur;
      if (t < 1) this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }
  stop() { cancelAnimationFrame(this.#raf); }
}
