---
name: create-magic
description: Create a magic system for a world — its source, who can use it, how it's done, numbered laws, costs, limits, backlash, sensory signature, disciplines and techniques, training, place in society, folklore, history, practitioners and mysteries — as binding rules that stories, characters and continuity checks obey. Use when the user wants to invent/add magic, a magic system, powers, spells, sorcery, alchemy or witchcraft.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-magic

Arguments: `$ARGUMENTS` → World and an optional seed idea ("magic paid for with memories").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md ## Rules`, the existing `Magic/`, and `Religions/`, `Cultures/`, `Creatures/`, `History/`, the Glossary. **Collect every working the book shows**: who did it, how, at what cost, with what effect, and what it looked like. That's fixed evidence the system must explain.
   - If the world's Rules say there is no magic, stop. Offer a version that fits (alchemy, folk belief that only *might* work, a magic that has been lost), or a what-if continuity.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Hardness**: hard (clear rules readers can predict, for magic that solves plot problems) or soft (wonder and mystery, for magic that creates them). This decides how much of the rest gets pinned down.
   - **Source** and **access**: who can use it, and how that's discovered.
   - **How it's done**: words, gestures, ingredients, focus objects, time.
   - **Laws**: numbered, 3–7 to start.
   - **Costs**: every use takes something. Make the cost personal enough to hurt characters.
   - **Limits**: what it can never do. Stories live in these.
   - **Failure & backlash.**
   - **Sensory signature**: how it looks, sounds, smells and feels, and the traces it leaves.
   - **Disciplines & techniques**, **training & ranks**.
   - **In society**: law, status, economy, forbidden uses.
   - **Faith & folklore** (link Religions), **items, places and creatures**, **history**.
   - **Mysteries**: what stays unknown. Leave room.
   Test it with the user in 2–3 quick scenarios ("Mara is wounded and alone — what can magic do, and what does it cost her?"). Adjust the laws until the answers feel right.
   If the user says "surprise me", build it from the seed and the world's tone, history and religions, then show it for approval with one short working written as a scene in the book's style.
3. **Write** `Magic/<Name>.md` (template `magic.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Add a summary of the laws to `World.md ## Rules` and the everyday side to `## Daily life`.
   - **Practitioners**: `magic:` set, skill, signature and costs paid in Skills & flaws, incantations in voice.md, a Timeline line for when they learned or awakened it. Costs paid can become wounds or fears.
   - **Factions** (schools, orders, hunters), **religions** (blessing or heresy), **places** (strong or dead zones), **items** (foci, artifacts) and **creatures** get linked and updated.
   - Its discovery, catastrophes and bans go into History. Terms go into the Glossary.
4. Run **continuity-keeper** on the whole world. Check that every existing working in the book and expansion notes obeys the new laws. Report conflicts and suggest fixes to the *laws* before touching book canon.
5. Suggest next steps: `/create-plot` that pushes its limits or costs, `/create-character` for a practitioner, or `/become` someone who paid its price.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
