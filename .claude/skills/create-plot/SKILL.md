---
name: create-plot
description: Design a new plot (side story, subplot, prequel, sequel, mystery, what-if…) in a world — premise, theme, stakes, cast goals, turning points, clues and consequences — grounded in characters' goals/fears/dreams and canon. Produces a Plot note that /expand-story can write from. Use when the user wants to create, outline or brainstorm a plot or storyline.
argument-hint: <World> ["Thread" | premise] [image=<path>]
---
# /create-plot

Arguments: `$ARGUMENTS` → World, plus an optional Thread or free-text premise.

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (Tensions in motion, Rumours, History & myths), the existing `Plots/` and `Threads/`, and the notes of the likely cast: their **goals, fears, dreams and relations** drive the plot.
2. **Find the engine with the user.** Ask a few questions at a time and suggest options:
   - **Kind and placement**: side story, subplot, prequel, sequel, mystery or what-if. Where it sits in the timeline, and which continuity (a what-if forks into `what-if-<slug>`).
   - **Premise**: who wants what, what stands in the way, what's at stake. Prefer conflicts that grow out of characters' existing goals and fears, opposing relations, or the world's tensions.
   - **Theme**: what it's really about underneath.
   - **Cast**: what each character wants in this plot, which fear it touches, and how they change. New characters and objects can be created along the way with `/create-character` and `/create-object`.
   If no premise is given, offer 3 contrasting pitches (one line each), built from the highest-potential Threads and the characters' unmet goals and dreams, and let the user choose.
3. **Structure**: setup, turning points, climax, resolution. Plan where clues and secrets are planted and where they pay off. List the **canon constraints**, then check every beat against them and against what each character knows at that point.
4. **Write** `Plots/<Plot>.md` (template `plot.md`, `canon: expansion`, `origin: created`, `status: outlined`). Link the cast, items, places and any `based_on` Threads. Set those threads to `status: chosen`.
5. Show the outline and revise it with the user. Then suggest `/expand-story <World> "<Plot>"`. Nothing goes into character notes until the plot is actually written. A plot is a plan, not canon.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "Plot <Plot> outlined"` (local only, never pushed).

**Write it with the tool, not by hand:**
1. Put the result in a patch (same format as extraction: `entities`, `timeline`, `rows`, `items`, `paragraphs`, `memories`, `perspectives`, `glossary`) at `book-universe/<World>/.vault/patches/create-<slug>.json`.
2. Apply it:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter <placement, e.g. B1-C05> --canon expansion
   ```
   The tool creates notes from the templates, adds relations on both sides, and keeps the exact format.
3. Only prose sections that don't fit the patch format (e.g. a long legend) may be edited directly, by appending to the note the tool created.
