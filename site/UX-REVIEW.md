# World Viewer: UX review (2026-10-11)

This review covers every view, checked on the Saltmarrow and Norrgården samples at 390 px (phone) and 1500 px (desktop). Each finding has a severity, its status, and where it was fixed.

Severity:
- **High** breaks a task or misleads.
- **Med** causes friction.
- **Low** is polish.

## 1. Scaling and mobile

| # | Finding | Sev | Status |
|---|---|---|---|
| 1.1 | The shell was `100vh`. On phones the URL bar hid the bottom of the time bar. | High | Fixed: `100dvh` plus safe-area insets |
| 1.2 | Page grids (`.fam`, `.char`, `.ent`, …) had an implicit `auto` column, so a wide tree or table stretched the whole page. The Family toolbar and legend ran off-screen. | High | Fixed: `minmax(0, 1fr)` columns |
| 1.3 | Below 760 px, the canon filters and continuity picker were simply hidden, with no way to filter on a phone. | High | Fixed: they fold out under **⋯**, along with the tour and theme buttons |
| 1.4 | The header took three rows on a phone. | Med | Fixed: one row plus a scrolling nav row, and the world name is truncated |
| 1.5 | Pan/zoom views had `touch-action: none`, so a swipe inside a full-height view couldn't scroll the page. | High | Fixed: `pan-y` on touch (sideways drags and pinches still go to the view), and a new **⤢ full screen** mode takes every gesture |
| 1.6 | Zoom controls sat at 55% opacity until hover, and phones have no hover. They were also tiny. | Med | Fixed: always visible, 2.6 rem on touch |
| 1.7 | The quick card needed a right-click. iOS has no long-press contextmenu. | Med | Fixed: holding a finger on someone for 500 ms opens it. The hints now mention it. |
| 1.8 | The time bar overflowed at 390 px ("Follow…" was cut off). | Med | Fixed: labels and captions hidden, finger-sized ◀ ▶ |
| 1.9 | The timeline used fixed 130 px lanes and a 30 px minimum column. | Low | Fixed: 86 px and 24 px under 600 px wide |
| 1.10 | Heading sizes were fixed, and wide tables pushed the page. | Low | Fixed: `clamp()` headings, tables scroll sideways |
| 1.11 | WorldMap duplicated PanZoom's gesture code. | Low | Fixed: the map uses PanZoom (touch, full screen, keys). Pins dragged in Arrange mode are left to the map. |
| 1.12 | The Timeline chart is too wide for phones. | Low | Fixed: a **List** mode (every step, with summary, cast and who's talked about), the default on phones |

## 2. Present vs. talked about

| # | Finding | Sev | Status |
|---|---|---|---|
| 2.1 | Chapter `characters:` mixed people on scene with people only named, so "On stage now", Storylines and co-appearance treated someone who was only talked about as present. | High | Fixed: `characters` / `places` now mean on scene, and `mentioned` / `mentioned_places` hold the rest |
| 2.2 | Every timeline line counted the person as on stage, and an `at:` moved them there. | High | Fixed: `presence:mentioned` / `presence:remembered` keeps them off stage and leaves their whereabouts alone |
| 2.3 | Nothing in the UI showed who was talked about. | Med | Fixed: a "Talked about" list on Home and Reader, and "talked about:" on Timeline cards (italic, muted) |
| 2.4 | Agents had no rule for this. | High | Fixed: chronicler, character-psychologist and genealogist each have a rule with an example |
| 2.5 | Existing worlds still list mentioned people as present. | Med | Fixed: lint `maybe-mentioned` flags cast members with no timeline line in that chapter, and the continuity-keeper checks the text and moves them to `mentioned:` |

## 3. Images

| # | Finding | Sev | Status |
|---|---|---|---|
| 3.1 | A photo could only belong to one note, and nothing could be tagged. | High | Fixed: **Media notes** with `depicts`, `place`, `event`, `date`, `caption`, `source`, and optional face `regions` |
| 3.2 | There was no way to bring in a folder of family photos. | High | Fixed: `vault add-media` compresses to WebP (2000 px max, q80, EXIF date), writes the notes and commits |
| 3.3 | Pictures inside .docx files were only linked in the source. | Med | Fixed: the genealogist patch's `media[]` tags them, once each |
| 3.4 | `gallery:` was parsed but never shown. | Med | Fixed: the Photos section on person and entity pages, a strip in the quick card, photos on their date step, and a lightbox |
| 3.5 | Images were matched by file name only, so two `portrait.webp` files collided. | Med | Fixed: matched by path first |
| 3.6 | Performance. | — | Thumbnails (640 px) load lazily, and the 1600 px version loads only in the lightbox |
| 3.7 | Tagging people inside the viewer | Med | Fixed: **🏷 Tag people** in the lightbox (drag a box over a face, pick who; × removes). **＋ Add photo** on person, place and event pages in folder mode: compressed in the browser (WebP, 2000 px) into a Media note. Without a folder, tags wait in the browser like map pins. |

## 4. Family tree

| # | Finding | Sev | Status |
|---|---|---|---|
| 4.1 | Each generation was centred on its own, so parents didn't sit over their children and lines crossed. | High | Fixed: subtree-width layout (`lib/familyLayout.js`) with each couple centred over its own children |
| 4.2 | Two curves per child, with half-siblings interleaved. | High | Fixed: one bus per couple (drop → bar → stubs). Each marriage's children sit under it, first marriage on the left. |
| 4.3 | Siblings were never drawn. | Med | Fixed: shown beside the person in the Tree style |
| 4.4 | There was only one layout. | Med | Fixed: **Tree / Descendants / Ancestors** (a left-to-right pedigree). The choice is remembered. |
| 4.5 | The tree height was `window − 330`, a guess. | Low | Fixed: measured down to the time bar |
| 4.6 | Deep pedigrees and big families | Low | Fixed: a **Fan** style (ancestors as rings, father's side left), and fold buttons (▴ ▾) on anyone away from the focus to tuck their branch away (+n brings it back) |
| 4.7 | Tests | — | `test/familyLayout.test.js`, with every Norrgården person as focus: no overlaps, couples over their children, no interleaving |

## Other notes
- **Load time** (measured): Norrgården parses in 22 ms, and a generated 192-chapter world in 32 ms plus 17 ms for snapshots. The production build loads in 0.66 s, and a headless CPU profile of opening the Timeline shows about 0.1 s of work. The freezes seen during this review came from the browser automation: the tab was in the background, where Chrome pauses rendering. They weren't caused by the app. Nothing to fix.
- The tour opened on every fresh device, including deep links like `#view=family`. Fixed: it only opens when you arrive at a world, not when you follow a link into it.

## 5. Error handling and null checks (review 2026-10-11)

Prompted by crashes on the published site when opening the book worlds. Found by mounting the whole viewer on every world (in a test and in a real browser) and stepping the bookmark through every view.

| # | Finding | Sev | Fix |
|---|---|---|---|
| 5.1 | About 20 `{#each}` lists were keyed by text from the notes (quotes, goals, fears, relation rows, rel tags, headings, wikilinks), and notes may repeat those. Svelte stops rendering on a duplicate key: "each_key_duplicate" on Home, People and Timeline. | High | Keyed by position. Link lists (`characters`, `places`, `mentioned`, `events`, `depicts`, `cast`) are deduplicated by the parser, so a person linked twice or through an alias appears once. |
| 5.2 | The relationship web always included its focus, even when the focus wasn't a visible character (hidden, filtered, not a person). With no position, the tween read `.x` of undefined in a loop, plus NaN in SVG. | High | The focus counts only if it's in the web. Nodes and lines are drawn only with a position, and the tween skips anything that can't animate. |
| 5.3 | With an empty timeline (nothing extracted yet, or filters hiding every story), the time bar read chapter −1. | High | A note explains why and how to fix it, and the time bar waits. |
| 5.4 | Startup read `localStorage` directly, which throws when site data is blocked, in some private modes and in sandboxed frames. The whole viewer failed to start. | Med | `lib/storage.js` never throws. The viewer still works, it just doesn't remember. |
| 5.5 | Map edits (move pin, undo, auto-arrange, own map, map image) and photo tagging had no error handling. A refused folder permission failed silently. | Med | Caught. The message says what couldn't be saved. |
| 5.6 | Callers index `model.chapters[cid]` for every step without checking. | Low | Sequences are guaranteed to hold only chapters that exist, checked once where they're built. |
| 5.7 | One broken view took down the whole page. | Med | An error boundary around the views shows what broke, with **Back to Home** and **Try again**. |
| 5.8 | The remembered Family layout could be a style that no longer exists. | Low | Validated against the styles there are. |

**Tests that keep it fixed:**
- `test/render.test.js` mounts the app on the samples, a deliberately messy world, a messy family and an empty world. For each it renders every view at the first, middle and last bookmark, with spoilers hidden and dimmed, plus a person, place and event page, and every family style around everyone. Any thrown error, `console.error` or NaN on screen fails it.
- It also checks the tree hides people born later and marriages that haven't happened yet.
- The test was verified to fail on the original Home bug.
- CI runs `npm test` before every deploy, so these block a broken build from reaching GitHub Pages.

## 6. Family tree follow-ups (user feedback)
| # | Finding | Fix |
|---|---|---|
| 6.1 | The tree showed people and marriages that hadn't happened yet: people with only undated lines counted as always known. | People born after the bookmark are hidden (faded with "show future"). Marriages dated later seat no spouse and draw no ring. |
| 6.2 | The fold button changed from an arrow to a number with no explanation. | **−** hides a branch, **+N** shows N people (the tooltip says "Show 3 children"). |
| 6.3 | At the generation limit the button couldn't open the next generation. | **+N** opens past the limit, one generation at a time, for that branch only. |
