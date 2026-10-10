---
name: start
description: Guided onboarding for the author vault — explains what it does, checks the setup, and walks a new user step by step to their first living world (import a book or start from scratch), their first character conversation, and the World Viewer. Use when the user is new, asks how to begin, what this is, how it works, or says "start", "help me get started", "onboard me".
---
# /start: guided onboarding

Be a warm, brief guide. **One step at a time**: explain the step in one or two sentences, do it (or ask the one question it needs), confirm the result, then move on. Never dump the whole command list on the user.

## 0. Look around first (silently)
- Read `CLAUDE.md` and `book-universe/_system/SCHEMA.md`.
- Which worlds exist already? Look for folders in `book-universe/` that contain `World.md`. Are any books imported (`<World>/_sources/`)? Is each world a local repo (`tools/world-repo.sh check`)?
- Is the viewer ready? Check that `site/node_modules` and `site/dist/index.html` exist.
- Check the tools: `pdftotext` (for PDFs) and `python3`.

## 1. Welcome (one short paragraph)
Explain the idea in plain words: books go in, and come out as a **living world** in Obsidian, with characters who remember, change and can be talked to. A story can grow across books, side stories and "what if" versions, and **a book's canon is never mixed up with what we add** (that's always tagged as expansion).

Then ask with AskUserQuestion what they want to do first:
- **Import a book I have** (epub, pdf, txt or md)
- **Build a world from scratch** (no book yet)
- **Explore the example world** (just look around)
- **Continue my world `<name>`**: only offer this if a world exists. Resume where it left off: for each story, compare `extracted_through` with the chapters in `_sources`.

## 2a. Import a book
1. Ask for the file path (or look in `inbox/`, the drop folder for book files, which is never committed), the world name, and a short id for the book (suggest `B1`).
2. Run `/import-book`. Show the chapter list it found, and ask "Does this split look right?" before going on.
3. Explain that extraction reads the chapters one at a time, in order, so characters grow the way they do in the book. Suggest starting with **the first 3 chapters**: `/extract-chapter <World> B1 C01-C03`.
4. Show what was created: 2–3 character names with one line each (a goal or a fear) and a place. Make it feel alive. Quote one line from their `voice.md`.
5. Offer to continue with `all`, or move on to step 3 and come back later.

## 2b. Build from scratch
Go **world first, then people**:
1. Ask for the world's name and a one-line feeling ("a drowned salt-marsh village where the sea keeps what it takes"). Create `book-universe/<World>/` from `_system/templates/world.md`, plus the folders listed in `/import-book` step 5. Then run `tools/world-repo.sh init "<World>"`: the world gets its own local history, and it can never be pushed.
2. Offer the foundations, one at a time, and let the user skip any: `/create-history` (the past in broad strokes), `/create-culture`, `/create-magic` or `/create-technology` (or "no magic"), `/create-place` (one key location).
3. Run `/create-character` for the first protagonist. Make sure they get goals, fears, dreams and at least one relation.
4. Suggest a second character tied to the first, so the relationship web has something to show.

## 2c. Explore the example
Open the viewer on the Sample world: `xdg-open "site/dist/index.html#world=Saltmarrow"`. Tell them a guided tour starts automatically, and that the **?** button replays it. Then offer to set up their own world (back to step 1's choices).

## 3. Meet a character
Suggest `/become <Character>` (at the latest extracted chapter). Explain in one line: they only know what they knew at that point, and they speak in their own voice. Say how to end the conversation (`/end`), and that what they reveal is saved as expansion, never as book canon.

## 4. See it
Run `/visualize <World>` (it installs and builds the viewer if needed) and open it. Mention:
- the guided tour that starts on first open
- moving the "You've read up to" bar to hide spoilers
- dropping pictures onto avatars

## 5. Where to go next (end with this short menu, nothing more)
- **Keep reading**: `/extract-chapter <World> <book> next`
- **Grow the world**: `/create` (anything: a character, place, faction, religion, magic, a plot…)
- **Find side stories worth writing**: `/find-threads <World>`, then `/expand-story`
- **Check the world's health**: `/world-check <World>`
- **Run me again** (`/start`) whenever you're unsure what to do next. I'll pick up where you are.
