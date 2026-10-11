// Photos from the viewer: tag who is in a picture (and where their face is), or add a new photo to a page.
// Tags are frontmatter edits (lib/edits.js: straight into the vault in folder mode, else kept until saved).
// Adding a photo creates files, so it needs the world folder open with write access.
import { store } from './store.svelte.js';
import { editField } from './edits.js';
import { resizeToWebp, writeFile, readFile } from './images.js';
import { mediaNote } from './mediaNote.js';

const ref = (id) => `[[${store.model.entities[id]?.title ?? id}]]`;
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Put someone in a photo, optionally with a face box {x,y,w,h} (fractions of the picture). */
export async function tag(media, who, box = null) {
  const depicts = [...new Set([...(media.depicts ?? []), who])].map(ref);
  const r = await editField(media, 'depicts', depicts);
  if (box) {
    const regions = [...(media.regions ?? []).filter((x) => x.who !== who), { who, ...box }]
      .map((x) => ({ who: ref(x.who), x: r3(x.x), y: r3(x.y), w: r3(x.w), h: r3(x.h) }));
    await editField(media, 'regions', regions);
  }
  return r;
}

/** Take someone out of a photo (and their face box). */
export async function untag(media, who) {
  const r = await editField(media, 'depicts', (media.depicts ?? []).filter((x) => x !== who).map(ref));
  if ((media.regions ?? []).some((x) => x.who === who)) {
    await editField(media, 'regions', media.regions.filter((x) => x.who !== who).map((x) => ({ who: ref(x.who), x: x.x, y: x.y, w: x.w, h: x.h })));
  }
  return r;
}

export const canAdd = () => !!store.source?.dir;

/** A new photo on someone's (or something's) page: compressed in the browser, a Media note that depicts them. */
export async function addPhoto(entity, file, { caption = '' } = {}) {
  const dir = store.source?.dir;
  if (!dir) throw new Error('Open the world folder (with write access) to add photos.');
  if ((await dir.queryPermission?.({ mode: 'readwrite' })) !== 'granted') await dir.requestPermission?.({ mode: 'readwrite' });
  const blob = await resizeToWebp(file, 2000, 0.8);
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[_\\\/:*?"<>|#^[\]]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Photo';
  let title = base;
  for (let i = 2; store.model.entities[`Media/${title}`] || (await exists(dir, `Media/${title}.md`)); i++) title = `${base} ${i}`;
  const file2 = `_assets/media/${title}.webp`;
  const person = entity.type === 'character';
  const fields = { file: file2, title, caption, depicts: person ? [ref(entity.id)] : [], place: entity.type === 'location' ? ref(entity.id) : null, event: entity.type === 'event' ? ref(entity.id) : null };
  await writeFile(dir, file2, blob);
  await writeFile(dir, `Media/${title}.md`, mediaNote(fields));
  // into the open model, so it shows at once
  const id = `Media/${title}`;
  const url = URL.createObjectURL(blob);
  store.model.imageUrls[file2] = url;
  (store.model.imageFullUrls ??= {})[file2] = url;
  store.model.entities[id] = {
    id, path: `${id}.md`, name: title, type: 'media', title, fm: { type: 'media', file: file2 }, aliases: [], canon: 'book', continuity: 'main',
    sections: {}, sectionOrder: [], preamble: '', timeline: [], portraits: [], gallery: [], image: file2,
    depicts: person ? [entity.id] : [], mediaPlace: entity.type === 'location' ? entity.id : null, mediaEvent: entity.type === 'event' ? entity.id : null,
    mediaDate: null, caption, regions: [],
  };
  store.model.nameIndex[title.toLowerCase()] ??= id;
  entity.media = [...(entity.media ?? []), id];
  store.touch();
  return id;
}

async function exists(dir, path) { try { await readFile(dir, path); return true; } catch { return false; } }
