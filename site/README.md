# World Viewer

A static website for following a vault world visually:
- **Bookmark scrubber**: hides spoilers, with a ▶ play button.
- **Home**: "Story so far".
- **Timeline**: chapters, threads and plots, with side stories and what-if branches, plus a **Storylines** chart.
- **People**: an asymmetric relationship web.
- **Character pages**: goals, fears, dreams, voice, memories vs truth, and what they know.
- **Places & History**: a map with pins and character paths (or a travel graph), and era bands.
- **Reader**: a tablet-friendly companion view.
- **Images**: portrait and map uploads.
- **Scale**: built for long sagas (tested with 6 books + side stories, about 200 chapters, about 100 characters). A two-tier bar shows the books and the current book's chapters. Book and chapter pickers say exactly where you are. The timeline zooms from the whole saga to one book. Search jumps with "B3 C12". The web and storylines focus on who is present now.
- **Very large worlds**: tested with a synthetic world the size of a 3,600-page omnibus (12 books, 600 chapters, 1,120 characters, about 7,000 notes). Opening the folder takes about 3 s with progress, reopening from this device about 0.7 s, a bookmark step under 50 ms on every view, and memory about 100–150 MB. Parsing runs in a Web Worker. Big casts lay out only the people on screen, and the map shows tokens only for who's on the page (counts for the rest). Regenerate the test world with `node scripts/make-large-fixture.mjs fixtures/Huge/Omnibus --books 12 --chapters 50 --chars 1600 --memories 6 --voice 600 --images 300 --places 300`.
- **Onboarding**: a 7-step guided tour on first open (replay it with **?**). In Claude Code, `/start` walks a new user to their first world.

## Open it
| How | When |
|---|---|
| Double-click `dist/index.html` | Shows every world that has generated data, plus the Sample world |
| `/visualize <World>` in Claude Code (or `node scripts/build-data.mjs <World>`) | Generates or refreshes `dist/data/<world>.js` — run after extracting or creating |
| **Open world folder…** on the start page | Reads a world folder live. No generation needed. Chrome/Edge can also write uploaded images back into the vault |

The page itself never needs rebuilding for new data. Rebuild only when the viewer code changes: `npm run build` (this also regenerates the Sample world).

## Hosted on GitHub Pages (app only, your world stays private)
The repo publishes **only the viewer app** (plus the fictional Sample world). Your worlds are never committed (`.gitignore` excludes everything in `book-universe/` except `_system/`, and all epub/pdf files) and never uploaded.

- **Open your world:** on the site, use **Open world folder…** and pick your world folder (or the vault). It's read and parsed inside your browser.
- **On this device:** the parsed world (and thumbnail-sized images) is kept in this browser's storage, so next time it's one click, or opens straight from a link like `…/#world=MyWorld`. **↻ Refresh** re-reads the folder after you edit in Obsidian. **Forget** removes everything the viewer stored about that world.
- **Privacy lock:** the page carries a Content-Security-Policy with `connect-src 'none'`, so the browser refuses any network request from it. The page cannot send your world anywhere, even by mistake.
- **Edits made on the site** (portraits, map pins, local maps) are written into *your* folder (Chrome/Edge), or kept in the browser with **Save to vault / Copy as YAML**. They never reach GitHub.
- **Deploy:** `.github/workflows/pages.yml` runs tests and `npm run build:pages` (→ `_site/`) on every push to `main` that touches `site/`, then publishes to Pages. To build locally: `npm run build:pages` (add `--no-demo` to leave out the Sample).

## Develop
```
npm install
npm test                  # parser + frontmatter tests on fixtures/Sample
npm run dev               # live dev server (serves dist/data)
npm run build             # → dist/index.html (single file)
node scripts/build-data.mjs [--vault <path>] [--out <dir>] <World>|--all   # default vault: ../book-universe
node scripts/make-large-fixture.mjs fixtures/Large/Longsaga   # synthetic 6-book saga for scale testing
```

- `src/parser/` turns world folders into a model, and works in both Node and the browser. `derive.js` computes the reading order per continuity, the state snapshots per chapter, fallbacks and coverage.
- `src/lib/store.svelte.js` holds the global state (bookmark, filters, continuity) and mirrors it in the URL hash.
- `src/views/`, `src/components/`: the Svelte 5 UI.
- `fixtures/Sample/Saltmarrow/` is a tiny world that exercises every feature. Its images are made by `scripts/make-sample-images.mjs`.

## What the viewer reads
Everything follows `book-universe/_system/SCHEMA.md`. These parts drive the visual features (all optional, with fallbacks):
- **Timeline tags:** `at:[[Place]]`, `rel:[[X]]=<bond>/<-2..+2>`, `status:`, `goal:"…"=<status>`. Without them, presence comes from the chapter's `characters:`/`places:`, and relations come from Relations tables or from characters appearing together.
- **Stories:** `order:`, `continuity:`, `placement: "after B1-C03"` (side stories are inserted, what-if continuities fork there).
- **Images:** `image:`, `portraits: [{at: B1-C14, file: "[[x.webp]]"}]`, `gallery:` (files in `<World>/_assets/…`).
- **Maps:** `map_image:` (an image or `sketch`) on the world or any place with its own map. `map: {x, y}` (0–1) on locations is a position on their nearest ancestor's map. Arrange mode writes these: drag pins, use the tray, auto-arrange, undo, nested maps.
- **Threads and plots:** `opened_at:`/`closed_at:` (else the first and last `anchors:`), `potential:`.
