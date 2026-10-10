// Derived views of a parsed world: reading order per continuity, state snapshots per step,
// visibility (spoiler gating) and data coverage. Pure functions, used by tests and the app.
import { chapterRef } from './markdown.js';

const POSITIVE = /(love|devot|trust|friend|kin|ally|loyal|admir|fond|warm|respect|curios)/i;
const NEGATIVE = /(hate|contempt|fear|dread|distrust|enemy|rival|resent|cold|disgust|anger|betray|indifferen)/i;
export function sentimentOf(text) {
  if (!text) return 0;
  if (/indifferen/i.test(text)) return 0;
  if (NEGATIVE.test(text)) return /(hate|contempt|enemy|betray)/i.test(text) ? -2 : -1;
  if (POSITIVE.test(text)) return /(love|devot|kin)/i.test(text) ? 2 : 1;
  return 0;
}

/** "after B1-C03" / "between B1-C03 and B1-C04" → "B1-C03" */
export function placementAnchor(placement) {
  const m = /(?:after|between)\s+([^\s,]+)/i.exec(placement ?? '');
  return m ? chapterRef(m[1]) : null;
}

/** Reading order per continuity: { main: [chapterIds], 'what-if-x': [...] } plus fork info. */
export function buildClock(model, canonFilter = null) {
  const allowed = (canon) => !canonFilter || canonFilter.has(canon ?? 'book');
  const stories = Object.values(model.stories).filter((s) => allowed(s.canon));
  const main = stories.filter((s) => s.continuity === 'main');
  const base = main.filter((s) => !placementAnchor(s.placement)).sort((a, b) => a.order - b.order);
  const baseIds = new Set(base.map((s) => s.id));
  const seq = base.flatMap((s) => s.chapters.filter((c) => allowed(model.chapters[c].canon)));
  // insert placed main-continuity stories (side stories) after their anchor chapter
  for (const s of main.filter((s) => placementAnchor(s.placement)).sort((a, b) => a.order - b.order)) {
    const anchor = placementAnchor(s.placement);
    let i = seq.indexOf(anchor);
    if (i < 0) { seq.push(...s.chapters); continue; }
    while (i + 1 < seq.length && !baseIds.has(model.chapters[seq[i + 1]].story)) i++; // after earlier inserts
    seq.splice(i + 1, 0, ...s.chapters);
  }
  const sequences = { main: seq };
  const forks = {};
  for (const s of stories.filter((s) => s.continuity !== 'main')) {
    const anchor = placementAnchor(s.placement);
    const cut = anchor && seq.includes(anchor) ? seq.indexOf(anchor) + 1 : seq.length;
    const prev = sequences[s.continuity] ?? seq.slice(0, cut);
    sequences[s.continuity] = [...prev, ...s.chapters];
    forks[s.continuity] ??= { at: anchor, story: s.id };
  }
  return { sequences, forks, continuities: Object.keys(sequences) };
}

/** Index of every step-bound fact, so snapshots are a single pass. */
function indexByStep(model, allowed) {
  const byStep = {};
  for (const e of Object.values(model.entities)) {
    if (!allowed(e.canon)) continue;
    for (const t of e.timeline ?? []) {
      if (!t.step || !allowed(t.canon ?? e.canon)) continue;
      (byStep[t.step] ??= []).push({ entity: e.id, entry: t });
    }
  }
  return byStep;
}

/**
 * State after each step of a continuity's sequence.
 * snapshot = { step, onStage:[ids], presence:{id:{place,src}}, rel:{'a>b':{bond,n,src,since}}, status:{id}, goals:{id:{goal:status}}, introduced:Set }
 */
export function buildSnapshots(model, sequence, canonFilter = null) {
  const allowed = (c) => !canonFilter || canonFilter.has(c ?? 'book');
  const byStep = indexByStep(model, allowed);
  const presence = {}, rel = {}, status = {}, goals = {};
  const introduced = new Set();
  const lastChange = {};
  const snaps = [];
  sequence.forEach((cid, i) => {
    const ch = model.chapters[cid];
    const changed = [];
    for (const id of [...ch.characters, ...ch.places, ...ch.events]) introduced.add(id);
    const taggedAt = new Set();
    for (const { entity, entry } of byStep[cid] ?? []) {
      introduced.add(entity);
      const t = entry.tags;
      if (t.at) { presence[entity] = { place: t.at, src: 'tag' }; taggedAt.add(entity); }
      if (t.status) status[entity] = t.status;
      for (const g of t.goal) (goals[entity] ??= {})[g.goal] = g.status;
      for (const r of t.rel) {
        if (!r.toId) continue;
        const key = `${entity}>${r.toId}`;
        const prev = rel[key];
        rel[key] = { from: entity, to: r.toId, bond: r.bond, n: r.n, src: 'tag', since: cid };
        if (!prev || prev.n !== r.n || prev.bond !== r.bond) changed.push({ ...rel[key], prev: prev ?? null });
      }
    }
    // Fallback presence from chapter frontmatter
    for (const c of ch.characters) {
      if (taggedAt.has(c)) continue;
      if (ch.places.length) presence[c] = { place: ch.places[0], src: 'chapter' };
    }
    for (const e of changed) lastChange[`${e.from}>${e.to}`] = cid;
    snaps.push({
      step: cid, index: i,
      onStage: [...new Set([...ch.characters, ...(byStep[cid] ?? []).filter((x) => model.entities[x.entity]?.type === 'character').map((x) => x.entity)])],
      presence: { ...presence }, rel: { ...rel }, status: { ...status },
      goals: Object.fromEntries(Object.entries(goals).map(([k, v]) => [k, { ...v }])),
      introduced: new Set(introduced), relChanges: changed,
    });
  });
  return snaps;
}

/** Static relation edges from Relations tables and co-appearance, used when no rel: tag exists. */
export function fallbackEdges(model, canonFilter = null) {
  const allowed = (c) => !canonFilter || canonFilter.has(c ?? 'book');
  const edges = {};
  for (const e of Object.values(model.entities)) {
    if (e.type !== 'character' || !allowed(e.canon)) continue;
    for (const r of e.relationsTable ?? []) {
      if (!r.with) continue;
      edges[`${e.id}>${r.with}`] = { from: e.id, to: r.with, bond: r.bond || r.feels, n: sentimentOf(r.feels || r.bond), src: 'table', feels: r.feels };
      if (r.back && !edges[`${r.with}>${e.id}`]) edges[`${r.with}>${e.id}`] = { from: r.with, to: e.id, bond: r.bond, n: sentimentOf(r.back), src: 'table', feels: r.back, inferred: true };
    }
  }
  const co = {};
  for (const ch of Object.values(model.chapters)) {
    if (!allowed(ch.canon)) continue;
    const cs = ch.characters;
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const k = [cs[i], cs[j]].sort().join('|');
      co[k] = (co[k] ?? 0) + 1;
    }
  }
  return { edges, co };
}

/** First step index at which an entity becomes known in a sequence (or -1 = always known / undated). */
export function introductionIndex(model, sequence) {
  const idx = Object.fromEntries(sequence.map((c, i) => [c, i]));
  const first = {};
  const see = (id, cid) => { if (cid in idx && (first[id] === undefined || idx[cid] < first[id])) first[id] = idx[cid]; };
  for (const cid of sequence) {
    const ch = model.chapters[cid];
    [...ch.characters, ...ch.places, ...ch.events].forEach((id) => see(id, cid));
    see(ch.entity, cid);
  }
  for (const e of Object.values(model.entities)) {
    if (e.firstSeen) see(e.id, e.firstSeen);
    for (const t of e.timeline ?? []) if (t.step) see(e.id, t.step);
    if (e.openedAt) see(e.id, e.openedAt);
  }
  const out = {};
  for (const e of Object.values(model.entities)) {
    const dated = e.firstSeen || (e.timeline ?? []).some((t) => t.step) || e.type === 'chapter' || e.openedAt;
    out[e.id] = first[e.id] ?? (dated ? Infinity : -1);
  }
  return out;
}

export function coverage(model) {
  const chars = Object.values(model.entities).filter((e) => e.type === 'character');
  const has = (pred) => chars.filter(pred).length;
  const chs = Object.values(model.chapters);
  return {
    characters: chars.length,
    withRel: has((c) => c.timeline.some((t) => t.tags.rel.length)),
    withAt: has((c) => c.timeline.some((t) => t.tags.at)),
    withImage: has((c) => c.image || c.portraits.length),
    withVoice: has((c) => c.voice?.moods.length),
    withMemories: has((c) => c.memories?.length),
    withGoals: has((c) => c.goals?.length),
    chapters: chs.length,
    chaptersWithCast: chs.filter((c) => c.characters.length).length,
    chaptersWithPlaces: chs.filter((c) => c.places.length).length,
    warnings: model.warnings.length,
  };
}
