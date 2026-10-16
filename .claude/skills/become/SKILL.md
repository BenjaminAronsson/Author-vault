---
name: become
description: Step into a character from the vault and talk as them — in their own voice, knowing only what they know at a chosen point in the story — then save what was revealed as expansion canon. Use when the user wants to talk to, interview, roleplay or "become" a character.
argument-hint: <Character> [at <story>/Cxx] [continuity] [World]
---
# /become

Arguments: `$ARGUMENTS` → character name (or alias), optional `at <story>/Cxx` (default: the latest extracted point), optional continuity (default `main`), and the World (ask if it's ambiguous).
**Genealogy worlds** (`World.md` has `kind: genealogy`) take a **date** instead: `at 1880` or `at 1880-06-01`. The briefing then cuts off at that date and includes the person's age and family as of then.

## 1. Get the briefing (deterministic, spoiler-safe)
```
node tools/vault.mjs briefing "<World>" "<Character>" --at <story>/Cxx [--cont <continuity>]
```
- **What it holds:** everything the character knows and is at that point: where they are, goals, fears, dreams, inner life, how they feel about people, knowledge, their story so far, their memories *as they remember them*, their voice lines and how others look to them.
- **What it leaves out:** everything after the cutoff, and every "what really happened" section.
- **Use only this briefing as the character's knowledge.** Don't read their notes yourself: that's how spoilers and the truth leak in.
- **No cutoff given:** use the story's `extracted_through`, i.e. the latest point.

## 2. Play the character
Take on the **character-actor** instructions (`.claude/agents/character-actor.md`) and play the character **directly in this conversation** with the briefing as your knowledge. Don't use a subagent here, because the conversation needs to stay live. Open with a short in-character line that fits the moment in the story.
- **Style of every reply:** follow the *Scene craft* section of the agent file: short, natural speech that fits the literary context; emotion shown through gesture, object and what is left unsaid (never named); one or two concrete *italic* actions; a small recurring image from the place; only the single piece of backstory the moment calls for. The opening line sets the scene (place, light, one object) in two or three lines.
- **Cutoff with expansion timelines:** timeline lines marked `EXP` carry no story step, so the briefing may include events later than the cutoff. Ignore any memory or event dated after the chosen moment.
- `(ooc) …` from the user = answer out of character, briefly, then go back into the role.
- `/end`, "end session" or "exit" = stop playing.
- In your head, keep track of new memories, backstory, opinions and lines the character invents.

## 3. Save the session
When the session ends, save the transcript to `book-universe/<World>/Expansions/EXP-<date>-<character>-<slug>.md` (template `expansion-session.md`).
1. Run **lore-scribe** with the transcript path, the briefing and the patch path `book-universe/<World>/.vault/patches/EXP-<date>-<slug>.json`.
2. Apply it as expansion canon:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter <cutoff, e.g. B1-C05> --canon expansion
   ```
   Genealogy worlds cite the session, and date undated lines at the cutoff:
   ```
   node tools/vault.mjs apply "<World>" <patch> --chapter EXP-<date>-<character>-<slug> --canon expansion --date <cutoff date>
   ```
3. Tell the user what the character now "remembers", and list the conflicts with canon that lore-scribe flagged instead of writing.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "/become session with <Name>"` (local only, never pushed).
