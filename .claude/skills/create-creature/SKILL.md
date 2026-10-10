---
name: create-creature
description: Create a new creature, beast, monster, spirit, plant or non-human people for a world — body, senses, behaviour, life cycle, signs of presence, weaknesses, uses, folklore vs truth, its place in culture and faith, and encounters — woven into places, cultures, items and characters. Use when the user wants to invent/add a creature, animal, monster, beast, spirit or species.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-creature

Arguments: `$ARGUMENTS` → World and an optional seed idea ("something in the mill pond that sings at dusk").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (Rules, Sensory palette, Rumours), `Creatures/`, the likely habitat `Places/`, and `Cultures/`, `Religions/`, `Languages/` (names in different tongues). **Collect what the book already says about it**, including rumours. The creature must fit the world's rules and ecology: what it eats has to exist, and its magic has to obey the magic rules.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Category, sapience, rarity, habitat.**
   - **First impression**: what you see, hear and smell first, and the moment you know it's there. Use the world's sensory palette.
   - **Body**, **senses & abilities** (confirmed, rumoured or false), **behaviour**, **life cycle**.
   - **Signs of presence**: tracks, smells, the silence of birds.
   - **Weaknesses**, and how people hunt, ward off, tame or appease it. **Uses**: hide, venom, mounts, medicine.
   - **Folklore vs truth**: what people say, who says it, and how true it is. **In culture & faith**: sacred, cursed, a curse word, a children's tale.
   If the user says "surprise me", build it from the seed and the world's gaps and rumours, then show it for approval with a short encounter scene told the way the book would tell it.
3. **Write** `Creatures/<Name>.md` (template `creature.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - **Habitat places**: Atmosphere, Secrets, Daily rhythm. **Cultures and religions**: folklore, taboos, symbols. **Items** made from it are linked.
   - **Characters** who met it get an Encounter row, a Timeline line, a memory in their voice, and maybe a new Fear. Curses or sayings that involve it go into voice.md.
   - **Named individuals** that matter get character notes with `species:`. Rumours about it go into `World.md ## Rumours`, its names into the Glossary.
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/create-event` for an encounter, `/create-plot` (a hunt, a plague, a bond), or `/become` someone who survived it.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
