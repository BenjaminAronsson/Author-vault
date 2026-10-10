#!/usr/bin/env node
// Builds the GitHub Pages site: the viewer app only, no worlds (visitors open their own folder).
// usage: node scripts/build-pages.mjs [--no-demo] [--out <dir>]     (default out: ../_site)
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const oi = args.indexOf('--out');
const out = oi >= 0 ? resolve(process.cwd(), args[oi + 1]) : resolve(site, '../_site');
const demo = !args.includes('--no-demo');

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'data'), { recursive: true });
execFileSync(process.execPath, [join(site, 'node_modules/vite/bin/vite.js'), 'build'], { cwd: site, stdio: 'inherit' });
copyFileSync(join(site, 'dist/index.html'), join(out, 'index.html'));
if (demo) {
  // The fictional Sample world only, never anything from book-universe/.
  execFileSync(process.execPath, [join(site, 'scripts/build-data.mjs'), '--demo', '--vault', join(site, 'fixtures/Sample'), '--out', join(out, 'data'), 'Saltmarrow'], { stdio: 'inherit' });
} else {
  writeFileSync(join(out, 'data/worlds.js'), 'window.WORLD_INDEX = [];\n');
}
writeFileSync(join(out, '.nojekyll'), '');
console.log(`✓ Pages site in ${out} (app only${demo ? ' + Sample demo' : ''})`);
