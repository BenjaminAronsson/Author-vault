---
name: visualize
description: Generate (or refresh) the World Viewer data for a world and open it in the browser — timeline with a reading bookmark, relationship web, character pages, places & history. Use when the user wants to see, visualize, browse or follow a world/story visually, or after extraction/creation to refresh the viewer.
argument-hint: [World | --all]
---
# /visualize

Arguments: `$ARGUMENTS` → a World name (a folder in `book-universe/` that contains `World.md`), or `--all`. If none is given and there is only one world, use it. Otherwise ask.

The site in `site/dist/index.html` is static and built once. This command only regenerates its data file.

1. If `site/node_modules` is missing, run `npm install --prefix site`. If `site/dist/index.html` is missing, run `npm run build --prefix site`.
2. Generate the data:
   ```
   node site/scripts/build-data.mjs <World>
   ```
   This writes `site/dist/data/<world>.js` plus thumbnails, and updates `site/dist/data/worlds.js`.
3. Report the script's **coverage** line and any **warnings** in plain words. For example:
   - "3/40 characters have relation tags. The web falls back to Relations tables for the rest."
   - "12 unresolved links": list a few.
   - YAML errors: say which files.
   If `rel:`/`at:` coverage is low, offer to run the **continuity-keeper** agent to backfill the viewer tags (SCHEMA › Machine-readable timeline tags) on existing Timeline lines, then re-run step 2.
4. Open it: `xdg-open "site/dist/index.html#world=<World>"` (macOS: `open`). The page works straight from the file, with no server.
5. Remind the user of what they can do in the viewer:
   - **Genealogy worlds:**
     - the bookmark moves through dates (zoom: all time or one decade)
     - **Family** shows the tree as of the date, with icons for marriage, adoption, foster and step and line styles for how sure each link is
     - living people stay hidden unless shown
     - `--redact-living` makes a shareable copy of the data, and `vault export-gedcom` exports to other programs
   - **Bookmark:** move it with ← → to where they are in the story. Spoilers after it stay hidden.
   - **Portraits:** drag and drop pictures onto any avatar.
   - **Links back:** "Copy /become" and "Open in Obsidian" on every page.

Without running this command, the user can also use **"Open world folder…"** on the start page to view a world live from disk (Chrome/Edge can also save uploaded portraits straight into the vault).
