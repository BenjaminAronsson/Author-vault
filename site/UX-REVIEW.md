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
| 1.11 | WorldMap duplicates PanZoom's gesture code. | Low | Open: it got the same touch fix, but should reuse PanZoom |
| 1.12 | On phones the Timeline could open the list (TimelineList) by default instead of the chart. | Low | Open |

## 2. Present vs. talked about

| # | Finding | Sev | Status |
|---|---|---|---|
| 2.1 | Chapter `characters:` mixed people on scene with people only named, so "On stage now", Storylines and co-appearance treated someone who was only talked about as present. | High | Fixed: `characters` / `places` now mean on scene, and `mentioned` / `mentioned_places` hold the rest |
| 2.2 | Every timeline line counted the person as on stage, and an `at:` moved them there. | High | Fixed: `presence:mentioned` / `presence:remembered` keeps them off stage and leaves their whereabouts alone |
| 2.3 | Nothing in the UI showed who was talked about. | Med | Fixed: a "Talked about" list on Home and Reader, and "talked about:" on Timeline cards (italic, muted) |
| 2.4 | Agents had no rule for this. | High | Fixed: chronicler, character-psychologist and genealogist each have a rule with an example |
| 2.5 | Existing worlds still list mentioned people as present. | Med | Open: a re-extract fixes them. A lint hint ("in `characters:` but no timeline line here") would help find them. |

## 3. Images

| # | Finding | Sev | Status |
|---|---|---|---|
| 3.1 | A photo could only belong to one note, and nothing could be tagged. | High | Fixed: **Media notes** with `depicts`, `place`, `event`, `date`, `caption`, `source`, and optional face `regions` |
| 3.2 | There was no way to bring in a folder of family photos. | High | Fixed: `vault add-media` compresses to WebP (2000 px max, q80, EXIF date), writes the notes and commits |
| 3.3 | Pictures inside .docx files were only linked in the source. | Med | Fixed: the genealogist patch's `media[]` tags them, once each |
| 3.4 | `gallery:` was parsed but never shown. | Med | Fixed: the Photos section on person and entity pages, a strip in the quick card, photos on their date step, and a lightbox |
| 3.5 | Images were matched by file name only, so two `portrait.webp` files collided. | Med | Fixed: matched by path first |
| 3.6 | Performance. | — | Thumbnails (640 px) load lazily, and the 1600 px version loads only in the lightbox |
| 3.7 | Tagging people inside the viewer (click a face to add a region, drag-drop a photo to make a Media note) | Med | Open: regions are displayed but have to be written in the note |

## 4. Family tree

| # | Finding | Sev | Status |
|---|---|---|---|
| 4.1 | Each generation was centred on its own, so parents didn't sit over their children and lines crossed. | High | Fixed: subtree-width layout (`lib/familyLayout.js`) with each couple centred over its own children |
| 4.2 | Two curves per child, with half-siblings interleaved. | High | Fixed: one bus per couple (drop → bar → stubs). Each marriage's children sit under it, first marriage on the left. |
| 4.3 | Siblings were never drawn. | Med | Fixed: shown beside the person in the Tree style |
| 4.4 | There was only one layout. | Med | Fixed: **Tree / Descendants / Ancestors** (a left-to-right pedigree). The choice is remembered. |
| 4.5 | The tree height was `window − 330`, a guess. | Low | Fixed: measured down to the time bar |
| 4.6 | A fan chart for deep pedigrees, and collapsing branches | Low | Open |
| 4.7 | Tests | — | `test/familyLayout.test.js`, with every Norrgården person as focus: no overlaps, couples over their children, no interleaving |

## Other notes
- The first load of a world, and switching worlds, can block the page for several seconds. The browser tooling timed out more than once. Worth profiling (the parse worker and the snapshot build).
- The tour opens on every fresh device, including deep links like `#view=family`. It could skip itself when the URL points somewhere specific.
