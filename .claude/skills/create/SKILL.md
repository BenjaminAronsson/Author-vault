---
name: create
description: Single entry point for creating anything new in a world — character, object, place, faction, event, history, concept, language, culture, religion, creature, plot or story. Figures out the type (from the argument or the idea) and runs the matching create skill. Use when the user wants to create/invent/add something and hasn't named a specific /create-* command, or is unsure what kind of thing it is.
argument-hint: [type] <World> [seed idea]
---
# /create

Arguments: `$ARGUMENTS` → an optional type, the World, and an optional seed idea.

## 1. Work out the type
| Type (and aliases) | Skill |
|---|---|
| character, person, npc, hero, villain | `create-character` |
| object, item, artifact, weapon, relic, heirloom, document | `create-object` |
| place, location, city, village, building, room, realm, region | `create-place` |
| faction, group, guild, house, order, gang, army, council, organisation | `create-faction` |
| event, incident, battle, moment, scene-in-the-past | `create-event` |
| history, era, age, chronology, calendar, timeline, lore of the past | `create-history` |
| magic, magic system, sorcery, spells, powers, witchcraft, alchemy | `create-magic` |
| technology, tech, machine, invention, device, weapon technology, vehicle, medicine, engineering | `create-technology` |
| concept, custom, law, belief, philosophy, disease, material | `create-concept` |
| language, dialect, tongue, names, naming, words | `create-language` |
| culture, people, nation, tribe, ethnicity, way of life | `create-culture` |
| religion, faith, god, pantheon, cult, church, sect, heresy | `create-religion` |
| creature, beast, monster, animal, spirit, species, plant | `create-creature` |
| plot, storyline, arc, outline, mystery | `create-plot` |
| story, chapter, scene, side story, continue, write | `expand-story` |
| ideas, threads, what could I expand | `find-threads` |

- If the type is given or matches an alias, use it.
- If there's no type but there's a seed idea, infer it ("a sword that remembers its owners" → object). When two types fit equally (e.g. "the Drowned Order": faction or religion?), ask with AskUserQuestion. Offer the plausible types, plus "both", which runs one after the other and links them.
- If there's no type and no idea, ask what they want to create. Show the types as options (the 4 most useful given the world's thinnest areas, with "Other" for the rest).
- If no World is given and there's only one World folder in `book-universe/`, use it. Otherwise ask.

## 2. Run it
Invoke the matching skill with the Skill tool, passing `<World> [seed idea]` (and the kind for `create-concept`). Then follow that skill fully.

## 3. Chain
Once it's done, if the new thing naturally calls for another one (a culture with no language, a religion with no holy place, a creature with no habitat, a plot needing a new character), offer the most useful next `/create` in one line. Don't run it automatically.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "Created <type>: <name>"` (local only, never pushed).
