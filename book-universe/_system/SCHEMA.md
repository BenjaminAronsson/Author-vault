# Vault Schema

## Folder layout
```
book-universe/
  _system/            SCHEMA.md, templates/
  <World>/                    ← its own Obsidian vault (.obsidian/ from _system/obsidian/) and its own local git repo, never pushed
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
world: "[[World]]"      # literally [[World]]: each world is its own vault, so World.md is unique
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
- `` `presence:<mentioned|remembered>` ``: the character is only talked about or remembered in this step, not on scene. Their whereabouts don't change, and they aren't counted as on stage. Leave it out when they are actually there.
- `` `status:<alive|dead|missing|legend|deity|…>` ``
- `` `goal:"<goal text>"=<active|achieved|abandoned|betrayed>` `` (must match a Goals row)

Example:
```
- **B1-C07** · `pov:objective` · `at:[[Old Mill]]` · `rel:[[Tobin]]=ally/-1` · Learns Tobin lied to the reeve. ([[B1-C07]])
```
Chapter notes' `characters:` and `places:` frontmatter are the fallback for presence and mean **on scene**: who is physically there and where the scenes happen. People and places that are only named, talked about, remembered or written about go in `mentioned:` and `mentioned_places:`. Keep all four complete. A name in both lists counts as present.

## Images
- Files live in `<World>/_assets/<type>/<Name>/` (type = characters, places, items, creatures, factions, religions, cultures, world…).
- `image:` is the main picture. `portraits: [{at: B1-C14, file: "[[x.webp]]"}]` gives pictures that apply from that step on (in the viewer they change with the reading bookmark). `gallery: []` holds extras.
- The create skills accept an image path: copy it into `_assets/…` and set `image:`.
- **Photos (Media notes)**: a photo or scan that shows several people, a place or an event is a note in `<World>/Media/`, and the picture itself goes in `_assets/media/`. Add them with `node tools/vault.mjs add-media "<World>" <file|folder> [--depicts "A, B"] [--date 1931] [--place P] [--event E] [--caption …] [--source arkiv-C03]`. Pictures are compressed to WebP (at most 2000 px, quality 80, turned upright, original not kept). The date is taken from EXIF when not given. Frontmatter:
  `type: media` · `file: "_assets/media/x.webp"` · `depicts: ["[[Person]]", …]` · `date` · `place: "[[Place]]"` · `event: "[[Event]]"` · `caption` · `source: "[[arkiv-C03]]"` · `canon` · optional `regions: [{who: "[[Person]]", x, y, w, h}]` (face boxes, fractions of the picture from the top-left).
  The viewer shows each photo on the pages, family cards and lightbox of everyone and everything it is tagged with. Photos that show a living person stay hidden like the person does. To tag more people, append to `depicts:`.
- **Maps**: a map belongs to the world or to any place that has its own map.
  - **The map itself**: `map_image: "[[map.webp]]"`, or `map_image: sketch` for a hand-arranged parchment map with no picture. `World.md` always has a map (a sketch if nothing is set).
  - **A place's position**: `map: {x: 0.42, y: 0.31}` is a fraction of the map's width and height from the top-left. It is a position on the map of the place's nearest `part_of` ancestor that has its own map, otherwise on the world map. So a tavern inside a city with its own map is positioned on the city map.
  - **Positions are stable**: they're stored in the notes and never redrawn. The World Viewer's **Arrange** mode writes them for you: drag pins, drag in unplaced places, auto-arrange, undo, give a place its own map, use an image as a map.
  - **Geography hints**: write them in prose under `## Where & how › Getting there`, e.g. "two days' ride north of [[Port Kacollia]], across the ford". They help a person (or Claude) place pins sensibly.

## Archive & kinship (genealogy worlds)
A world made with `vault init-world "<World>" --kind genealogy` (`World.md`: `kind: genealogy`) holds family history (släktforskning) instead of a book. Everything else in this schema still applies. The differences:
- **Sources, not chapters.** Research files (.txt/.docx/.md/.pdf) are added with `vault add-archive`. Each becomes `_sources/arkiv/Cxx.md` (first line: the original file name, which is kept in `_sources/arkiv/original/`). `_sources/arkiv/index.tsv` lists them with a content hash, so re-adding a folder only adds new or changed files. A changed file becomes a new source, and the old one stays.
  - The story `Stories/arkiv/Story.md` has `kind: archive`. Its chapter notes are **source notes**, with `source_kind` (husförhörslängd, dopbok, bouppteckning, brev, minnen…), `evidence`, `archive_ref` (volume/page, AID, bild-id), `file` and `dated` (when the document was written).
  - Claims cite `[[arkiv-Cxx]]`.
- **The clock is the dates.** A timeline line's marker is the in-world date **as written**: `- **1843-05-12** · … ([[arkiv-C03]])`. Other examples are `1843`, `ca 1843`, `före 1850`, `efter 1850`, `mellan 1840 och 1845`, `1840–45`. Facts without a date use `odaterat`.
  - The viewer orders the distinct dates by real time and steps through them (`site/src/lib/dates.js`).
  - Lines are kept in date order, whatever order the sources arrive in.
  - A citation of a source counts from the source's `dated` (a letter written in 1868 is known from 1868).
- **Evidence tags** on timeline lines:
  - `` `evidence:primär|sekundär|tradition` `` says what kind of source this is: written at the time, written later, or family lore.
  - `` `confidence:belagd|trolig|hypotes` `` says how sure the fact is.
- **People.**
  - Note names are name plus life years, `Anna Persdotter (1843–1910)`, because names repeat.
  - Every other name form goes in `aliases`: spellings, patronymics, soldier names and married names.
  - Frontmatter: `born`, `died` (as written), `living: true` for people who may be alive. Living people are hidden in the viewer by default, and `build-data.mjs --redact-living` replaces them for a shared copy.
  - Possible duplicates are **suggested** by lint, never merged automatically.
- **Kinship** is frontmatter link lists, written on both sides by `apply`, plus a Relations row (`kin · far`, `kin · barn`, `hushåll · piga`) with detail, span, confidence and source:
  ```yaml
  parents: ["[[Per Andersson (1812–1867)]]"]
  children: []
  spouses: ["[[Erik Svensson (1840–1901)]]"]
  siblings: []
  ```
  Households (piga, dräng, inhyses, fosterbarn) are Relations rows only.
- **Conflicting sources.** When a later source gives a different value for a field that's already set, the first value is kept. A `> [!warning] Contradiction` line goes under `## Contradictions` with both values and the source. Birth ≠ baptism and death ≠ burial: they are separate dated lines.
- **Goals, Fears and Dreams are optional** for people in genealogy worlds. Letters and memoirs still give voice, memories (with `accuracy`) and perspectives.
- **Lint** adds: `possible-duplicate`, `contradiction`, `parent-age`, `born-after-parent-death`, `died-before-born`, `one-sided-kin`, `maybe-living`.
- **Open research questions** are Threads with `kind: forskningsfråga`, listing which record would settle them.
- **`/become`** takes a date: `vault briefing "<World>" "<Name>" --at 1880-06-01`. The briefing includes age and family as of that date.
- **Images in research files:** photos and scans embedded in a .docx are copied to `_assets/sources/arkiv-Cxx/` and linked at the end of the source under `## Bilder i filen`. A portrait of a known person can become their `image:`. Photos that show people, a place or an occasion become Media notes through the patch's `media` (see Patches).
- **GEDCOM export:** `vault export-gedcom "<World>" [out.ged] [--include-living]` writes GEDCOM 5.5.1 for other genealogy programs:
  - people with name variants, birth and death (date, place, source and quality from `confidence`), and other dated events
  - families built from parents and spouses, with the marriage year
  - each archive source as a `SOUR` record
  - Swedish date qualifiers become `ABT`/`BEF`/`AFT`/`BET … AND`. Living people are left out unless asked for.

## Patches and the `vault` tool
**Agents never edit notes.** They read a chapter, or a conversation, and write one **JSON patch**. `node tools/vault.mjs apply` writes it into the notes, deterministically:
- creates missing notes from these templates, with a `voice.md` for every character
- writes timeline lines in the exact tag format above
- adds or updates table rows. A Goal's status change is also logged on the timeline.
- adds relations on **both** sides
- **checks every quote verbatim** against the chapter, and rejects any that aren't exact
- cites the chapter on every item, and is append-only and idempotent

| Key | Shape | Written to |
|---|---|---|
| `chapter` | `{title, pov, characters[] (on scene), mentioned[] (only talked about), places[] (where scenes happen), mentioned_places[], events[], summary, scenes[], key_lines[{who,text}], state_changes[], threads[]}` | `Stories/<story>/Chapters/<cid>.md` |
| `media` | `[{file (already under _assets/), depicts[], date, place, event, caption, title}]` | `Media/<title>.md` (one per file, never twice) |
| `entities` | `[{name, type, aliases[], fields{}}]` | new notes from templates, plus aliases |
| `timeline` | `[{entity, text, at, presence (mentioned\|remembered, omit when on scene), rel[{to,bond,n}], status, goal[{goal,status}], pov}]` | `## Timeline` |
| `rows` | `[{entity, section: Goals\|Fears\|Relations, row{…}, update[]}]` | the section's table |
| `items` | `[{entity, section: Dreams\|Knowledge\|…, text}]` | list items |
| `paragraphs` | `[{entity, type?, section, text}]`. Use `entity: "<Name>/voice"` for diction and habits, and the world's name for world rules. | appended prose |
| `quotes` | `[{character, mood, text}]` | `voice.md › Quote bank › ### <mood>` |
| `memories` | `[{character, event, accuracy, charge, text, divergence}]` | `memories/<Name> - <event>.md` |
| `perspectives` | `[{target, by, text}]` | `## Perspectives › ### As seen by [[by]]` |
| `glossary` | `[{term, meaning}]` | `Concepts/Glossary.md` |
| `style` | `{notes, samples[]}` | `Stories/<story>/Style.md` |
| `kin` | `[{a, b, kind: parent\|spouse\|sibling\|household, role, back, detail, from, to, at, confidence}]` (genealogy) | `parents/children/spouses/siblings` on both notes + Relations rows |

Genealogy patches also use `timeline[].date`, `timeline[].evidence`, `timeline[].confidence`, `memories[].date`, and on `chapter`: `source_kind`, `evidence`, `archive_ref`, `file`, `dated`.

Patches are kept in `<World>/.vault/patches/`, which isn't committed. Re-applying them rebuilds the notes, at no token cost.
