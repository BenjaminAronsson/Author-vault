---
name: become
description: Step into a character from the vault and talk as them — in their own voice, knowing only what they know at a chosen point in the story — then save what was revealed as expansion canon. Use when the user wants to talk to, interview, roleplay or "become" a character.
argument-hint: <Character> [at <story>/Cxx] [continuity] [World]
---
# /become

Arguments: `$ARGUMENTS` → character name (or alias), optional `at <story>/Cxx` (default: the latest extracted point), optional continuity (default `main`), and the World (ask if it's ambiguous).

## 1. Build the briefing
Read `_system/SCHEMA.md`. Find the character by name or alias, then collect:
- `<Name>.md`: Core, Goals, Fears, Dreams, Inner life, Relations, Knowledge, and Timeline entries **up to the cutoff** in this continuity (include earlier `canon:expansion` entries; leave out later entries).
- `voice.md` in full: quote bank, diction, habits, register, Voice drift up to the cutoff, expansion lines.
- every `memories/*.md` with `when` ≤ cutoff, **without** the `## Divergence from objective` sections.
- for each related character: only what *this* character believes about them (Perspectives `As seen by [[<Name>]]`, the relations table).
- the places and world rules they would know, in short form.
Leave out anything the character couldn't know. Put it together as one briefing.

## 2. Play the character
Take on the **character-actor** instructions (`.claude/agents/character-actor.md`) and play the character **directly in this conversation** with the briefing as your knowledge. Don't use a subagent here, because the conversation needs to stay live. Open with a short in-character line that fits the moment in the story.
- `(ooc) …` from the user = answer out of character, briefly, then go back into the role.
- `/end`, "end session" or "exit" = stop playing.
- In your head, keep track of new memories, backstory, opinions and lines the character invents.

## 3. Save the session
When the session ends, run the **lore-scribe** agent. Give it the world, character, cutoff, continuity, today's date and the full transcript. Then tell the user what the character now "remembers" and list any conflicts with canon that weren't written into the notes.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "/become session with <Name>"` (local only, never pushed).
