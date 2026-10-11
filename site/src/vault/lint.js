// Mechanical continuity checks (no AI). Judgment items go to the continuity-keeper; the rest can be fixed by script.
import { buildClock, buildSnapshots, introductionIndex } from '../parser/derive.js';
import { parseDate, yearOf, compareDateClaims } from '../lib/dates.js';

export function lint(model, { touched = null } = {}) {
  const issues = [];
  const add = (kind, path, msg, judgment = false) => { if (!touched || touched.has(path)) issues.push({ kind, path, msg, judgment }); };
  const ents = Object.values(model.entities);

  for (const w of model.warnings) add(w.kind === 'unresolved-link' ? 'broken-link' : w.kind, w.path, w.msg, false);

  // duplicate entities: same name or alias used by two notes
  const owners = {};
  for (const e of ents) {
    if (['chapter', 'story', 'voice', 'memory', 'chronology', 'world'].includes(e.type)) continue;
    for (const n of new Set([e.title, e.name, ...(e.aliases ?? [])].map((x) => x?.toLowerCase()).filter(Boolean))) (owners[n] ??= new Set()).add(e.path);
  }
  for (const [n, set] of Object.entries(owners)) if (set.size > 1) for (const p of set) add('duplicate-name', p, `"${n}" is used by ${[...set].join(' and ')}`, true);

  const clock = buildClock(model);
  const seq = clock.sequences.main;
  const idx = Object.fromEntries(seq.map((c, i) => [c, i]));
  const intro = introductionIndex(model, seq);

  // present or only talked about? Someone in a chapter's cast with no timeline line there, who isn't its POV,
  // may only have been named. A hint, not an error: re-extracting the chapter sorts it out.
  if (!model.genealogy) {
    const lineAt = new Set(ents.flatMap((e) => e.timeline.filter((t) => t.step).map((t) => `${e.id}@${t.step}`)));
    for (const ch of Object.values(model.chapters)) {
      if (ch.timeStep || !ch.entity) continue;
      const odd = ch.characters.filter((c) => c !== ch.pov && !lineAt.has(`${c}@${ch.id}`));
      if (odd.length) add('maybe-mentioned', model.entities[ch.entity]?.path ?? ch.id, `${odd.length} in characters: with no timeline line here (${odd.map((c) => model.entities[c]?.title ?? c).slice(0, 5).join(', ')}${odd.length > 5 ? '…' : ''}): present, or only talked about? Move to mentioned: if not there`, true);
    }
  }

  for (const e of ents) {
    if (e.type !== 'character') continue;
    // timeline order
    const steps = e.timeline.filter((t) => t.step && t.step in idx).map((t) => idx[t.step]);
    if (steps.some((s, i) => i && s < steps[i - 1])) add('timeline-order', e.path, 'Timeline lines are out of reading order', false);
    // essentials (genealogy: people are documented, not written — only Relations is expected)
    for (const s of model.genealogy ? ['Relations'] : ['Goals', 'Fears', 'Dreams', 'Relations']) {
      const empty = s === 'Goals' ? !(e.goals ?? []).length : s === 'Fears' ? !(e.fears ?? []).length : s === 'Dreams' ? !(e.dreams ?? []).length : !(e.relationsTable ?? []).length;
      const minor = (e.timeline ?? []).length < 3;
      if (empty && !minor) add('missing-essential', e.path, `${s} is empty`, true);
    }
    // one-sided relations: A lists B, B doesn't list A
    for (const r of e.relationsTable ?? []) {
      const other = r.with && model.entities[r.with];
      if (other?.type === 'character' && !(other.relationsTable ?? []).some((x) => x.with === e.id)) add('one-sided-relation', other.path, `${e.title} lists ${other.title}, but not the other way round`, false);
    }
    // acting after death
    const deathAt = e.timeline.find((t) => /dead/.test(t.tags.status ?? '') && t.step in idx);
    if (deathAt) for (const t of e.timeline) if (t.step in idx && idx[t.step] > idx[deathAt.step] && (t.canon ?? e.canon) === 'book' && !/flashback|memory|remember|ghost|portrait|begrav|jordf|bouppteck|dödsbo|arvskifte|minne/i.test(t.text)
      && !(model.genealogy && compareDateClaims(deathAt.marker, t.marker) !== 'conflict')) // not the same death, dated more precisely by another source
      add('after-death', e.path, `${t.marker}: active after dying at ${deathAt.marker}`, true);
  }
  // timeline lines before the entity is introduced (first_seen later than a dated line)
  for (const e of ents) {
    const fs = e.firstSeen && idx[e.firstSeen];
    if (fs === undefined || fs === null) continue;
    for (const t of e.timeline ?? []) if (t.step in idx && idx[t.step] < fs) add('before-first-seen', e.path, `${t.marker} is before first_seen ${e.firstSeen}`, false);
  }
  // voice quotes without a source
  for (const e of ents) for (const m of e.voice?.moods ?? []) for (const q of m.quotes) if (!q.source) add('quote-without-source', e.voice.entity + '.md', `"${q.text.slice(0, 50)}…" has no chapter link`, false);
  if (model.genealogy) genealogyChecks(model, ents, add);
  void intro; void buildSnapshots;
  return { issues, judgment: issues.filter((i) => i.judgment), mechanical: issues.filter((i) => !i.judgment) };
}

/** Kinship and identity checks for genealogy worlds (SCHEMA › Archive & kinship). */
function genealogyChecks(model, ents, add) {
  const people = ents.filter((e) => e.type === 'character');
  const year = (v) => yearOf(parseDate(v));
  const now = new Date().getFullYear();
  for (const e of people) {
    const b = year(e.born), d = year(e.died);
    if (b && d && d < b) add('died-before-born', e.path, `died ${e.died} before born ${e.born}`, true);
    for (const pid of e.kin?.parents ?? []) {
      const p = model.entities[pid];
      const pb = year(p?.born), pd = year(p?.died);
      if (b && pb && b - pb < 12) add('parent-age', e.path, `${p.title} (born ${p.born}) is ${b - pb} years older than ${e.title} (born ${e.born})`, true);
      if (b && pd && b > pd + 1) add('born-after-parent-death', e.path, `born ${e.born}, but parent ${p.title} died ${p.died}`, true);
      if (!(p?.kin?.children ?? []).includes(e.id)) add('one-sided-kin', p?.path ?? e.path, `${e.title} lists ${p?.title ?? pid} as parent, but not the other way round`, false);
    }
    for (const k of ['spouses', 'siblings']) for (const oid of e.kin?.[k] ?? []) {
      const o = model.entities[oid];
      if (o && !(o.kin?.[k] ?? []).includes(e.id)) add('one-sided-kin', o.path, `${e.title} lists ${o.title} in ${k}, but not the other way round`, false);
    }
    if (!d && !e.living && b && now - b < 110 && !/dead|död/.test(e.status ?? '')) add('maybe-living', e.path, `born ${e.born}, no death recorded: set living: true (hidden in the viewer) or add the death`, false);
    if (e.sections.Contradictions?.text?.trim()) add('contradiction', e.path, 'has open contradictions between sources: attribute or keep both', true);
  }
  // possible duplicates: same name without the "(1843–1910)" years, and lifespans that could overlap. Never merged automatically.
  const base = (s) => String(s).replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase();
  const byName = {};
  for (const e of people) for (const n of new Set([e.title, ...(e.aliases ?? [])].map(base))) (byName[n] ??= new Set()).add(e);
  const seen = new Set();
  for (const [n, set] of Object.entries(byName)) {
    const xs = [...set];
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
      const [a, c] = [xs[i], xs[j]];
      const key = [a.id, c.id].sort().join('|');
      if (seen.has(key)) continue;
      const ba = year(a.born), bc = year(c.born);
      if (ba && bc && Math.abs(ba - bc) > 2) continue; // namesakes a generation apart
      seen.add(key);
      add('possible-duplicate', a.path, `"${n}": ${a.title} and ${c.title} may be the same person (suggest, don't merge)`, true);
    }
  }
}
