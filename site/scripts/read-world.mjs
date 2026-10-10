// Reads a world folder from disk into the parser's input shape.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export function readWorldFolder(dir) {
  const files = [], images = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name.startsWith('.') || name === '_sources') continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = relative(dir, p).split(sep).join('/');
        if (/\.md$/i.test(name)) files.push({ path: rel, text: readFileSync(p, 'utf8') });
        else if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(name)) images.push(rel);
      }
    }
  };
  walk(dir);
  return { files, images };
}
