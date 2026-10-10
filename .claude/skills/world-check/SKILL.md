---
name: world-check
description: Health check of a world in the vault — broken links, duplicates, alias collisions, unordered timelines, missing goals/fears/dreams/relations, one-sided relations, contradictions and canon leaks. Use after extraction or when the user asks to check/lint/clean up a world.
argument-hint: <World>
---
# /world-check

1. Run the **continuity-keeper** agent over all of `book-universe/$ARGUMENTS/`.
2. Also give these stats: the number of characters, places, events, memories and expansions; the characters with the thinnest notes (no quotes in voice.md, empty Goals/Fears/Dreams/Relations); and chapters where `extracted_through` is behind the source chapters.
3. Show what it fixed automatically, then the list of judgment calls for the author.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "world-check fixes"` (local only, never pushed).
