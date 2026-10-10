// Portrait/image upload: resize in the browser, write into the vault (folder mode) or keep it pending in IndexedDB.
import { store } from './store.svelte.js';
import { setField, addListItem } from './frontmatter.js';

const TYPE_FOLDER = { character: 'characters', location: 'places', faction: 'factions', item: 'items', creature: 'creatures', religion: 'religions', culture: 'cultures', world: 'world', magic: 'magic', technology: 'technology', concept: 'concepts', language: 'languages', event: 'events', era: 'history' };
const slug = (s) => s.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

export async function resizeToWebp(file, max = 1024) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = new OffscreenCanvas(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: 'image/webp', quality: 0.85 });
}

function plan(entity, mode) {
  const folder = TYPE_FOLDER[entity.type] ?? slug(entity.type);
  const suffix = mode === 'main' ? '' : mode === 'map' ? '-map' : `-${slug(store.at ?? store.sequence[store.idx] ?? 'later')}`;
  const fileName = `${slug(entity.name)}${suffix}-${Date.now().toString(36)}.webp`;
  return { path: `_assets/${folder}/${entity.name}/${fileName}`, fileName };
}

function editNote(text, mode, fileName, at) {
  if (mode === 'map') return setField(text, 'map_image', `[[${fileName}]]`);
  return mode === 'main' ? setField(text, 'image', `[[${fileName}]]`) : addListItem(text, 'portraits', `{at: ${at}, file: "[[${fileName}]]"}`);
}

export async function writeFile(dir, path, data) {
  const parts = path.split('/');
  let h = dir;
  for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p, { create: true });
  const fh = await h.getFileHandle(parts.at(-1), { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}
export async function readFile(dir, path) {
  const parts = path.split('/');
  let h = dir;
  for (const p of parts.slice(0, -1)) h = await h.getDirectoryHandle(p);
  return (await (await h.getFileHandle(parts.at(-1))).getFile()).text();
}

/** Applies an image to the in-memory model so the UI updates immediately. */
function applyToModel(entity, mode, path, at, url) {
  const e = store.model.entities[entity.id];
  store.model.imageUrls ??= {};
  store.model.imageUrls[path] = url;
  if (mode === 'main') e.image = path;
  else if (mode === 'map') e.mapImage = path;
  else e.portraits = [...(e.portraits ?? []), { at, image: path }];
  store.touch();
}

export async function uploadImage(entity, file, mode) {
  const blob = await resizeToWebp(file);
  const { path, fileName } = plan(entity, mode);
  const at = store.sequence[store.idx];
  const url = URL.createObjectURL(blob);
  if (store.source?.dir) {
    if ((await store.source.dir.queryPermission?.({ mode: 'readwrite' })) !== 'granted') await store.source.dir.requestPermission?.({ mode: 'readwrite' });
    await writeFile(store.source.dir, path, blob);
    const text = await readFile(store.source.dir, entity.path);
    await writeFile(store.source.dir, entity.path, editNote(text, mode, fileName, at));
    applyToModel(entity, mode, path, at, url);
    return { saved: true, path };
  }
  const item = { world: store.model.world, entityId: entity.id, entityPath: entity.path, mode, at, path, fileName, blob };
  await idb('put', item);
  store.pending = [...store.pending, { ...item, url }];
  applyToModel(entity, mode, path, at, url);
  return { saved: false, path };
}

/** Writes all pending images into a world folder the user picks (Chrome/Edge), else downloads them. */
/** Asks for the world folder (or its vault) with write access. */
export async function pickWorldDir() {
  let dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'world-folder' });
  try { await dir.getFileHandle('World.md'); } catch {
    try { dir = await dir.getDirectoryHandle(store.model.world); await dir.getFileHandle('World.md'); }
    catch { throw new Error(`Pick the "${store.model.world}" world folder (the one with World.md).`); }
  }
  return dir;
}

export async function savePending(givenDir = null) {
  const items = store.pending.filter((p) => p.world === store.model.world);
  if (!items.length) return;
  if (givenDir || 'showDirectoryPicker' in window) {
    const dir = givenDir ?? (await pickWorldDir());
    for (const p of items) {
      await writeFile(dir, p.path, p.blob);
      const text = await readFile(dir, p.entityPath);
      await writeFile(dir, p.entityPath, editNote(text, p.mode, p.fileName, p.at));
      await idb('delete', p.path);
    }
    store.source = { ...store.source, dir };
    store.pending = store.pending.filter((p) => !items.includes(p));
    return { written: items.length };
  }
  // Fallback: download each image and show the frontmatter lines to paste.
  const snippets = [];
  for (const p of items) {
    const a = Object.assign(document.createElement('a'), { href: p.url, download: p.fileName });
    a.click();
    snippets.push(`${p.entityPath}  →  save image to ${p.path}\n  ${p.mode === 'main' ? `image: "[[${p.fileName}]]"` : p.mode === 'map' ? `map_image: "[[${p.fileName}]]"` : `portraits: - {at: ${p.at}, file: "[[${p.fileName}]]"}`}`);
  }
  return { snippets: snippets.join('\n\n') };
}

export async function loadPending(world) {
  const all = (await idb('getAll')) ?? [];
  const mine = all.filter((p) => p.world === world).map((p) => ({ ...p, url: URL.createObjectURL(p.blob) }));
  store.pending = mine;
  for (const p of mine) {
    const e = store.model.entities[p.entityId];
    if (!e) continue;
    store.model.imageUrls[p.path] = p.url;
    if (p.mode === 'main') e.image = p.path; else if (p.mode === 'map') e.mapImage = p.path; else e.portraits = [...(e.portraits ?? []), { at: p.at, image: p.path }];
  }
  if (mine.length) store.touch();
}

function idb(op, arg) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open('world-viewer', 1); } catch { return resolve(null); }
    req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'path' });
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const tx = req.result.transaction('pending', op === 'getAll' ? 'readonly' : 'readwrite');
      const st = tx.objectStore('pending');
      const r = op === 'getAll' ? st.getAll() : op === 'put' ? st.put(arg) : st.delete(arg);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    };
  });
}

