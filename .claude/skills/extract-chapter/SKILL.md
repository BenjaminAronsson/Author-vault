---
name: extract-chapter
description: Extract story, world and characters from imported chapters into the Obsidian vault. Two agents read each chapter and write JSON patches, and the deterministic `tools/vault.mjs` writes them into the notes, checks continuity and commits. Use when the user wants to process/extract/analyse chapters of an imported book.
argument-hint: <World> <story> [Cxx | Cxx-Cyy | all | next]
---
# /extract-chapter

Arguments: `$ARGUMENTS` → World, story id, range (default `next`).

The agents only **read and understand**. Everything else is done by `node tools/vault.mjs`: context, writing notes, continuity checks, progress and commits. Don't read `SCHEMA.md`, templates or notes yourself during extraction; the tool and the agent prompts already cover them.

## 1. Plan
```
node tools/vault.mjs plan "<World>" <story> <range>
```
- **If it's more than ~15 chapters,** show the plan's chapter count, words and token estimate, and ask before starting.
- **Work book by book.** Progress is saved after every chapter (`extracted_through`), so a run can stop and resume at any point.

## 2. For each chapter `Cxx`, in order
Use `P=book-universe/<World>/.vault/patches` and `mkdir -p "$P"`.
1. **World context:**
   ```
   node tools/vault.mjs context "<World>" <story> Cxx --for world > "$P/<cid>-ctx-a.md"
   ```
2. **Agent `chronicler`.** Give it the world, the `<cid>`, the source path (on the context pack's first lines), the context pack path, and the patch path `$P/<cid>-a.json`. It writes the patch and replies with one line.
3. **Character context, with the chronicler's events:**
   ```
   node tools/vault.mjs context "<World>" <story> Cxx --for characters --events-from "$P/<cid>-a.json" > "$P/<cid>-ctx-b.md"
   ```
4. **Agent `character-psychologist`.** Same inputs, writing `$P/<cid>-b.json`.
5. **Write and check:**
   ```
   node tools/vault.mjs apply "<World>" "$P/<cid>-a.json" --chapter <cid>
   node tools/vault.mjs apply "<World>" "$P/<cid>-b.json" --chapter <cid>
   ```
   - If quotes were rejected (not verbatim), note them. Don't re-run the chapter just for that.
   - If `apply` fails on invalid JSON, ask the same agent once to fix its patch file.
6. **Record and commit:**
   ```
   node tools/vault.mjs done "<World>" <story> Cxx "<one-line summary from the agents' replies>"
   ```
7. **Tell the user one line:** `<cid> ✓ <agent A line> · <agent B line>`. Keep your own conversation small: don't read the patches or notes.

## 3. After the range (or at the end of each book)
1. **Check continuity:** `node tools/vault.mjs lint "<World>"`.
2. **Judgment items:** only if there are any, run **continuity-keeper** once with the judgment list. Mechanical items are listed for the author; they're not worth tokens.
3. **Summarise for the user:** new characters, big changes, rejected quotes, open judgment items. Suggest `/visualize <World>`.
