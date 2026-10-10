# World Viewer

A static website for following a vault world visually. It has no backend, and your world never leaves your device.

- **Reading position:** "You've read up to" a book and chapter. Everything later stays hidden. Press ▶ play to step through the story, and **Follow** a character to keep them in focus.
- **Home:** the story so far, who is on stage, relations that changed, open threads.
- **Timeline:** the whole saga as books, zooming into chapters. Side stories and what-if branches, thread and plot loops, and a **Storylines** chart.
- **People:** an asymmetric relationship web, where each side of a line is one person's feeling.
- **Character pages:** goals, fears, dreams, voice, memories vs. what really happened, and what they know now. "Copy /become" lets you talk to them in Claude Code.
- **Places & History:** maps you can arrange (pins, a tray for unplaced places, auto-arrange, maps inside maps, zoom), travelling characters, a travel graph, era bands and a chronology.
- **Reader:** one chapter at a time, in big print.
- **Images:** drop portraits and maps onto the page, including portraits that apply "from this chapter on".
- **Onboarding:** a guided tour on first open. Replay it with **?**.

## Use it
```
npm install
npm run build              # → dist/index.html (one self-contained file) + the Sample world
```
| How | When |
|---|---|
| Open `dist/index.html` (double-click) | Shows the Sample world and any generated worlds |
| `/visualize <World>` in Claude Code, or `node scripts/build-data.mjs <World>` | Generates `dist/data/<world>.js` from `../book-universe/<World>` |
| **Open world folder…** on the start page | Reads a world folder live, with no generating. Chrome/Edge can also save edits (portraits, map pins) back into it |

The page only needs rebuilding when the viewer code changes. New data just needs `build-data` (or the folder button).

## Hosted on GitHub Pages (app only, your world stays private)
`.github/workflows/pages.yml` runs the tests and `npm run build:pages` (→ `../_site/`) on every push to `main` that touches `site/`, then publishes. Only the app and the fictional Sample world are published.

- **Open your world:** use **Open world folder…** on the site and pick your world folder, or the whole vault. It's read and parsed inside your browser. Book text in `_sources/` is skipped.
- **On this device:** the parsed world (with thumbnail-sized images) is kept in this browser's storage. Next time it's one click, or opens straight from a link like `…/#world=MyWorld`. **↻ Refresh** re-reads the folder after you edit in Obsidian. **Forget** removes everything the viewer stored about that world.
- **Privacy lock:** the page carries a Content-Security-Policy with `connect-src 'none'`, so the browser refuses every network request from it. The page cannot send your world anywhere, even by mistake.
- **Edits made on the site** go into *your* folder (Chrome/Edge), or wait in the browser behind **Save to vault / Copy as YAML**. They never reach GitHub.

## Performance
- **Tested at omnibus scale:** a synthetic world of 12 books, 600 chapters, 1,120 characters and about 7,000 notes.
  - **Loading:** opening the folder takes about 3 s, with a progress line. Reopening from this device takes about 0.7 s.
  - **Moving through the story:** a bookmark step takes under 50 ms on every view.
  - **Memory:** about 100–150 MB.
- **How it stays fast:**
  - Parsing runs in a Web Worker.
  - With big casts, the web lays out only the people on screen, and the map shows tokens only for who's on the page (with a count for everyone else).
- **The test worlds** (not committed): `node scripts/make-large-fixture.mjs fixtures/Large/Longsaga`, and `… fixtures/Huge/Omnibus --books 12 --chapters 50 --chars 1600 --memories 6 --voice 600 --images 300 --places 300`.

## Extraction cost (measured)
On *Harry Potter and the Philosopher's Stone*, chapters 1–3 (3.5–4.7k words each):

| | Tokens per chapter |
|---|---|
| Old pipeline (4 agents editing notes) | **458k** (chapter 1, empty vault, and rising as notes grow) |
| Patch pipeline (2 agents plus `tools/vault.mjs`) | **94k / 92k / 96k**, flat as the world grows |

The 7-book omnibus (199 chapters) comes to ≈ **19 M** instead of 90 M+. `node tools/vault.mjs plan` estimates any range.

## Develop
```
npm test                   # parser + frontmatter tests on fixtures/Sample
npm run dev                # dev server (serves dist/data)
npm run build:pages        # GitHub Pages build → ../_site (add --no-demo to leave out the Sample)
node scripts/build-data.mjs [--vault <path>] [--out <dir>] [--demo] <World>|--all
```
- **`src/parser/`:** turns a world folder into a model, and runs in Node, the browser and a worker. `derive.js` computes the reading order per continuity, the state after each chapter, fallbacks and coverage.
- **`src/lib/`:**
  - `store.svelte.js`: global state (bookmark, filters, follow, play), mirrored in the URL hash
  - `loader.js` / `localWorlds.js`: folders and "On this device"
  - `edits.js` / `images.js`: writing back into the vault
  - `motion.svelte.js`: animation
- **`src/views/`, `src/components/`:** the Svelte 5 UI. All UI text is in `src/lib/strings.js`.
- **`fixtures/Sample/Saltmarrow/`:** a tiny world that exercises every feature. `scripts/make-sample-images.mjs` makes its images.

## What the viewer reads
Everything follows `book-universe/_system/SCHEMA.md`. These fields drive the visual features. All are optional, with fallbacks:
- **Timeline tags:** `at:[[Place]]`, `rel:[[X]]=<bond>/<-2..+2>`, `status:`, `goal:"…"=<status>`. Without them, presence comes from each chapter's `characters:`/`places:`, and relations from the Relations tables or from characters appearing together.
- **Stories:** `order:`, `continuity:`, `placement: "after B1-C03"`. Side stories are inserted there, and what-if continuities fork there.
- **Images:** `image:`, `portraits: [{at: B1-C14, file: "[[x.webp]]"}]`, `gallery:`. Files live in `<World>/_assets/…`.
- **Maps:** `map_image:` (an image, or `sketch`) on the world or any place with its own map. `map: {x, y}` (0–1) on a location is its position on its nearest ancestor's map.
- **Threads and plots:** `opened_at:`/`closed_at:` (otherwise the first and last `anchors:`), and `potential:`.
