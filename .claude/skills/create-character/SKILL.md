---
name: create-character
description: Create a brand-new character from nothing inside an existing world — grounded in its places, factions, history and existing characters — with full inner life, relations, memories and a distinct voice. Use when the user wants to invent/add/create a new character.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-character

Arguments: `$ARGUMENTS` → World and an optional seed idea ("a smuggler's daughter who knew Mara as a child").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `<World>/World.md`, `Concepts/Glossary.md`, the relevant `Cultures/` and `Languages/` (names must follow their naming conventions), and the list of characters, places and factions, so the character is **rooted** in this world.
2. **Shape the character with the user.** Ask a few focused questions at a time and suggest options grounded in the world. Don't make them fill in a form. Cover:
   - **Placement**: when they first exist in the timeline (`at <story>/Cxx`) and the continuity.
   - **Roots**: culture and languages (and how they relate to them: proud, exiled, mixed…), where they come from, family, class, faction, which customs they follow or break.
   - **Ties to existing characters**: at least one relation, so they belong in the web.
   - **Goals, fears and dreams** (required), plus the wound and the lie they believe.
   - **Values, how they act under pressure, skills and flaws, daily life, body and senses.**
   - **Voice**: offer 2–3 short sample lines in clearly different voices, let the user choose or adjust, then work out the diction, tics and register from that.
   If the user says "surprise me", build the whole character yourself from the seed and the world's open threads (`Threads/`, Rumours, Tensions in motion), then show it for approval.
3. **Write** the character from the templates, with `canon: expansion` and `origin: created`:
   - `Characters/<Name>/<Name>.md` with every section filled in.
   - `voice.md`: put the agreed sample lines under `## Expansion lines`. The book quote bank stays empty, which is honest.
   - 2–4 **formative memories** in `memories/`, told in their voice. Link them to existing Events where they fit, or create expansion Events.
   - **Reciprocal relations**: add a row (`canon:expansion`) and an `As seen by` perspective on each existing character they're tied to.
   - a Timeline entry `**EXP** · created` placing them in the world.
4. Run **continuity-keeper** on the touched notes, so nothing contradicts book canon.
5. Suggest a next step: `/become <Name>` to hear them talk, or `/expand-story` to give them a story.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "Created character <Name>"` (local only, never pushed).
