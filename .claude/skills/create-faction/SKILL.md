---
name: create-faction
description: Create a new faction in an existing world — guild, noble house, cult, army, gang, council, family clan, movement — with identity, origin, structure, culture, goals, fears, internal tensions, members and relations to other factions. Use when the user wants to invent/add a faction, group, organisation, house or order.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-faction

Arguments: `$ARGUMENTS` → World and an optional seed idea ("smugglers who worship the river").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (rules, history & myths, tensions in motion), the Glossary, the relevant `Cultures/` and `Languages/` (names must follow their naming conventions), and look through Factions, Places and Characters. The faction has to fit the world's power structures and grow out of its tensions.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Identity**: what kind of group it is, its symbols, colours, oaths and greetings, its territory and seats of power, and its resources.
   - **Origin & history**: the version members tell, and the truth.
   - **Structure**: ranks, how you join, how you leave (or can't), punishments.
   - **Culture**: rituals, sayings and slang (feeds the voices of members), dress, what they look down on.
   - **Goals, fears & threats, beliefs & codes, internal tensions**: required.
   - **Members**: existing characters who belong, or used to, or secretly do, plus their loyalty. New key members can be made with `/create-character`.
   - **Relations to other factions**: stance and why.
   If the user says "surprise me", build it from the seed and the world's Tensions in motion and Rumours, then show it for approval.
3. **Write** `Factions/<Name>.md` (template `faction.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Members get the faction in their Relations and a Timeline entry. Add the faction's slang and sayings to their `voice.md ## Expansion lines` where it fits.
   - Rival and allied factions get a reciprocal row in their Relations to other factions.
   - Territory places get the faction under Who is here. Its rise and conflicts go into `World.md ## Tensions in motion` and `## History & myths`. Add its terms to the Glossary.
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/create-plot` built around its goals and internal tensions, or `/become` a member.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
