#!/usr/bin/env node
// Generates the viewer's data files for one or more worlds. The site itself is never rebuilt.
//
// usage: node scripts/build-data.mjs [--vault <path>] [--out <data-dir>] <World> [<World>...]
//        node scripts/build-data.mjs [--vault <path>] --all
// default vault: ../book-universe (relative to site/)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { basename, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readWorldFolder } from './read-world.mjs';
import { parseWorld } from '../src/parser/parse.js';
import { coverage } from '../src/parser/derive.js';

const here = dirname(fileURLToPath(import.meta.url));
const site = resolve(here, '..');
const args = process.argv.slice(2);
let vault = resolve(site, '../book-universe');
const vi = args.indexOf('--vault');
if (vi >= 0) { vault = resolve(process.cwd(), args[vi + 1]); args.splice(vi, 2); }
{ const i = args.indexOf('--out'); if (i >= 0) { process.env.WV_OUT = args[i + 1]; args.splice(i, 2); } }
const demo = args.includes('--demo'); if (demo) args.splice(args.indexOf('--demo'), 1);
let worlds = args;
if (worlds.includes('--all') || worlds.length === 0) {
  worlds = readdirSync(vault).filter((d) => !d.startsWith('_') && !d.startsWith('.') && statSync(join(vault, d)).isDirectory() && existsSync(join(vault, d, 'World.md')));
}
if (!worlds.length) { console.error(`No worlds found in ${vault} (a world is a folder with World.md).`); process.exit(1); }

const out = process.env.WV_OUT ? resolve(process.cwd(), process.env.WV_OUT) : join(site, 'dist', 'data');
mkdirSync(out, { recursive: true });
export const slug = (s) => s.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

const indexFile = join(out, 'worlds.js');
let index = [];
if (existsSync(indexFile)) {
  try { index = JSON.parse(readFileSync(indexFile, 'utf8').replace(/^[^=]*=\s*/, '').replace(/;\s*$/, '')); } catch { index = []; }
}

for (const world of worlds) {
  const dir = join(vault, world);
  if (!existsSync(join(dir, 'World.md'))) { console.error(`✗ ${world}: no World.md in ${dir}`); process.exitCode = 1; continue; }
  const input = readWorldFolder(dir);
  const model = parseWorld({ world, ...input });

  // Thumbnails: keep the site fast and the data file self-contained relative to dist/.
  const imgDir = join(out, slug(world), 'img');
  rmSync(imgDir, { recursive: true, force: true });
  mkdirSync(imgDir, { recursive: true });
  model.imageUrls = {};
  const used = new Set();
  for (const e of Object.values(model.entities)) [e.image, e.mapImage, ...e.portraits.map((p) => p.image), ...e.gallery].filter(Boolean).forEach((p) => used.add(p));
  let n = 0;
  for (const p of used) {
    const name = `${String(n++).padStart(3, '0')}-${slug(basename(p).replace(/\.\w+$/, ''))}.webp`;
    try {
      const isMap = Object.values(model.entities).some((e) => e.mapImage === p);
      await sharp(join(dir, p)).rotate().resize({ width: isMap ? 2400 : 640, height: isMap ? 2400 : 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(join(imgDir, name));
      model.imageUrls[p] = `data/${slug(world)}/img/${name}`;
    } catch (err) {
      model.warnings.push({ kind: 'image', path: p, msg: err.message });
    }
  }

  const file = `${slug(world)}.js`;
  writeFileSync(join(out, file), `(window.WORLDS ??= {})[${JSON.stringify(world)}] = ${JSON.stringify(model)};\n`);
  const cov = coverage(model);
  const entry = {
    name: world, file, vault: basename(vault), demo,
    generatedAt: model.generatedAt,
    title: model.entities[model.worldEntity]?.title ?? world,
    image: model.imageUrls[model.entities[model.worldEntity]?.image] ?? Object.values(model.imageUrls)[0] ?? null,
    stories: Object.keys(model.stories).length, chapters: cov.chapters, characters: cov.characters,
  };
  index = index.filter((w) => w.name !== world).concat(entry).sort((a, b) => Number(a.demo) - Number(b.demo) || a.name.localeCompare(b.name));
  console.log(`✓ ${world}: ${Object.keys(model.entities).length} notes, ${cov.chapters} chapters, ${cov.characters} characters, ${used.size} images → ${join(out, file)}`);
  console.log(`  coverage: rel tags ${cov.withRel}/${cov.characters} · at tags ${cov.withAt}/${cov.characters} · images ${cov.withImage}/${cov.characters} · voice ${cov.withVoice}/${cov.characters} · chapters with cast ${cov.chaptersWithCast}/${cov.chapters}`);
  const byKind = model.warnings.reduce((a, w) => ((a[w.kind] = (a[w.kind] ?? 0) + 1), a), {});
  if (model.warnings.length) {
    console.log(`  warnings: ${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    for (const w of model.warnings.slice(0, 15)) console.log(`    - ${w.kind}: ${w.path} — ${w.msg}`);
    if (model.warnings.length > 15) console.log(`    … ${model.warnings.length - 15} more (see the viewer's coverage drawer)`);
  }
}
writeFileSync(indexFile, `window.WORLD_INDEX = ${JSON.stringify(index, null, 1)};\n`);
