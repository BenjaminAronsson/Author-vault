// Mechanical continuity checks (no AI). Judgment items go to the continuity-keeper; the rest can be fixed by script.
import { buildClock, buildSnapshots, introductionIndex } from '../parser/derive.js';

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

  for (const e of ents) {
    if (e.type !== 'character') continue;
    // timeline order
    const steps = e.timeline.filter((t) => t.step && t.step in idx).map((t) => idx[t.step]);
    if (steps.some((s, i) => i && s < steps[i - 1])) add('timeline-order', e.path, 'Timeline lines are out of reading order', false);
    // essentials
    for (const s of ['Goals', 'Fears', 'Dreams', 'Relations']) {
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
    if (deathAt) for (const t of e.timeline) if (t.step in idx && idx[t.step] > idx[deathAt.step] && (t.canon ?? e.canon) === 'book' && !/flashback|memory|remember|ghost|portrait/i.test(t.text)) add('after-death', e.path, `${t.marker}: active after dying at ${deathAt.marker}`, true);
  }
  // timeline lines before the entity is introduced (first_seen later than a dated line)
  for (const e of ents) {
    const fs = e.firstSeen && idx[e.firstSeen];
    if (fs === undefined || fs === null) continue;
    for (const t of e.timeline ?? []) if (t.step in idx && idx[t.step] < fs) add('before-first-seen', e.path, `${t.marker} is before first_seen ${e.firstSeen}`, false);
  }
  // voice quotes without a source
  for (const e of ents) for (const m of e.voice?.moods ?? []) for (const q of m.quotes) if (!q.source) add('quote-without-source', e.voice.entity + '.md', `"${q.text.slice(0, 50)}…" has no chapter link`, false);
  void intro; void buildSnapshots;
  return { issues, judgment: issues.filter((i) => i.judgment), mechanical: issues.filter((i) => !i.judgment) };
}
