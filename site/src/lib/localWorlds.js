// "On this device": worlds opened from a folder are kept in this browser's IndexedDB so they reopen
// without picking the folder again. Nothing leaves the device. Images are stored as thumbnails only.
import { resizeToWebp } from './images.js';
import { rememberFolder } from './recent.js';

const DB = 'world-viewer-local';
function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('meta', { keyPath: 'name' }); req.result.createObjectStore('worlds', { keyPath: 'name' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const r = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(r?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Storage aborted (quota?)'));
  });
}

export async function listLocal() {
  try { return ((await run('meta', 'readonly', (s) => s.getAll())) ?? []).sort((a, b) => b.savedAt.localeCompare(a.savedAt)); } catch { return []; }
}

/** Saves a parsed world (model + thumbnails). `dir` is the folder handle if we have one (Chrome/Edge). */
export async function saveLocal(model, { dir = null, onProgress } = {}) {
  try { await navigator.storage?.persist?.(); } catch {}
  const images = {};
  const files = model.imageFiles ?? {};
  const maps = new Set(Object.values(model.entities).map((e) => e.mapImage).filter(Boolean));
  const used = new Set(Object.values(model.entities).flatMap((e) => [e.image, e.mapImage, ...(e.portraits ?? []).map((p) => p.image), ...(e.gallery ?? [])]).filter(Boolean));
  let n = 0;
  for (const path of used) {
    const f = files[path];
    if (!f) continue;
    try { images[path] = await resizeToWebp(f, maps.has(path) ? 2400 : 640); }
    catch { if (f.size < 2e6) images[path] = f; } // e.g. SVG that can't be rasterised here: keep small originals
    onProgress?.(++n / used.size);
  }
  const { imageUrls, ...plain } = model;
  const record = { name: model.world, model: plain, images };
  const bytes = JSON.stringify(plain).length + Object.values(images).reduce((a, b) => a + b.size, 0);
  const hasDir = !!(dir && (await rememberFolder(dir, `world:${model.world}`)) !== null);
  const meta = {
    name: model.world, savedAt: new Date().toISOString(), bytes, hasDir,
    title: model.entities[model.worldEntity]?.title ?? model.world,
    notes: Object.keys(model.entities).length, chapters: Object.keys(model.chapters).length,
    characters: Object.values(model.entities).filter((e) => e.type === 'character').length,
  };
  await run('worlds', 'readwrite', (s) => s.put(record));
  await run('meta', 'readwrite', (s) => s.put(meta));
  return meta;
}

export async function loadLocal(name) {
  const rec = await run('worlds', 'readonly', (s) => s.get(name));
  if (!rec) return null;
  const model = rec.model;
  model.imageUrls = Object.fromEntries(Object.entries(rec.images ?? {}).map(([p, blob]) => [p, URL.createObjectURL(blob)]));
  return model;
}

/** Removes everything this viewer stored about a world on this device. */
export async function forgetLocal(name) {
  await run('worlds', 'readwrite', (s) => s.delete(name));
  await run('meta', 'readwrite', (s) => s.delete(name));
  for (const k of [`edits:${name}`, `bookmark:${name}`]) try { localStorage.removeItem(k); } catch {}
  // pending images (images.js store)
  await new Promise((resolve) => {
    const req = indexedDB.open('world-viewer', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'path' });
    req.onerror = () => resolve();
    req.onsuccess = () => {
      const tx = req.result.transaction('pending', 'readwrite');
      const st = tx.objectStore('pending');
      const all = st.getAll();
      all.onsuccess = () => { for (const p of all.result ?? []) if (p.world === name) st.delete(p.path); };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    };
  });
}

export async function storageEstimate() {
  try { const e = await navigator.storage.estimate(); return { used: e.usage ?? 0, quota: e.quota ?? 0 }; } catch { return null; }
}
export const fmtBytes = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
