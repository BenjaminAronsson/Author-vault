---
name: create-culture
description: Create a new culture/people in a world — values, family and society, rites of passage, faith, manners and hospitality, food, dress, arts, law, taboos, festivals, how they see others and are seen, inner tensions — and weave it into places, factions, languages and characters. Use when the user wants to invent/add a culture, people, ethnicity, tribe, nation, or way of life.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-culture

Arguments: `$ARGUMENTS` → World and an optional seed idea ("marsh people who bury their dead standing up").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (Rules, Daily life, History & myths, Tensions in motion), `Cultures/`, `Languages/`, `Concepts/`, `History/`, and look through Places, Factions and Characters. **Collect what the book already shows about this people.** That's fixed canon. The culture must fit the world's land, climate, history and rules.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world. Start from what makes them *distinct*, then go wider:
   - **Who they are**: what they call themselves, and what others call them. Their homeland and way of living.
   - **Values**: what they honour, what shames them, what counts as a good life.
   - **Family & society**, and **rites of passage**: birth, naming, coming of age, bonding, death.
   - **Faith & superstition**, **manners & hospitality**, **food**, **dress & body**, **arts**, **law & conflict**, **taboos**, **festivals**.
   - **How they see others, and how others see them** (stereotypes marked true, false or partly).
   - **Inside tensions**: generations, classes, reformers, those who left.
   - **Language**: an existing one, or create one next with `/create-language`.
   If the user says "surprise me", build it from the seed, the land, and the world's tensions, then show it for approval with one vivid everyday scene (a meal, a greeting, a funeral).
3. **Write** `Cultures/<Name>.md` (template `culture.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Characters who belong get `culture:` set, plus how they relate to it ("Culture & belonging"), cultural phrases in `voice.md`, and Daily life details (food, rituals).
   - Places get it under Who is here. Factions that are rooted in it get it under Culture.
   - Its customs and beliefs become or link to Concepts. Festivals go into `History/Chronology.md ## Calendar`, and origins into History.
   - Other cultures get a reciprocal row in How they see others.
   - Add terms to the Glossary.
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/create-language` for their tongue, `/create-character` born into it, or `/become` a member and ask about home.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
