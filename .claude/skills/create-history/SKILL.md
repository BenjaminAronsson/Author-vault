---
name: create-history
description: Create or deepen a world's history — the calendar, eras/ages, reigns, wars, migrations, founding myths — as Era notes, historical events and a master Chronology, with official vs folk versions and the legacy that survives into the story. Use when the user wants to build history, lore, ages, a timeline or backstory for the world (not one single event).
argument-hint: <World> [era | span | theme] [image=<path>]
---
# /create-history

Arguments: `$ARGUMENTS` → World and an optional focus: an era ("the Flood years"), a span ("the 200 years before B1"), or a theme ("how the guilds rose").

If an image path is given (or the user offers one), copy it to `<World>/_assets/<type>/<Name>/` and set `image:` in the new note's frontmatter (see SCHEMA › Images).

1. Read `_system/SCHEMA.md`, `World.md` (History & myths, Rules, Tensions in motion), `History/` (Chronology and Eras), and look through Factions, Places, Items and old characters. **Collect what the book already says about the past.** That's fixed canon. New history fills the gaps around it and must explain it, never overwrite it.
2. If there's no `History/Chronology.md` yet, build it first: the **calendar** (how years are counted, seasons, festivals) and the eras the book already implies.
3. **Shape the history with the user**, top-down:
   - **Eras**: name, span, how each one began and how it ended. Offer a draft sequence and let the user rearrange it.
   - For the chosen era or span: the **defining events**, the **powers and people** who rose and fell, **life in that era**, and its **legacy** in the story's present (ruins, grudges, laws, songs, sayings, bloodlines).
   - **Versions told**: official history, folk memory, and what each faction claims. Lies and myths are just as useful as truth.
   - Ask which present-day **mysteries, tensions or traces** this history should explain. That's how history makes the present feel alive.
4. **Write**:
   - `History/<Era>.md` for each era (template `era.md`, `canon: expansion`, `origin: created`), linked before and after.
   - the key historical events as Event notes (follow `/create-event` step 3, minus the questions). Legendary figures who aren't in the story become character notes (`status: dead` or `legend`).
   - Update `History/Chronology.md`, and add to `World.md ## History & myths`, `## Rumours`, and the Glossary.
   - Present-day ties: places get History and Traces, factions get Origin & history, items get Origin. Living characters with personal or family ties get a Timeline line, or a memory if they lived through it.
5. Run **continuity-keeper** to check dates against the Chronology, birth and death order, and conflicts with book canon.
6. Suggest next steps: `/find-threads <World> history` for stories hiding in the past, or `/create-plot` as a prequel.

**Version it:** finish with `tools/world-repo.sh commit <World> "Created <type> <Name>"` (local only, never pushed).
