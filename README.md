# Author Vault

Turn books into **living worlds**: characters with goals, fears, dreams, memories and their own voice; places, factions, history, magic and more, all in an [Obsidian](https://obsidian.md) vault. You can talk to characters, expand the world with new stories, and follow it all visually in the **World Viewer**.

It runs on [Claude Code](https://claude.com/claude-code): the slash commands and agents live in `.claude/`, and the rules are in `CLAUDE.md`.

## What's in this repo
| Path | What |
|---|---|
| `.claude/skills/` | slash commands: `/start`, `/import-book`, `/extract-chapter`, `/become`, `/create …`, `/find-threads`, `/expand-story`, `/visualize`, `/world-check` |
| `.claude/agents/` | specialists the commands hand work to (extraction, acting, story writing) |
| `book-universe/_system/` | the schema, note templates and default Obsidian settings every world gets |
| `site/` | the World Viewer, a static web app (see `site/README.md`) |
| `tools/` | `vault.mjs` (the deterministic engine: context packs, applying patches, lint, briefings, scaffolding), `world-repo.sh` and git guards |

**Not in this repo (by design):** your worlds and your books. Each world in `book-universe/<World>/` is its own **local** git repo that cannot be pushed. Book files go in `inbox/`, which is ignored. The viewer on GitHub Pages is an empty app: you open your own world folder in the browser, and nothing is uploaded.

## Getting started
1. Install [Claude Code](https://claude.com/claude-code) and open this folder in it.
2. Each world in `book-universe/<World>/` is **its own Obsidian vault**: open that folder in Obsidian ("Open folder as vault"). Book text (`_sources/`) is hidden from search and graph.
3. Run `/start` for guided onboarding to your first world: import a book, build one from scratch, or explore the example.

The viewer needs Node 22 or newer:
```
cd site && npm install && npm run build
```
Then open `site/dist/index.html`.

## Versioning
- **This repo:** versions the tool. It's the only thing pushed.
- **Each world:** `tools/world-repo.sh init "<World>"` gives it its own local history. The commands commit after every change (an import, each extracted chapter, created content, conversations).
- **Guards:** `tools/world-repo.sh check` confirms every world is versioned and can't be pushed. The tool repo's `pre-push` hook refuses to push if world content or book files are ever tracked. After cloning, enable it with `git config core.hooksPath tools/hooks/root`.

## License
All rights reserved. See `LICENSE`. The code is public to view, but it may not be used, copied, modified or distributed without permission. Your worlds and the books they come from are never part of this repo.
