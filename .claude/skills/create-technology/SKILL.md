---
name: create-technology
description: Create a new technology for a world — tool, machine, weapon, vehicle, medicine, method, energy source, communication — with how it works, sensory presence, materials and making, limits and failure, who has it, how it changed life, dangers, slang, variants, lineage and makers — consistent with the world's technology level. Use when the user wants to invent/add technology, a machine, device, invention, weapon type, vehicle or engineering.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-technology

Arguments: `$ARGUMENTS` → World and an optional seed idea ("tide-driven mills that grind grain and pump the mines").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md ## Rules` (especially the **technology level**), `Technology/`, `Magic/` (if tech and magic mix), `History/`, `Cultures/`, `Factions/`, `Languages/` (naming conventions), and the Glossary. **Collect every tool, machine and method the book shows.** That's fixed canon, and the new technology must fit next to it.
   - If it goes beyond the world's technology level, say so. Offer a version that fits (cruder, rarer, a secret prototype, a lost relic of an earlier era), or raise the level on purpose by asking the user, recording it as an event in History, and checking consequences. A what-if continuity is also an option.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Domain, maturity, availability**, and when it was introduced.
   - **How it works** (as understood in-world), plus **materials, energy & making**: who can build and repair it, and the cost.
   - **Sensory presence**: noise, smoke, smell, how it feels to use. This is what makes it real on the page.
   - **Limits & failure**: breakdowns, maintenance, accidents.
   - **Who has it**, and **how it changed life**: work, war, travel, class, jobs gained and lost.
   - **Dangers & ethics**, **words & slang**, **variants**, **lineage** (what it came from, what it makes possible next).
   - **Faith & folklore**: wonder, fear, heresy.
   If the user says "surprise me", build it from the seed and the world's level, resources and tensions, then show it for approval with a short scene of someone using it, written in the book's style.
3. **Write** `Technology/<Name>.md` (template `technology.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Update `World.md`'s technology level and `## Daily life` where it changed things.
   - **Makers and users**: Skills & flaws (Technology), Daily life, the slang in voice.md, a Timeline line.
   - **Factions** (guilds, monopolies, opponents), **places** (workshops, mines, ports: their sounds and smells), **items** (individual machines and weapons), **cultures and religions** (how they see it).
   - Its invention and spread go into `History/` (Chronology, Era legacy). Terms go into the Glossary.
4. Run **continuity-keeper**, especially the anachronism check across all notes.
5. Suggest next steps: `/create-character` for an inventor or operator, `/create-plot` about what it disrupts, or `/create-event` for its first use or disaster.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
