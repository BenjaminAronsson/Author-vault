# Author Vault

Books become **living worlds** in an Obsidian vault (`book-universe/`). You can step into the characters, expand them, and follow the story in the World Viewer.

## Core rules (all skills and agents)
1. **Read `book-universe/_system/SCHEMA.md` first.** It's the single source of truth for folders, frontmatter and note shapes.
2. **Append, never overwrite.** New information becomes a Timeline, Perspective or quote entry with a source link. Contradictions are recorded, not resolved by deletion.
3. **Always cite.** Every claim links its source: `[[<story>-Cxx]]` for the book, `[[EXP-…]]` for expansion sessions.
4. **Perspective is data.** The objective narration and what a character believes are stored separately (`pov:`). Memories are per character and may be wrong.
5. **Canon tiers.** `canon: book` comes from the text, `canon: expansion` from /become sessions and created content, `canon: draft` from author ideas. Never promote expansion to book.
6. **Keep the voice.** Quote the book verbatim, and keep its language, spelling, dialect and invented words.
7. **Book text is read-only:** `<World>/_sources/` doesn't change after import.
8. **Worlds are versioned locally and never pushed.** Each `<World>/` is its own git repo. After any change to a world (an import, each extracted chapter, created content, a /become session), run `tools/world-repo.sh commit "<World>" "<what changed>"`.

## Layout
| Path | What | Git |
|---|---|---|
| `book-universe/_system/` | schema, note templates, default Obsidian settings for new worlds (`obsidian/`) | this repo |
| `book-universe/<World>/` | one world = **its own Obsidian vault** (open this folder in Obsidian): notes, `_assets/` images, `_sources/` book text (hidden in Obsidian) | **its own local repo, never pushed** (`tools/world-repo.sh`) |
| `inbox/` | drop book files here (pdf, epub, txt) | ignored |
| `site/` | World Viewer (static app, GitHub Pages) | this repo |
| `.claude/` | skills (slash commands) and agents | this repo |
| `tools/` | `world-repo.sh`, push guards (`hooks/`) | this repo |

**New worlds only through the tool:** `node tools/vault.mjs init-world "<World>"` (or `tools/world-repo.sh init`, which repairs an existing folder). Never create world folders or notes by hand. `tools/world-repo.sh check` verifies that every world is its own Obsidian vault with the standard folders, a local unpushable repo, and that nothing else sits in `book-universe/`.

This repo (the tool) is the only thing pushed to GitHub. `.gitignore` and `tools/hooks/root/pre-push` keep world content and book files out of it.

## The `vault` tool (deterministic, zero tokens)
`node tools/vault.mjs plan | context | apply | lint | briefing | done | init-world | add-story | import-books | add-archive | add-media`. Agents understand and write patches, and this tool does everything else: writing notes in exact format, verbatim quote checks, two-sided relations, continuity lint, spoiler-safe `/become` briefings, progress and commits. Patch format: `SCHEMA.md › Patches`.

## Commands
- **Start:** `/start` gives guided onboarding to a first world.
- **Read a book in:**
  1. `/import-book <file> <World>` (handles omnibus editions)
  2. `/extract-chapter <World> <story> all`
  3. `/world-check <World>`
- **Family history (släktforskning):** `/import-archive <folder> <World>` (a genealogy world: research files as sources, the timeline in real dates, kinship and a family tree) → `/extract-chapter <World> arkiv all` → `/world-check <World>` → `/visualize <World>`. Family photos: `node tools/vault.mjs add-media <World> <folder>` (compressed, tagged by `depicts:`). See `SCHEMA.md › Archive & kinship`.
- **Live in it:** `/become <Character> [at <story>/Cxx] [continuity]` talks to a character as of that point in the story.
- **Create:** `/create [type] <World> [seed]` routes to the matching `create-*` skill: character, object, place, faction, event, history, concept, language, culture, religion, creature, magic, technology, plot.
- **Expand:** `/find-threads <World>` → `/create-plot` → `/expand-story <World> "<Thread or Plot>"`
- **See it:** `/visualize <World>` opens the World Viewer. See `site/README.md`.

## Agents (`.claude/agents/`)
- **Extraction** (Sonnet): `chronicler` (story and world) and `character-psychologist` (people and voice). Both read a chapter plus a compact context pack and write a JSON patch. `continuity-keeper` handles lint's judgment calls once per book.
- **Living characters:** character-actor, lore-scribe.
- **Expansion:** story-scout, story-weaver.
- **Genealogy:** `genealogist` (Sonnet) reads one research file and writes a patch with people, dates, kinship and evidence.
