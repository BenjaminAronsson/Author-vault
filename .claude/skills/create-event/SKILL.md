---
name: create-event
description: Create a new event in a world — a battle, betrayal, wedding, disaster, discovery, crime, festival, a moment in a character's past — with causes, what really happened, the versions people tell, consequences and the memories each participant carries. Use when the user wants to invent/add an event, incident or moment (past or during the story).
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-event

Arguments: `$ARGUMENTS` → World and an optional seed idea ("the night the mill burned, ten years before B1").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md`, `History/Chronology.md`, and the notes on the likely participants, places and factions.
2. **Shape it with the user**, a few questions at a time:
   - **When**: an in-world date or era, or between which chapters. This sets what everyone knows before and after it. Check that it doesn't collide with the Chronology or with characters' timelines (someone can't be in two places at once, or be there before they're born).
   - **Scale**: personal, local, regional or world.
   - **What really happened**, step by step, with sensory detail.
   - **Causes**: which goals, fears, tensions or earlier events led here.
   - **Who** took part and who witnessed it, which places, factions and items were involved.
   - **Versions told**: how different people or factions tell it.
   - **Consequences**: immediate and long-term, and which goals, fears, dreams and relations change.
   - **Traces left**: scars, ruins, songs, laws, taboos, objects.
   If the user says "surprise me", build it from the seed, the characters' wounds and secrets, and the Tensions in motion, then show it for approval.
3. **Write** `Events/<Event>.md` (template `event.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - **Each participant and witness** gets a **memory** in `memories/`, told in their voice. Memories differ: set `accuracy` and fill in Divergence from objective. They also get a Timeline entry, and updates to Goals, Fears, Dreams, Relations and Inner life where the event changed them (wounds especially).
   - Places, factions and items involved get a Timeline entry, and Traces where they apply.
   - Add the event to `History/Chronology.md`, and to the Era note if it's historical. Add its versions to `World.md ## Rumours` or `## History & myths` when they've spread.
4. Run **continuity-keeper** on the touched notes.
5. Suggest a next step: `/become` a participant and ask them about that night.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).

**Write it with the tool, not by hand:**
1. Put the result in a patch (same format as extraction: `entities`, `timeline`, `rows`, `items`, `paragraphs`, `memories`, `perspectives`, `glossary`) at `book-universe/<World>/.vault/patches/create-<slug>.json`.
2. Apply it:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter <placement, e.g. B1-C05> --canon expansion
   ```
   The tool creates notes from the templates, adds relations on both sides, and keeps the exact format.
3. Only prose sections that don't fit the patch format (e.g. a long legend) may be edited directly, by appending to the note the tool created.
