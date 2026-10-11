---
name: import-archive
description: Import genealogy research (släktforskning) — a folder of .txt/.docx/.md/.pdf files with transcribed records, letters, memoirs and notes — into a genealogy world, where the timeline is real dates and kinship drives a family tree. Re-run it on a growing folder to add only new or changed files. Use when the user wants to add family-history / genealogy / släktforskning files, not a book.
argument-hint: <folder-or-files> <World>
---
# /import-archive

Arguments: `$ARGUMENTS` → a folder (or files) and the World name. Files usually live in `inbox/` (never committed).

A genealogy world has no chapters. Each file is a **source**, cited as `[[arkiv-Cxx]]`, and the viewer's clock is the **dates** the sources mention. See `SCHEMA.md › Archive & kinship`.

1. **New world?** If the world doesn't exist yet, create it as a genealogy world:
   ```
   node tools/vault.mjs init-world "<World>" --kind genealogy
   ```
   An existing *book* world can't become a genealogy world. Suggest a new world instead.
2. **Add the files:**
   ```
   node tools/vault.mjs add-archive "<World>" "<folder-or-files>"
   ```
   - .docx is converted with the standard library, and .txt in old encodings (cp1252) is handled.
   - Old `.doc` files are skipped: ask the user to save them as `.docx`.
   - Files already imported with identical content are skipped. A changed file becomes a new source marked as a new version of the old one, which stays read-only.
   - Originals are kept in `_sources/arkiv/original/`.
   - Photos and scans embedded in .docx files are kept in `_assets/sources/`.
3. **Commit:** `tools/world-repo.sh commit "<World>" "Archive: <n> files added"`.
4. **Tell the user** how many files and words were added, and what extraction will cost:
   ```
   node tools/vault.mjs plan "<World>" arkiv all
   ```
   Genealogy uses one agent per file, and the estimate already accounts for that.
5. **Next:** `/extract-chapter <World> arkiv all`, then `/world-check <World>` (possible duplicates, kinship and date conflicts), then `/visualize <World>`. The viewer opens with a time axis and a **Family** tab.

## Export
`node tools/vault.mjs export-gedcom "<World>" [file.ged]` writes a GEDCOM file for Disgen, MyHeritage, Holger and similar programs. It includes people, families, sources and dates with ca/före/efter. Living people are left out unless `--include-living` is given.

## Privacy
- People marked `living: true` are hidden in the viewer unless the user shows them.
- To share a copy of the data, use `node site/scripts/build-data.mjs --redact-living "<World>"`.
- World repos are never pushed.
