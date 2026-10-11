// Builds the compact context pack an agent gets for one chapter, instead of exploring the vault.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chapterRef } from '../parser/markdown.js';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ENTITY_TYPES = new Set(['character', 'location', 'faction', 'item', 'creature', 'concept', 'religion', 'culture', 'language', 'magic', 'technology', 'event', 'era']);

/** Entities whose name or alias appears in the text (proper-noun matching, word boundaries). */
export function mentioned(model, text) {
  const hits = new Map();
  for (const e of Object.values(model.entities)) {
    if (!ENTITY_TYPES.has(e.type)) continue;
    for (const n of [e.title, e.name, ...(e.aliases ?? [])]) {
      if (!n || n.length < 3 || n === n.toLowerCase()) continue; // skip lower-case words (too ambiguous)
      const m = text.match(new RegExp(`(?<![\\p{L}])${esc(n)}(?![\\p{L}])`, 'gu'));
      if (m) hits.set(e.id, (hits.get(e.id) ?? 0) + m.length);
    }
  }
  return [...hits.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
}

function digest(model, e, { full }) {
  const out = [`### ${e.title} (${e.type})${e.aliases?.length ? ` · aka ${e.aliases.join(', ')}` : ''}`];
  if (e.type === 'character' && e.kin) {
    // genealogy: identity facts first, so the agent can tell namesakes apart
    const t = (ids) => ids.map((id) => model.entities[id]?.title).filter(Boolean).join(', ');
    const facts = [e.born && `född ${e.born}`, e.died && `död ${e.died}`, e.kin.parents.length && `föräldrar: ${t(e.kin.parents)}`, e.kin.spouses.length && `make/maka: ${t(e.kin.spouses)}`, e.kin.children.length && `barn: ${t(e.kin.children)}`, e.living && 'living'].filter(Boolean);
    if (facts.length) out.push(`- ${facts.join(' · ')}`);
  }
  if (e.type === 'character') {
    if (e.fm?.status && e.fm.status !== 'alive') out.push(`- status: ${e.fm.status}`);
    const goals = (e.goals ?? []).filter((g) => g.goal);
    if (goals.length) out.push(`- goals: ${goals.map((g) => `${g.goal} [${g.status || 'active'}]`).join('; ')}`);
    if (full) {
      const fears = (e.fears ?? []).map((f) => f.fear).filter(Boolean);
      if (fears.length) out.push(`- fears: ${fears.join('; ')}`);
      const dreams = (e.dreams ?? []).map((d) => d.text.replace(/\s*\(\[\[[^\]]+\]\]\)\s*$/, ''));
      if (dreams.length) out.push(`- dreams: ${dreams.join('; ')}`);
      const rel = (e.relationsTable ?? []).filter((r) => r.withName).map((r) => `${r.withName}: ${r.feels || r.bond}${r.back ? ` (back: ${r.back})` : ''}`);
      if (rel.length) out.push(`- relations: ${rel.slice(0, 12).join('; ')}`);
      const moods = (e.voice?.moods ?? []).map((m) => `${m.mood} ${m.quotes.length}`);
      if (moods.length) out.push(`- voice quotes so far: ${moods.join(', ')}`);
      if (e.memories?.length) out.push(`- memories: ${e.memories.length}`);
    }
  }
  const tl = (e.timeline ?? []).slice(-3).map((t) => `  - ${t.marker}: ${t.text.replace(/\s*\(\[\[[^\]]+\]\]\)\s*$/, '').slice(0, 160)}`);
  if (tl.length) out.push('- recent:', ...tl);
  return out.join('\n');
}

/**
 * @param model parsed world · @param sourceText chapter text · @param prevCast ids from the previous chapter
 * @param forWho 'world' | 'characters'
 */
export function contextPack(model, { cid, sourcePath, sourceText, forWho = 'characters', prevCid = null }) {
  const hits = mentioned(model, sourceText);
  if (model.genealogy) {
    // genealogy: sources mention people by name only, so known people with similar names are always listed
    const people = Object.values(model.entities).filter((e) => e.type === 'character');
    const first = (n) => String(n).replace(/\s*\(.*$/, '').split(/\s+/)[0]?.toLowerCase();
    const words = new Set(sourceText.toLowerCase().match(/[\p{L}-]+/gu) ?? []);
    for (const p of people) if ([p.title, ...(p.aliases ?? [])].some((n) => words.has(first(n)))) hits.push({ id: p.id, count: 0 });
  }
  const prev = prevCid && model.chapters[prevCid] ? model.chapters[prevCid].characters : [];
  const ids = [...new Set([...hits.map((h) => h.id), ...prev])].filter((id) => model.entities[id]);
  const chars = ids.filter((id) => model.entities[id].type === 'character');
  const others = ids.filter((id) => model.entities[id].type !== 'character');
  const lines = [`# Context for ${cid}`, `Source ${model.genealogy ? 'file' : 'chapter'}: ${sourcePath}`, `World: ${model.world} (use this exact name as the entity for world-wide rules)`, ''];
  if (!ids.length) lines.push('_No existing notes match this chapter yet. Everything you find is new._', '');
  if (forWho === 'characters') {
    if (chars.length) lines.push('## Known characters in or around this chapter', ...chars.slice(0, 40).map((id) => digest(model, model.entities[id], { full: true })), '');
    const events = Object.values(model.entities).filter((e) => e.type === 'event').map((e) => e.title);
    if (events.length) lines.push('## Event names so far (reuse exact names)', events.slice(-60).join(' · '), '');
  } else {
    if (others.length) lines.push('## Known places, groups and things in this chapter', ...others.slice(0, 40).map((id) => digest(model, model.entities[id], { full: false })), '');
    if (chars.length) lines.push('## Known characters (names only, use exactly)', chars.map((id) => model.entities[id].title).join(' · '), '');
    const glossary = Object.values(model.entities).find((e) => e.title === 'Glossary');
    const terms = glossary ? Object.values(glossary.sections).map((s) => s.text).join('\n').match(/^\|\s*([^|]+?)\s*\|/gm)?.slice(2).map((t) => t.replace(/^\|\s*|\s*\|$/g, '')) ?? [] : [];
    if (terms.length) lines.push('## Glossary terms already recorded', terms.slice(-80).join(' · '), '');
  }
  const allNames = Object.values(model.entities).filter((e) => ENTITY_TYPES.has(e.type) && e.type !== 'event' && !['Glossary', 'Chronology'].includes(e.title) && !/^Chronology of /.test(e.title)).map((e) => e.title);
  lines.push(`## All known names (${allNames.length}), use these spellings to link`, allNames.slice(0, 400).join(' · '));
  return lines.join('\n');
}

export function chapterSource(worldDir, story, cid) {
  const num = /-(C\d+)$/.exec(cid)?.[1];
  // book chapters live in _sources/<story>/; expansion stories keep their prose in Stories/<story>/Text/
  const p = [join(worldDir, '_sources', story, `${num}.md`), join(worldDir, 'Stories', story, 'Text', `${num}.md`)].find(existsSync) ?? '';
  return p && existsSync(p) ? { path: p, text: readFileSync(p, 'utf8') } : null;
}
export { chapterRef };
