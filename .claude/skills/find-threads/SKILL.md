---
name: find-threads
description: Find and rank side stories worth expanding in a world — minor characters, gaps in time, offstage events, rumours, unresolved tensions, what-ifs — and let the user pick which to develop. Use when the user asks what could be expanded, wants side-story ideas, or wants to choose a thread.
argument-hint: <World> [story | character | kind]
---
# /find-threads

Arguments: `$ARGUMENTS` → World, plus an optional focus (a story, a character, or a kind such as `rumour`).

1. Run the **story-scout** agent on the world, passing the focus on.
2. Show the ranked table. For the top 3–5, give a two-line pitch each and say where in the timeline and which continuity the story would live in.
3. Ask the user to **choose** with AskUserQuestion (multi-select). The user can also combine threads or adjust an angle.
4. Set chosen threads to `status: chosen`. Threads the user explicitly rejects get `status: dropped` (don't delete them).
5. Suggest a next step: `/expand-story <World> "<Thread>"`.

To list existing threads without scanning again: read `<World>/Threads/` and show them grouped by status and sorted by potential.

**Version it:** when this changes the world, finish with `tools/world-repo.sh commit <World> "Threads found"` (local only, never pushed).
