---
name: create-object
description: Create a new object/item/artifact inside an existing world — with origin and legend, properties and rules, a chain of owners, and meaning for the characters who touch it — woven into the existing characters, places and history. Use when the user wants to invent/add an object, item, artifact, weapon, heirloom, relic or document.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-object

Arguments: `$ARGUMENTS` → World and an optional seed idea ("a letter Mara never sent").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (rules, history & myths, daily life), `Concepts/Glossary.md`, the relevant `Cultures/` and `Languages/` (names must follow their naming conventions), and look through Items, Characters and Places. The object has to follow the world's rules: no magic in a world without magic, and the materials and craft of this culture.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - What it is and how it **feels** in the hand: look, weight, smell, sound, wear.
   - **Origin**, and the **legend** that grew around it. The two may differ.
   - **Properties & rules**: what it does, what it costs, its limits. Mark each as confirmed, rumoured or false.
   - **Journey**: who has held it, and where it is now (at a chosen point in the timeline).
   - **Meaning**: what it is to each character who touches it.
   - **Secret**: something about it not yet known.
   If the user says "surprise me", build it from the seed and open Threads, Rumours and Tensions in motion, then show it for approval.
3. **Write** `Items/<Name>.md` (template `item.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - For each holder or character linked to it: a Timeline entry, a Belongings line in Daily life, and if it fits, a memory in `memories/` told in their voice.
   - For places in its journey: a Timeline entry, plus Secrets if it's hidden there.
   - Add any new terms to the Glossary, and its legend to `World.md ## History & myths` or `## Rumours` (expansion-tagged).
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/create-plot` with the object at the centre, or `/become` a holder and ask about it.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
