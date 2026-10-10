// Loading worlds: from generated data files (<script>, works on file://) or straight from a folder.
import { parseWorld } from '../parser/parse.js';
import ParseWorker from '../parser/worker.js?worker&inline';

const IMG = /\.(png|jpe?g|webp|gif|avif|svg)$/i;

export function loadDataWorld(entry) {
  return new Promise((resolve, reject) => {
    if (window.WORLDS?.[entry.name]) return resolve(window.WORLDS[entry.name]);
    const s = document.createElement('script');
    s.src = `./data/${entry.file}`;
    s.onload = () => (window.WORLDS?.[entry.name] ? resolve(window.WORLDS[entry.name]) : reject(new Error(`Data file for ${entry.name} is empty`)));
    s.onerror = () => reject(new Error(`Could not load data/${entry.file}. Run /visualize ${entry.name} again.`));
    document.head.append(s);
  });
}

/** Folder → [{ name, files, images, imageFiles }] — one per world found (picked world or vault root). */
function groupWorlds(entries) {
  // entries: [{ path: 'Picked/Sub/File.md', file: File }]
  const top = entries[0]?.path.split('/')[0] ?? '';
  const strip = (p) => p.split('/').slice(1).join('/');
  const rel = entries.map((e) => ({ ...e, path: strip(e.path) }));
  if (rel.some((e) => e.path === 'World.md')) return [{ name: top, entries: rel }];
  const worlds = new Set(rel.filter((e) => /^[^/]+\/World\.md$/.test(e.path)).map((e) => e.path.split('/')[0]));
  return [...worlds].map((w) => ({ name: w, entries: rel.filter((e) => e.path.startsWith(w + '/')).map((e) => ({ ...e, path: e.path.slice(w.length + 1) })) }));
}

/** Parse in a Web Worker (keeps the page responsive); falls back to the main thread if workers are unavailable. */
function parseOffThread(input) {
  return new Promise((resolve) => {
    let w;
    try { w = new ParseWorker(); } catch { return resolve(parseWorld(input)); }
    w.onmessage = (ev) => { w.terminate(); resolve(ev.data.ok ? ev.data.model : parseWorld(input)); };
    w.onerror = () => { w.terminate(); resolve(parseWorld(input)); };
    w.postMessage(input);
  });
}

async function parseEntries(name, entries, onProgress) {
  const files = [], images = [], imageUrls = {};
  // skip hidden folders (.git, .obsidian) and _sources (the full book text): the viewer never needs it
  const md = entries.filter((e) => /\.md$/i.test(e.path) && !e.path.split('/').some((p) => p.startsWith('.') || p === '_sources'));
  let done = 0;
  onProgress?.({ phase: 'reading', done: 0, total: md.length });
  // read in parallel batches: much faster than one file at a time on big vaults
  for (let i = 0; i < md.length; i += 64) {
    const batch = md.slice(i, i + 64);
    const texts = await Promise.all(batch.map((e) => e.file.text()));
    batch.forEach((e, k) => files.push({ path: e.path, text: texts[k] }));
    done += batch.length;
    onProgress?.({ phase: 'reading', done, total: md.length });
  }
  const imageFiles = {};
  for (const e of entries.filter((e) => IMG.test(e.path))) {
    images.push(e.path);
    imageFiles[e.path] = e.file;
    imageUrls[e.path] = URL.createObjectURL(e.file);
  }
  onProgress?.({ phase: 'parsing', done: md.length, total: md.length });
  const model = await parseOffThread({ world: name, files, images });
  model.imageUrls = imageUrls;
  // kept out of JSON: the raw image files, so "On this device" can store thumbnails
  Object.defineProperty(model, 'imageFiles', { value: imageFiles, enumerable: false });
  return model;
}

/** webkitdirectory input (read-only, every browser). */
export async function worldsFromFileList(fileList) {
  const entries = [...fileList].map((f) => ({ path: f.webkitRelativePath, file: f }));
  return groupWorlds(entries);
}

/** File System Access API (Chrome/Edge): read + write. */
export async function worldsFromDirectoryHandle(dir, onFound) {
  const entries = [];
  const walk = async (h, prefix) => {
    for await (const [name, child] of h.entries()) {
      if (name.startsWith('.') || name === '_sources' || name === 'node_modules') continue;
      if (child.kind === 'directory') await walk(child, `${prefix}/${name}`);
      else if (/\.md$/i.test(name) || IMG.test(name)) {
        entries.push({ path: `${prefix}/${name}`, file: await child.getFile() });
        if (entries.length % 200 === 0) onFound?.(entries.length);
      }
    }
  };
  await walk(dir, dir.name);
  const groups = groupWorlds(entries);
  for (const g of groups) g.dir = groups.length === 1 && entries.some((e) => e.path === `${dir.name}/World.md`) ? dir : await dir.getDirectoryHandle(g.name);
  return groups;
}

export const parseWorldGroup = (g, onProgress) => parseEntries(g.name, g.entries, onProgress);
export const canWrite = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;
