---
name: expand-story
description: Write new story content in a vault world — a side story from a chosen thread, new scenes for an existing story, a prequel/sequel, or a what-if branch — in the book's style and the characters' voices, then feed it back into the vault so characters and world grow. Use when the user wants to expand, continue, write or branch a story.
argument-hint: <World> <"Plot" | "Thread" | premise> [continuity]
---
# /expand-story

Arguments: `$ARGUMENTS` → World, a Plot or Thread name or a free-text premise, and an optional continuity.

## 1. Frame it (with the user)
Read `_system/SCHEMA.md`, the Thread note (if given) and its anchors. Agree on:
- **Type**: side story (fits `main`), new scenes inside an existing story, prequel or sequel, or a **what-if** (a new branch continuity `what-if-<slug>`, forked at a named chapter).
- **Placement**: between/after which book chapters. This sets what every character knows.
- **POV and length**: the POV character(s) and the number of chapters.
- **Story id**: e.g. `side-<slug>`. Create `Stories/<id>/Story.md` with `canon: expansion`, `origin: expand`, continuity, placement, `based_on: [[Thread]]`.
Set the thread to `status: in-progress`.

Check that `Style.md` exists for the source story. If it doesn't, build it from 2–3 source chapters first (template `style.md`), with verbatim sample passages.

## 2. Plan
If a **Plot note** was given, its structure is the starting point: turn it into chapter beats and skip anything already agreed. Set the plot to `status: in-progress` (and to `written` at the end, with a link under `## Written as`).

Draft a beat outline for each chapter: goals in conflict, the turning point, what changes for each character (goals, fears, dreams, relations), and how it respects the thread's canon constraints. Show it to the user and adjust. Nothing gets written until the outline is approved.

## 3. Write, chapter by chapter
For each chapter:
a. Run the **story-weaver** agent with the world, story id, chapter, continuity, placement, the thread and the approved beats.
b. Show the user the chapter (or the opening, if it's long) and ask: keep, revise (with notes), or rewrite. Revise by sending the notes back to story-weaver.
c. When it's kept, feed it back through the extraction team: run **chronicler**, then **character-psychologist** + **worldbuilder** in parallel, then **continuity-keeper**. Use the source `Stories/<id>/Text/Cxx.md` and tell the agents that **everything they write is `canon: expansion`, `origin: expand`**, with citations `[[<id>-Cxx]]`. This is how the characters remember the side story and grow from it.

## 4. Close
Set the thread to `status: written` and link it under `## Written as`. Summarise how the characters and the world changed, and suggest `/become` with someone from the story at its end point.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "<story> chapter written"` (local only, never pushed).
