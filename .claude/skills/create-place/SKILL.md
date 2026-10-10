---
name: create-place
description: Create a new place in an existing world — a city, village, tavern, ruin, room, forest, realm — with geography, history and legend, atmosphere, who lives there, daily rhythm and secrets, woven into existing characters, factions and events. Use when the user wants to invent/add a location or place.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-place

Arguments: `$ARGUMENTS` → World and an optional seed idea ("the drowned chapel under the mill pond").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (rules, history & myths, daily life, sensory palette), `Concepts/Glossary.md`, the relevant `Cultures/` and `Languages/` (names must follow their naming conventions), and look through Places, Factions and Characters. The place has to fit the world's geography, climate, technology and tone.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Where & how**: what it's part of, what it contains, how to get there, landscape and architecture.
   - **Atmosphere**: smell, sound and light, at different times of day and in different seasons. Use the world's sensory palette.
   - **History** and **legend**: these may differ.
   - **Who is here**: residents and regulars, who rules it, who is unwelcome, plus its daily rhythm.
   - **Ties**: which existing characters have memories here, and which factions claim it or want it.
   - **Secrets & hidden places.**
   If the user says "surprise me", build it from the seed, open Threads, Rumours and Tensions in motion, then show it for approval.
3. **Write** `Places/<Name>.md` (template `location.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Characters tied to it get a Timeline entry, a line in Daily life where it fits, and optionally a memory told in their voice (`memories/`).
   - Factions that claim it get it under Territory, and if it's contested, under Tensions.
   - Parent and child places get a link both ways. Its legend goes into `World.md ## History & myths` or `## Rumours`. Add any new names to the Glossary.
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/create-plot` set here, or `/become` someone who remembers it.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).

**Write it with the tool, not by hand:**
1. Put the result in a patch (same format as extraction: `entities`, `timeline`, `rows`, `items`, `paragraphs`, `memories`, `perspectives`, `glossary`) at `book-universe/<World>/.vault/patches/create-<slug>.json`.
2. Apply it:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter <placement, e.g. B1-C05> --canon expansion
   ```
   The tool creates notes from the templates, adds relations on both sides, and keeps the exact format.
3. Only prose sections that don't fit the patch format (e.g. a long legend) may be edited directly, by appending to the note the tool created.
