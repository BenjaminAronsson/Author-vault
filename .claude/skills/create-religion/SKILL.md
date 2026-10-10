---
name: create-religion
description: Create a new religion, faith, cult, sect or heresy in a world — its gods or spirits, cosmology, afterlife, teachings, holy texts, clergy, practice, words of faith (prayers, oaths, curses), symbols and holy places, sects, politics, history and believers — woven into cultures, characters' faith and voices. Use when the user wants to invent/add a religion, faith, god, pantheon, cult, church, sect or heresy.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-religion

Arguments: `$ARGUMENTS` → World and an optional seed idea ("a river goddess who takes one drowned child a year").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (Rules, History & myths, Tensions in motion), `Religions/`, `Cultures/`, `Languages/` (names of gods follow their naming conventions), `Concepts/`, `History/`. **Collect every prayer, oath, god's name, temple and rite the book already mentions.** Those are fixed canon.
2. **Shape it with the user**, a few questions at a time, with suggestions grounded in the world:
   - **Kind & status**: pantheon, one god, ancestors, spirits, a cult, or a sect of an existing faith. Dominant, persecuted, secret or dying.
   - **The divine**: names, domains, temperaments, symbols.
   - **Cosmology, creation and afterlife.**
   - **Teachings**: virtues, sins, taboos, laws.
   - **Holy texts & stories**: write 1–2 short verses or parables in the faith's voice.
   - **Clergy & structure**, plus **power & politics**.
   - **Practice**: daily, seasonal, life rites, festivals.
   - **Words of faith**: prayers, blessings, oaths, curses, greetings. Characters will speak these, so make them sound like the culture's language.
   - **Symbols, objects, holy places.** Sects, heresies and rivals.
   - **Truth in this world**: does the divine really act here? Ask the user. It can stay open.
   If the user says "surprise me", build it from the seed and the world's cultures, history and tensions, then show it for approval with one rite as a short scene and one prayer.
3. **Write** `Religions/<Name>.md` (template `religion.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - **Believers**: `religion:` set, faith and devotion in Core, prayers and oaths in `voice.md ## Expansion lines`, and rites in Daily life.
   - **Gods** who could appear or speak get character notes (`status: deity`) with their own voice.md.
   - **Cultures** get `religions:` and Faith. **Factions** (churches, orders) are created or linked. **Holy places** get it under Atmosphere, Who is here and History. **Sacred items** are linked.
   - Festivals go into `History/Chronology.md ## Calendar`. Founding and schisms go into History. Terms go into the Glossary.
4. Run **continuity-keeper** on the touched notes.
5. Suggest next steps: `/become` a believer (or a doubter), `/become` a god, or `/create-plot` around a heresy.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
