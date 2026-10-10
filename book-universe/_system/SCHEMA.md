# Vault Schema

## Folder layout
```
book-universe/
  _system/            SCHEMA.md, templates/
  <World>/                    ← its own local git repo (tools/world-repo.sh), never pushed
    _sources/<story>/         original file + C01.md, C02.md …, _front.md (read-only after import)
    World.md
    Stories/<story>/Story.md
    Stories/<story>/Chapters/<story>-Cxx.md
    Characters/<Name>/<Name>.md
    Characters/<Name>/voice.md
    Characters/<Name>/memories/<Name> - <event>.md
    Places/  Factions/  Items/  Concepts/ (incl. Glossary.md)
    Cultures/<Culture>.md   Languages/<Language>.md
    Religions/<Religion>.md   Creatures/<Creature>.md
    Magic/<Magic System>.md   Technology/<Technology>.md
    Events/<event>.md
    History/Chronology.md, History/<Era>.md
    Plots/<plot>.md   Threads/<thread>.md
    Stories/<story>/Style.md   Stories/<expansion-story>/Text/Cxx.md
    _assets/<type>/<Name>/<image>.webp   (portraits, maps, banners)
    Expansions/EXP-YYYY-MM-DD-<character>-<slug>.md
```

## IDs & naming
- **story id**: short slug, e.g. `B1`, `sidestory-wolves`. Chapter notes: `<story>-C03` (zero padded) — unique across the vault so `[[B1-C03]]` always resolves.
- Entity notes are named by their most common in-text name; other names go in `aliases`.
- Before creating any entity, search existing names **and aliases** in the world. Prefer updating.

## Shared frontmatter
```yaml
type: character | location | faction | item | concept | event | memory | story | chapter | expansion | world
world: "[[World]]"
aliases: []
canon: book | expansion | draft
continuity: main          # or alt-ending, sidestory-x … (list if valid in several)
first_seen: "[[B1-C01]]"
sources: ["[[B1-C01]]"]
tags: []
```

## Time
`when` = `<story>/Cxx` (reading order) plus optional `in_world:` date. Timeline entries are ordered by story order (from Story.md `order:`) then chapter.

Timeline entry format (one line, append to `## Timeline`):
```
- **B1-C03** · `pov:objective` · Loses her brother's ring in the river. ([[B1-C03]])
- **EXP** · `pov:Mara` · `canon:expansion` · Claims she learned to swim at the mill. ([[EXP-2026-10-10-mara-childhood]])
```

## Perspectives
Under `## Perspectives`, one subsection per viewer:
```
### As seen by [[Tobin]]
- "She's colder than winter iron." — distrust, B1-C04 ([[B1-C04]])
```
`### Objective` holds narrator-confirmed facts. Never merge a perspective into the core description.

## Memories
`Characters/<Name>/memories/` — what *this* character remembers of an event. Fields: `event`, `pov`, `when`, `accuracy: faithful|partial|distorted|false|unknown`, `emotional_charge`. Body: the memory told the way they'd remember it, plus what they got wrong (hidden from the actor only if they cannot know it — mark under `## Divergence from objective`).

## Voice
`Characters/<Name>/voice.md` — quote bank (verbatim, cited, grouped by mood), diction, habits, register per relationship, inner voice, voice drift over time, expansion lines. See template.

## Language
Notes are written in the **book's language**. Invented terms keep their exact spelling and go in `Concepts/Glossary.md`.

## Contradictions
When sources disagree: keep both, add a `> [!warning] Contradiction` callout citing both, and either attribute to a perspective, a continuity, or leave open.

## Character essentials (required for every character)
Every character note must keep these four sections current: **Goals**, **Fears**, **Dreams**, **Relations**. They change over time. Never delete a row. Change its status and add a Timeline entry, e.g. `- **B1-C09** · goal "win back the mill" → abandoned ([[B1-C09]])`. Relations are two-way. When A's feelings toward B change, update A's row, and check whether B's row needs an update too. Minor characters may have short entries, but the sections must still exist.

## Aliveness layers
Beyond the essentials, fill these whenever the text gives (or clearly implies) them, and mark inferences `(inferred)`:
- **Character**: Values & lines, Under pressure, Skills & flaws, Daily life, Body & senses, Arc.
- **World**: History & myths, Daily life, Sensory palette, Rumours & common beliefs, Tensions in motion.
- **Location**: Atmosphere, Who is here, Daily rhythm, Secrets, Memories tied here.
- **Faction**: Goals, Fears, Beliefs, Internal tensions, Members, Relations.
These are what let a character answer "what did you eat as a child" or "what do people say about the old mill" in a believable way.

## Created & expanded content
- Everything not from the book is `canon: expansion` with an `origin:` key: `become` (talk sessions), `created` (/create-character), `expand` (/expand-story).
- **Threads** (`<World>/Threads/`) are possible side stories found by /find-threads (template `thread.md`). Status goes open → chosen → in-progress → written / dropped.
- **Expansion stories** live in `Stories/<story-id>/` like book stories, with `canon: expansion`. Their prose is in `Stories/<story-id>/Text/Cxx.md` (readable in Obsidian), and the chapter notes are next to it as usual. Their `continuity` is either `main` (a side story that fits the book canon) or a named branch (`what-if-…`).
- **Style** (`Stories/<story>/Style.md`, template `style.md`) records how the book's prose reads. The story-weaver must match it.

## Plots & objects
- **Plots** (`<World>/Plots/`, template `plot.md`) are plotlines. The chronicler records the book's own major plotlines (`canon: book`, status ongoing/resolved). `/create-plot` designs new ones (`canon: expansion`, `origin: created`). `/expand-story` can use a Plot note as its outline.
- **Items** follow the extended `item.md` template: origin vs legend, properties (confirmed/rumoured/false), the chain of owners, and what the item means to each character. `/create-object` creates new ones (`origin: created`).
- **Places and factions** are created with `/create-place` and `/create-faction` (`origin: created`), using the extended `location.md` and `faction.md` templates. Every link they add is written on both sides.
- **Concepts** (beliefs, customs, laws, technology, diseases, materials…) use the extended `concept.md` template with a `kind:` field. `/create-concept` creates new ones. A new concept may never quietly break the world's Rules.

## History
- `<World>/History/Chronology.md` (template `chronology.md`) is the master in-world timeline: the calendar, the eras, and every dated event in in-world order. The reading order (`when`) is separate and stays on the notes themselves.
- `<World>/History/<Era>.md` (template `era.md`) holds ages, reigns and wars, with defining events, life in that era, legacy, and the different versions told.
- Historical events are normal Event notes with `era:` and `in_world:` set instead of a chapter `when`.
- Every event and era keeps **Versions told**, because history is told by people and is often wrong.
- `/create-event` and `/create-history` make new ones (`canon: expansion`, `origin: created`).

## Languages & cultures
- **Languages** (`<World>/Languages/`, template `language.md`): sound and feel, how the book renders the language, grammar quirks that affect how speakers sound, naming conventions, lexicon, phrases and curses, dialects, accent when speaking other languages, speakers. All words also go in the Glossary.
- **Cultures** (`<World>/Cultures/`, template `culture.md`): values, family, rites of passage, faith, manners, food, dress, arts, law, taboos, festivals, how they see others and how others see them, inside tensions, members.
- Characters link to them with `culture:` and `languages:` in frontmatter. `voice.md ## Languages & accent` records how this shows in their speech.
- **Naming**: new characters, places and items take their names from the naming conventions of the relevant language.
- `/create-language` and `/create-culture` create new ones (`origin: created`).

## Religions & creatures
- **Religions** (`<World>/Religions/`, template `religion.md`): the divine, cosmology, afterlife, teachings, texts, clergy, practice, words of faith, symbols, sects, politics, history, believers. `## Truth in this world` holds only objective canon. Believers' notes never assume it. Gods who appear or speak are character notes with `status: deity`.
- **Creatures** (`<World>/Creatures/`, template `creature.md`): body, senses, behaviour, life cycle, signs of presence, weaknesses, uses, folklore vs truth, place in culture and faith, encounters. Named individual creatures that matter are character notes with `species:`.
- Characters link with `religion:` and `species:`. Prayers and oaths go into `voice.md`.
- `/create-religion` and `/create-creature` create new ones (`origin: created`).

## Magic systems
- `<World>/Magic/` (template `magic.md`) holds the source, access, method, numbered **Laws**, costs, limits, backlash, sensory signature, disciplines, training, place in society, folklore, history, practitioners and mysteries. `hardness:` sets how rule-bound the system is.
- Laws, costs and limits are **binding** for every scene. The story-weaver, character-actor and continuity-keeper all check against them. A world can have several systems, or none (then `World.md ## Rules` says so, and nobody casts anything).
- Characters link with `magic:`. Their skill and the costs they've paid are in Skills & flaws, and their incantations in voice.md.
- `/create-magic` creates new systems (`origin: created`).

## Technology
- `<World>/Technology/` (template `technology.md`): domain, when it was introduced, maturity, availability, how it works, how it looks and sounds, materials and energy, limits and failure, who has it, how it changed life, dangers, slang, variants, lineage, folklore, makers and users.
- `World.md ## Rules` states the **technology level**, including what does *not* exist yet. This is binding: there are no anachronisms in expansion stories, `/become` sessions or created content. A character can't know or use technology that's newer than their time or out of their reach.
- `/create-technology` creates new ones (`origin: created`).

## Machine-readable timeline tags (for the World Viewer)
Timeline lines may carry these inline tags (backticked) after the step marker. They describe state **from this step on**:
- `` `at:[[Place]]` ``: where this character/item is now.
- `` `rel:[[X]]=<bond>/<n>` ``: what *this* character feels toward X. `bond` is a free word (love, rival, kin, ally, enemy, mentor…), `n` runs from -2 (hate) to +2 (devotion). Write one direction only. X's own feeling goes on X's note.
- `` `status:<alive|dead|missing|legend|deity|…>` ``
- `` `goal:"<goal text>"=<active|achieved|abandoned|betrayed>` `` (must match a Goals row)

Example:
```
- **B1-C07** · `pov:objective` · `at:[[Old Mill]]` · `rel:[[Tobin]]=ally/-1` · Learns Tobin lied to the reeve. ([[B1-C07]])
```
Chapter notes' `characters:` and `places:` frontmatter are the fallback for presence. Keep them complete.

## Images
- Files live in `<World>/_assets/<type>/<Name>/` (type = characters, places, items, creatures, factions, religions, cultures, world…).
- `image:` is the main picture. `portraits: [{at: B1-C14, file: "[[x.webp]]"}]` gives pictures that apply from that step on (in the viewer they change with the reading bookmark). `gallery: []` holds extras.
- The create skills accept an image path: copy it into `_assets/…` and set `image:`.
- **Maps**: a map belongs to the world or to any place that has its own map.
  - **The map itself**: `map_image: "[[map.webp]]"`, or `map_image: sketch` for a hand-arranged parchment map with no picture. `World.md` always has a map (a sketch if nothing is set).
  - **A place's position**: `map: {x: 0.42, y: 0.31}` is a fraction of the map's width and height from the top-left. It is a position on the map of the place's nearest `part_of` ancestor that has its own map, otherwise on the world map. So a tavern inside a city with its own map is positioned on the city map.
  - **Positions are stable**: they're stored in the notes and never redrawn. The World Viewer's **Arrange** mode writes them for you: drag pins, drag in unplaced places, auto-arrange, undo, give a place its own map, use an image as a map.
  - **Geography hints**: write them in prose under `## Where & how › Getting there`, e.g. "two days' ride north of [[Port Kacollia]], across the ford". They help a person (or Claude) place pins sensibly.
