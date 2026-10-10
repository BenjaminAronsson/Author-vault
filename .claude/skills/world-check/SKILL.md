---
name: world-check
description: Health check of a world. A deterministic lint (broken links, duplicates, alias collisions, timeline order, one-sided relations, missing goals/fears/dreams/relations, impossible chronology), then the continuity-keeper for judgment calls only. Use after extraction or when the user asks to check/lint/clean up a world.
argument-hint: <World>
---
# /world-check

1. **Structure:** `tools/world-repo.sh check`. Is the world its own vault, with the standard folders and an unpushable repo?
2. **Content:** `node tools/vault.mjs lint "$ARGUMENTS"`. Show both counts: mechanical and judgment.
3. **Judgment items:** only if there are any, run **continuity-keeper** with the output of `node tools/vault.mjs lint "$ARGUMENTS" --json`, its judgment items only. Then re-run lint and show what changed.
4. **Commit** the fixes: `tools/world-repo.sh commit "$ARGUMENTS" "world-check fixes"`.
5. **Coverage:** `node site/scripts/build-data.mjs "$ARGUMENTS"` prints how complete the world is for the viewer (relations over time, places, portraits, voice).
