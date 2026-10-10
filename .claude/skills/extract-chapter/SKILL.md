---
name: extract-chapter
description: Extract story, world and characters from imported chapters into the Obsidian vault using the chronicler, character-psychologist, worldbuilder and continuity-keeper agents. Use when the user wants to process/extract/analyse chapters of an imported book.
argument-hint: <World> <story> [Cxx | Cxx-Cyy | all | next]
---
# /extract-chapter

Arguments: `$ARGUMENTS` → World, story id, range (default `next`).

Chapters are processed **strictly in order**, one at a time. Each chapter builds on the state left by the previous ones, so timelines and memories grow the way they do in the story.

0. **Big ranges: preview first.** If the range is more than about 15 chapters, show the chapter count, total words (from the source files) and a rough token estimate (words × 1.35 × 6). Ask before starting.
   - The bulk agents (chronicler, character-psychologist, worldbuilder, continuity-keeper) run on a cheaper model, set by `model:` in their frontmatter.
   - Work goes book by book, and `extracted_through` lets you stop and resume at any point.
1. Read `book-universe/_system/SCHEMA.md` and `book-universe/<World>/Stories/<story>/Story.md`. Work out which chapters to process from the range and `extracted_through` (`next` and `all` start after `extracted_through`). If a chapter is earlier than `extracted_through`, warn the user that this is a re-extraction (allowed, but the append-only rule still applies).
Book sources are in `<World>/_sources/<story>/Cxx.md`. For expansion stories (`canon: expansion` in Story.md), the source is `<World>/Stories/<story>/Text/Cxx.md`, and every agent must tag what it writes `canon: expansion`, `origin: expand`.

2. For each chapter `Cxx`, source = `book-universe/<World>/_sources/<story>/Cxx.md`:
   a. Run the **chronicler** agent with the world, story, chapter id `<story>-Cxx` and the source path. Wait for its report.
   b. Run **character-psychologist** and **worldbuilder** **in parallel** (a single message with two Agent calls). Give each one the world, story, chapter id, source path and the full chronicler report.
   c. Run **continuity-keeper**, scoped to the notes touched in this chapter.
   d. Set `extracted_through: Cxx` in Story.md.
   d2. Commit: `tools/world-repo.sh commit <World> "<story>-Cxx extracted: <one-line summary of what changed>"`. One commit per chapter makes the world's history readable and easy to undo.
   e. Give the user a one-line progress update: chapter, new or updated characters, and any open contradictions.
3. After the range is done, summarise: new characters, big changes to goals, fears, dreams or relations, new world rules, and the judgment calls continuity-keeper flagged.

For long ranges, keep going without asking between chapters, unless an agent reports a blocking problem (unreadable source, ambiguous identity it couldn't resolve).
