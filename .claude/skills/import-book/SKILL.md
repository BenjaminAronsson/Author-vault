---
name: import-book
description: Import a book (epub, pdf, txt, md) into the vault — convert to markdown, split into chapters under <World>/_sources, and scaffold the World and Story notes. Use when the user wants to add/import a new book, story, version or side story.
argument-hint: <book-file> <World> [story-id]
---
# /import-book

Arguments: `$ARGUMENTS` → book file, World name, optional story id (e.g. `B1`, `sidestory-wolves`).

Book files usually live in `inbox/` (never committed). Check `inbox/` if the user just names a book.

1. Read `book-universe/_system/SCHEMA.md`.
2. If the story id is missing, ask for it. Also ask for the title, the reading `order`, the `continuity` (default `main`), and whether this is an alternate version of an existing story.
3. Convert and split:
   ```
   python3 -I .claude/skills/import-book/convert.py "<file>" "book-universe/<World>/_sources/<story>"
   ```
   Keep the original file next to the sources, never in the repo (`.gitignore` excludes `book-universe/*`, epub and pdf).
   - **Single book**: the script prints its chapters (`Cxx · words · heading — title`). If the splits look wrong (a prologue merged in, parts treated as chapters, chapters missing), rerun with `--pattern '<regex>'` that matches this book's headings, or fix the boundaries by hand.
   - **Omnibus / collected edition**: if chapter numbering restarts, the script splits it into books `B1…Bn` (subfolders plus `books.tsv` with titles, chapter counts and words). Titles come from a master contents list when one exists. Each book's copyright page, contents list and epigraphs go to its `_front.md`, not into chapters.
     - Show the book table and **ask the user to confirm** the books and titles, and which to import. They may only want some.
     - For each confirmed book, move `Bk/` to `<World>/_sources/<story-id>/` (e.g. `B1`, `B2`…, or the user's ids) and create its own `Story.md` with `order` 1…n.
     - Example (tested): a 3,623-page Harry Potter omnibus PDF split into 7 books, all titled correctly from the master contents, and 199 chapters, all correct.
   Show the final chapter list to the user.
4. Detect the book's **language** and **POV style** from the first chapter.
5. Scaffold from `_system/templates/` (only what's missing):
   - `book-universe/<World>/World.md` (world.md)
   - `book-universe/<World>/Stories/<story>/Story.md` (story.md): fill story_id, title, order, continuity, language, pov_style, and `extracted_through: ""`
   - the folders `Characters/ Places/ Factions/ Items/ Concepts/ Events/ History/ Cultures/ Languages/ Religions/ Creatures/ Magic/ Technology/ Plots/ Threads/ Expansions/`, plus `Concepts/Glossary.md` and `History/Chronology.md` (template `chronology.md`)
   - add the story to `World.md` frontmatter `stories` and to `## Stories`
5b. **Version the world:** if it's new, run `tools/world-repo.sh init <World>` to create its local repo, which can never be pushed. Then commit the import: `tools/world-repo.sh commit <World> "Imported <title> (<n> chapters)"`.
6. Tell the user the size and the next step. For big imports, say what extraction will cost before suggesting it:
   - **Words** come from the index. Source tokens ≈ words × 1.35.
   - **Extraction** reads every chapter about 3 times (chronicler, psychologist and worldbuilder), plus existing notes for context. Estimate roughly **5–8 × the source tokens** in total.
   - **Example:** a 1.1 M-word omnibus is about 1.5 M source tokens, so roughly 8–12 M tokens for full extraction.
   - **Recommend going book by book:** `/extract-chapter <World> B1 all`. Check the result in `/visualize`, then continue.
