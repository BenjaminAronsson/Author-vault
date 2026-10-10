// Parses a world off the main thread so the page never freezes on big vaults.
import { parseWorld } from './parse.js';

self.onmessage = (ev) => {
  const { world, files, images } = ev.data;
  try {
    const t = performance.now();
    const model = parseWorld({ world, files, images });
    self.postMessage({ ok: true, model, ms: Math.round(performance.now() - t) });
  } catch (e) {
    self.postMessage({ ok: false, error: e.message });
  }
};
