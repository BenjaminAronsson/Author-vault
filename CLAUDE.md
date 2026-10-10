# Author Vault

Obsidian vault at `book-universe/` that holds extracted **worlds, stories and characters** from books, kept alive so characters can be "stepped into" and expanded.

## Core rules (all skills and agents)
1. **Read `book-universe/_system/SCHEMA.md` first.** It is the single source of truth for folders, frontmatter, and note shapes.
2. **Append, never overwrite.** New information becomes a Timeline / Perspective / quote entry with a source link. Contradictions are recorded, not resolved by deletion.
3. **Always cite.** Every claim links its source: `[[<story>-Cxx]]` for book, `[[EXP-…]]` for expansion sessions.
4. **Perspective is data.** Objective narration vs what a character believes are stored separately (`pov:`). Memories are per character and may be wrong.
5. **Canon tiers.** `canon: book` (from text) · `canon: expansion` (from /become sessions) · `canon: draft` (author ideas). Never promote expansion to book.
6. **Keep the voice.** Quote the book verbatim, keep the book's language, spelling, dialect and invented words. Don't flatten into neutral summary-speak.
7. `<World>/_sources/` (the book text) is read-only after import.
8. **Versioning:** every world is its own **local** git repo (`tools/world-repo.sh`), and is **never pushed**: pushes are blocked by config and a hook. After any change to a world (import, each extracted chapter, created content, a /become session), commit it with `tools/world-repo.sh commit <World> "<what changed>"`. The tool repo (`author-vault/`: site, .claude, CLAUDE.md, book-universe/_system) is the only thing that goes to GitHub, and it never contains world content (see `.gitignore` and `tools/hooks/root/pre-push`).

## Layout
- `book-universe/`: the Obsidian vault. `_system/` holds shared templates and the schema (tracked in this repo). Each `<World>/` is its own local git repo, with the book text in `<World>/_sources/`.
- `inbox/`: drop book files here (pdf, epub, txt). Never committed.
- `site/`: the World Viewer. `tools/`: world repos and git guards. `.claude/`: skills and agents.

## Workflow
New here? `/start` gives a guided onboarding that walks step by step to a first living world.

`/import-book <file> <World>` → `/extract-chapter <World> <story> all` → `/world-check <World>` → `/become <Character> [at <story>/Cxx] [continuity]`

Create & expand: `/create [type] <World> [seed]` (router for everything below) · `/create-character <World> [seed]` · `/create-object <World> [seed]` · `/create-place <World> [seed]` · `/create-faction <World> [seed]` · `/create-event <World> [seed]` · `/create-history <World> [focus]` · `/create-concept <World> [kind] [seed]` · `/create-language <World> [seed]` · `/create-culture <World> [seed]` · `/create-religion <World> [seed]` · `/create-creature <World> [seed]` · `/create-magic <World> [seed]` · `/create-technology <World> [seed]` · `/create-plot <World> [thread|premise]` · `/find-threads <World>` → `/expand-story <World> "<Thread>"`

See it: `/visualize <World>` builds the data for the static **World Viewer** (`site/dist/index.html`): reading-bookmark timeline, relationship web, character pages, places & history, portrait upload. Viewer code lives in `site/` (see `site/README.md`). It can be hosted on GitHub Pages as an **empty app**: worlds are never committed (see `.gitignore`) and are opened from your own folder in the browser.

Agents in `.claude/agents/`: chronicler, character-psychologist, worldbuilder, continuity-keeper (extraction) · character-actor, lore-scribe (living characters) · story-scout, story-weaver (expansion).
