---
name: create-language
description: Create a new language (or dialect, cant, sacred tongue, trade pidgin) for a world — its sound and feel, how it is rendered in prose, grammar quirks, naming conventions, lexicon, phrases, curses, dialects, script, the accent its speakers carry, and who speaks it — so characters sound rooted and names feel consistent. Use when the user wants to invent/add a language, dialect, naming scheme or words.
argument-hint: <World> [seed idea] [image=<path>]
---
# /create-language

Arguments: `$ARGUMENTS` → World and an optional seed idea ("the river-folk's whistled trade cant").

The goal is **a language that works for storytelling**, not a full conlang. It needs to make names consistent, give characters real words in their mouths, and sound distinct.

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `Languages/`, `Cultures/`, the Glossary, and `Style.md`. **Collect every word, name and phrase the book already uses** for this people. Those are fixed canon, and the new language must explain them: reverse-engineer the sound patterns from them.
2. **Shape it with the user**, a few questions at a time:
   - **Who** speaks it (culture, faction, class), and its status: living, dying, dead, sacred, secret, trade.
   - **Sound & feel**: offer 2–3 contrasting sound palettes, each with 5 sample names, and let the user pick.
   - **How it's rendered in the prose**: match the book's convention (italic words, translated dialogue, broken grammar).
   - **Grammar quirks** that change how speakers *sound* when they speak the main language: formal "you", no word for "sorry", word order, honorifics.
   - **Naming conventions**: personal, family and place names, with patterns and meanings.
   - **A starter lexicon** (20–40 words) weighted toward what stories need: greetings, family words, oaths and curses, food, the sacred, insults, endearments, numbers, "yes", "no", "stranger".
   - **Phrases & proverbs**, dialects and registers, script, history, related languages.
   - **The accent** its native speakers carry into other languages.
   If the user says "surprise me", build it from the seed and the existing words, then show it for approval with sample names and a few spoken lines.
3. **Write** `Languages/<Name>.md` (template `language.md`, `canon: expansion`, `origin: created`). Then weave it in:
   - Add every word and phrase to `Concepts/Glossary.md`.
   - Characters who speak it get `languages:` set and `voice.md ## Languages & accent` filled in, plus a few lines using it under `## Expansion lines`.
   - Its culture gets `languages:`. Places named in it can get their meaning noted. Its origin goes into History.
4. Run **continuity-keeper**, checking that existing names and words in the book still fit the rules.
5. Suggest next steps: `/create-culture` for its speakers, or `/become` a speaker and listen to them.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).

**Write it with the tool, not by hand:**
1. Put the result in a patch (same format as extraction: `entities`, `timeline`, `rows`, `items`, `paragraphs`, `memories`, `perspectives`, `glossary`) at `book-universe/<World>/.vault/patches/create-<slug>.json`.
2. Apply it:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter <placement, e.g. B1-C05> --canon expansion
   ```
   The tool creates notes from the templates, adds relations on both sides, and keeps the exact format.
3. Only prose sections that don't fit the patch format (e.g. a long legend) may be edited directly, by appending to the note the tool created.
