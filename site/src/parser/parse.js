// Turns the raw files of one world folder into a model the viewer can use.
// Runs in Node (scripts/build-data.mjs) and in the browser (folder mode).
import { splitFrontmatter, sections, wikilinks, firstLink, table, listItems, quotes, chapterRef } from './markdown.js';
import { parseTimeline } from './timeline.js';

const TYPE_BY_FOLDER = {
  Characters: 'character', Places: 'location', Factions: 'faction', Items: 'item', Concepts: 'concept',
  Events: 'event', History: 'era', Plots: 'plot', Threads: 'thread', Expansions: 'expansion',
  Cultures: 'culture', Languages: 'language', Religions: 'religion', Creatures: 'creature',
  Magic: 'magic', Technology: 'technology',
};
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const asArray = (v) => (v == null || v === '' ? [] : Array.isArray(v) ? v : [v]);
const baseName = (p) => p.split('/').pop().replace(/\.md$/i, '');

/**
 * @param {{ world: string, files: {path: string, text: string}[], images?: string[] }} input
 *   paths are relative to the world folder, using "/".
 */
export function parseWorld({ world, files, images = [] }) {
  const warnings = [];
  const entities = {};
  const nameIndex = {};
  const imageIndex = {};
  for (const p of images) imageIndex[p.split('/').pop().toLowerCase()] = p;

  for (const f of files) {
    if (!/\.md$/i.test(f.path) || f.path.startsWith('_') || f.path.includes('/_')) continue;
    const { fm, body, error } = splitFrontmatter(f.text);
    if (error) warnings.push({ kind: 'yaml', path: f.path, msg: error });
    const sec = sections(body);
    const name = baseName(f.path);
    const folder = f.path.split('/')[0];
    const type = fm.type ?? (f.path === 'World.md' ? 'world' : TYPE_BY_FOLDER[folder] ?? 'note');
    const id = f.path.replace(/\.md$/i, '');
    entities[id] = {
      id, path: f.path, name, type,
      title: sec.title ?? name,
      fm,
      aliases: asArray(fm.aliases).map(String),
      canon: fm.canon ?? 'book',
      continuity: fm.continuity ?? 'main',
      origin: fm.origin ?? null,
      sections: sec.sections,
      sectionOrder: sec.order,
      preamble: sec.preamble.trim(),
      timeline: parseTimeline(sec.sections.Timeline?.text),
    };
  }

  // Name → id index (file names first, then titles and aliases), like Obsidian link resolution.
  const add = (key, id) => { const k = key.toLowerCase(); if (!(k in nameIndex)) nameIndex[k] = id; };
  for (const e of Object.values(entities)) if (e.name.toLowerCase() !== 'voice') add(e.name, e.id);
  for (const e of Object.values(entities)) { add(e.title, e.id); e.aliases.forEach((a) => add(a, e.id)); }
  const resolve = (name) => (name ? nameIndex[String(name).toLowerCase()] ?? null : null);
  const resolveImage = (ref) => {
    const n = firstLink(ref) ?? (typeof ref === 'string' ? ref : null);
    if (!n) return null;
    return imageIndex[n.split('/').pop().toLowerCase()] ?? null;
  };

  // Stories & chapters
  const stories = {};
  const chapters = {};
  for (const e of Object.values(entities)) {
    if (e.type === 'story') {
      const sid = String(e.fm.story_id ?? e.path.split('/')[1]);
      stories[sid] = {
        id: sid, entity: e.id, title: e.fm.title || e.title, order: Number(e.fm.order ?? 99),
        continuity: e.fm.continuity ?? 'main', canon: e.canon, placement: String(e.fm.placement ?? ''),
        pov_style: e.fm.pov_style ?? '', chapters: [],
      };
      nameIndex[sid.toLowerCase()] ??= e.id;
    }
  }
  for (const e of Object.values(entities)) {
    if (e.type !== 'chapter') continue;
    const cid = chapterRef(e.fm.when) ?? e.name;
    const m = /^(.+)-C(\d+)$/.exec(cid);
    const sid = m?.[1] ?? firstLink(e.fm.story) ?? 'unknown';
    const story = stories[sid] ??= { id: sid, entity: null, title: sid, order: 99, continuity: e.continuity, canon: e.canon, placement: '', chapters: [] };
    const ch = {
      id: cid, entity: e.id, story: sid, num: Number(m?.[2] ?? 0),
      title: (e.title.split(/\s+[—-]\s+/)[1] ?? e.title).trim(),
      pov: resolve(firstLink(e.fm.pov)),
      characters: wikilinks(e.fm.characters).map(resolve).filter(Boolean),
      places: wikilinks(e.fm.places).map(resolve).filter(Boolean),
      events: wikilinks(e.fm.events).map(resolve).filter(Boolean),
      summary: (e.sections.Summary?.text ?? '').trim(),
      canon: e.canon ?? story.canon, continuity: e.fm.continuity ?? story.continuity,
      inWorld: e.fm.in_world ?? null,
    };
    chapters[cid] = ch;
    story.chapters.push(cid);
    e.chapterId = cid;
    nameIndex[cid.toLowerCase()] ??= e.id;
  }
  for (const s of Object.values(stories)) s.chapters.sort((a, b) => chapters[a].num - chapters[b].num);

  // Per-type enrichment
  const step = (v) => chapterRef(v);
  for (const e of Object.values(entities)) {
    e.firstSeen = step(e.fm.first_seen ?? (e.fm.when ? e.fm.when : null));
    e.image = resolveImage(e.fm.image);
    e.portraits = asArray(e.fm.portraits)
      .map((p) => ({ at: step(p?.at), image: resolveImage(p?.file ?? p?.image) }))
      .filter((p) => p.image);
    e.gallery = asArray(e.fm.gallery).map(resolveImage).filter(Boolean);
    e.mapSketch = String(e.fm.map_image ?? '').trim() === 'sketch';
    e.mapImage = e.mapSketch ? null : resolveImage(e.fm.map_image);
    e.partOf = resolve(firstLink(e.fm.part_of));
    e.map = e.fm.map && typeof e.fm.map === 'object' && isFinite(e.fm.map.x) && isFinite(e.fm.map.y) ? { x: Number(e.fm.map.x), y: Number(e.fm.map.y) } : null;
    for (const t of e.timeline) {
      t.step = chapters[t.marker] ? t.marker : null;
      t.tags.at = resolve(t.tags.at) ?? t.tags.at;
      t.tags.rel.forEach((r) => (r.toId = resolve(r.to)));
      if (!t.step && t.marker !== 'EXP' && !/^[+-]?\d/.test(t.marker)) warnings.push({ kind: 'timeline-step', path: e.path, msg: `Unknown step "${t.marker}"` });
      if (t.marker === 'EXP') {
        const exp = entities[resolve(t.links.find((l) => /^EXP-/.test(l)))];
        t.step = step(exp?.fm.at);
      }
    }
    if (e.type === 'character') {
      const S = e.sections;
      e.goals = table(S.Goals?.text).map((r) => ({ goal: r.goal ?? '', horizon: r.horizon ?? '', status: (r.status ?? '').toLowerCase(), since: step(r.since), source: step(r.source) }));
      e.fears = table(S.Fears?.text).map((r) => ({ fear: r.fear ?? '', root: r['root (where it comes from)'] ?? r.root ?? '', shows: r['how it shows'] ?? '', source: step(r.source) }));
      e.dreams = listItems(S.Dreams?.text).map((d) => ({ text: d, source: step(firstLink(d)) }));
      e.relationsTable = table(S.Relations?.text).map((r) => ({
        with: resolve(firstLink(r.with)), withName: firstLink(r.with) ?? r.with,
        bond: r[Object.keys(r).find((k) => k.startsWith('bond'))] ?? '',
        feels: r['what they feel'] ?? '', back: r['what the other feels back'] ?? '', changes: r['changes over time'] ?? '',
      })).filter((r) => r.withName);
      e.knowledge = listItems(S.Knowledge?.text).map((k) => ({ text: k, source: step(firstLink(k)) }));
      e.status = e.fm.status ?? 'alive';
    }
    if (e.type === 'thread' || e.type === 'plot') {
      const anchors = wikilinks(e.fm.anchors).map(step).filter(Boolean);
      e.openedAt = step(e.fm.opened_at) ?? anchors[0] ?? e.firstSeen;
      e.closedAt = step(e.fm.closed_at) ?? (/(written|resolved|dropped)/.test(e.fm.status ?? '') ? anchors.at(-1) ?? null : null);
      e.cast = wikilinks(e.fm.characters).map(resolve).filter(Boolean);
    }
  }

  // Attach voice files and memories to their characters
  for (const e of Object.values(entities)) {
    const owner = resolve(firstLink(e.fm.character)) ?? (e.path.startsWith('Characters/') ? resolve(e.path.split('/')[1]) : null);
    if (e.type === 'voice' || (e.name === 'voice' && owner)) {
      const c = entities[owner];
      if (!c) continue;
      const bank = e.sections['Quote bank (verbatim, from the book)'] ?? e.sections[Object.keys(e.sections).find((k) => k.startsWith('Quote bank')) ?? ''];
      c.voice = {
        entity: e.id,
        moods: bank ? bank.subOrder.map((mood) => ({ mood, quotes: quotes(bank.subs[mood]) })).filter((m) => m.quotes.length) : [],
        expansion: quotes(e.sections[Object.keys(e.sections).find((k) => k.startsWith('Expansion lines')) ?? '']?.text).map((q) => ({ ...q, canon: 'expansion' })),
        diction: listItems(e.sections.Diction?.text),
      };
    }
    if (e.type === 'memory' && owner) {
      const c = entities[owner];
      if (!c) continue;
      (c.memories ??= []).push({
        id: e.id, title: e.title, event: resolve(firstLink(e.fm.event)), when: step(e.fm.when),
        accuracy: e.fm.accuracy ?? 'unknown', charge: e.fm.emotional_charge ?? '', canon: e.canon,
        text: (e.preamble || Object.entries(e.sections).filter(([k]) => !/^Divergence/.test(k)).map(([, v]) => v.text).join('\n')).trim(),
        divergence: (e.sections['Divergence from objective']?.text ?? '').trim(),
      });
    }
  }

  // "As seen by" perspectives, kept on the viewer's side too
  for (const e of Object.values(entities)) {
    const P = e.sections.Perspectives;
    if (!P) continue;
    e.perspectives = P.subOrder.map((h) => ({ heading: h, by: resolve(firstLink(h)), text: P.subs[h].trim() })).filter((p) => p.text);
  }

  // Links (for backlinks / unresolved warnings)
  for (const e of Object.values(entities)) {
    const all = new Set();
    for (const s of Object.values(e.sections)) { wikilinks(s.text).forEach((l) => all.add(l)); Object.values(s.subs).forEach((t) => wikilinks(t).forEach((l) => all.add(l))); }
    wikilinks(e.fm).forEach((l) => all.add(l));
    e.links = [];
    for (const l of all) {
      if (IMAGE_EXT.test(l)) continue;
      const id = resolve(l);
      if (id) e.links.push(id); else warnings.push({ kind: 'unresolved-link', path: e.path, msg: `[[${l}]]` });
    }
  }

  const worldEntity = entities.World ?? null;
  return {
    world, generatedAt: new Date().toISOString(),
    worldEntity: worldEntity?.id ?? null,
    entities, stories, chapters, nameIndex, warnings,
  };
}
