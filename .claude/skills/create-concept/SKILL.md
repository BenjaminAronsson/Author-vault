---
name: create-concept
description: Create a new concept in a world — a belief, philosophy, custom, law, language, art form, disease, creature, material — with how it works, its limits and costs, origin, who uses or believes it, its place in daily life, words and sayings, taboos and misconceptions. Use when the user wants to invent/add a concept, system, rule, belief, custom or lore element.
argument-hint: <World> [kind] [seed idea] [image=<path>]
---
# /create-concept

Arguments: `$ARGUMENTS` → World, an optional kind (belief, philosophy, custom, law, art, science, disease, material…), and an optional seed idea ("a mourning custom where the dead's name is never spoken again").

Magic systems, technology, religions, creatures, languages and cultures have their own commands (`/create-magic`, `/create-technology`, `/create-religion`, `/create-creature`, `/create-language`, `/create-culture`). Redirect to them.

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (Rules, Daily life, History & myths), `Concepts/` including the Glossary, and `History/`. **The concept must fit the world's existing rules.** If it would break one (magic in a world without it, technology that's too advanced), stop and say so. Offer either a version that fits, or a what-if continuity.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **What it is** in one breath, in the world's own terms, and its **kind**.
   - **How it works**: the rules and mechanics. For systems like laws or sciences, make them concrete enough that a story can rely on them.
   - **Limits & costs**: the more a story can push against these, the better.
   - **Origin & history**: which era it came from and how it changed. Link it to History.
   - **Who** uses it, believes it, forbids it or exploits it: characters, factions, peoples.
   - **Daily life**: the gestures, words, objects, jobs and holidays that come from it.
   - **Words & sayings**: terms, curses, blessings, proverbs. These feed the characters' voices.
   - **Taboos, conflicts and misconceptions.**
   If the user says "surprise me", build it from the seed and the world's gaps, Rumours and Tensions in motion, then show it for approval.
3. **Write** `Concepts/<Name>.md` (template `concept.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Add its rules to `World.md ## Rules` (expansion-tagged), and its everyday side to `## Daily life`.
   - Add its terms to `Concepts/Glossary.md`.
   - Characters who would use these words get lines in `voice.md ## Expansion lines`. Add a `Values & lines` or `Beliefs` entry where it shapes them, and a Timeline line if they learned or lost it.
   - Factions that use, guard or forbid it get it under Beliefs & codes, Culture or Tensions. Places where it's practised get it under Daily rhythm. Items that embody it are linked.
   - Add its origin to `History/` (Era legacy, Chronology) if it has a datable beginning.
4. Run **continuity-keeper** on the touched notes, checking especially that no existing scene now breaks the concept's rules.
5. Suggest next steps: `/create-plot` that tests its limits, or `/become` a believer (or a skeptic) and ask them about it.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
