// Photos and scans as Media notes: the picture goes to _assets/media/ (compressed: WebP, at most 2000 px, the
// camera's rotation applied), and a note in Media/ says who is in it, where, when and from which source.
// Used by `vault add-media` and by apply (a patch's `media`). Never overwrites a note: a second photo with the
// same name gets " 2", " 3"…
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';

export const MEDIA_EXT = /\.(jpe?g|png|webp|gif|avif|tiff?|heic)$/i;
const MAX = 2000, QUALITY = 80;

import { mediaNote } from '../lib/mediaNote.js';
export { mediaNote };

/** A free note path under Media/ for this title. */
export function freeMediaPath(dir, title) {
  const clean = String(title).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'Photo';
  for (let i = 1; ; i++) {
    const rel = `Media/${clean}${i > 1 ? ` ${i}` : ''}.md`;
    if (!existsSync(join(dir, rel))) return rel;
  }
}

/** "2023:06:24 14:01:00" from EXIF, read straight out of the raw block → "2023-06-24" */
function exifDate(exif) {
  const m = exif && /(\d{4}):(\d\d):(\d\d) \d\d:\d\d:\d\d/.exec(exif.toString('latin1'));
  return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Files to import from a list of files and folders (folders are read one level deep and below). */
export function collectMedia(paths) {
  const out = [];
  const walk = (p) => {
    if (statSync(p).isDirectory()) for (const n of readdirSync(p).sort()) { if (!n.startsWith('.')) walk(join(p, n)); }
    else if (MEDIA_EXT.test(p)) out.push(p);
  };
  for (const p of paths) walk(p);
  return out;
}

/**
 * Compress one picture into the world and write its Media note.
 * → { note, file, date, bytesIn, bytesOut }
 */
export async function addMedia(dir, src, { depicts = [], date = null, place = null, event = null, caption = '', source = null, canon = 'book', sharp } = {}) {
  const title = basename(src, extname(src)).replace(/[_]+/g, ' ').trim();
  const note = freeMediaPath(dir, title);
  const stem = basename(note, '.md');
  const file = `_assets/media/${stem}.webp`;
  mkdirSync(join(dir, '_assets/media'), { recursive: true });
  mkdirSync(join(dir, 'Media'), { recursive: true });
  const img = sharp(src, { failOn: 'none' });
  const meta = await img.metadata();
  const info = await img.rotate().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(join(dir, file));
  const when = date ?? exifDate(meta.exif);
  writeFileSync(join(dir, note), mediaNote({ file, title: stem, depicts, date: when, place, event, caption, source, canon }));
  return { note, file, date: when, bytesIn: statSync(src).size, bytesOut: info.size };
}
