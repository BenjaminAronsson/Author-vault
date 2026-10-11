import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { createReadStream, existsSync } from 'node:fs';
import { join } from 'node:path';

// In dev, serve the generated data from dist/data (the built site loads it relative to index.html).
const serveData = {
  name: 'serve-data',
  configureServer(server) {
    server.middlewares.use('/data', (req, res, next) => {
      const file = join(process.cwd(), 'dist/data', decodeURIComponent(req.url.split('?')[0]));
      if (!existsSync(file)) return next();
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : 'image/webp');
      createReadStream(file).pipe(res);
    });
  },
};

export default defineConfig({
  plugins: [svelte(), viteSingleFile(), serveData],
  publicDir: false,
  // tests that mount components need Svelte's browser build
  resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
  build: {
    outDir: 'dist',
    emptyOutDir: false, // dist/data holds generated world data — never wipe it
  },
});
