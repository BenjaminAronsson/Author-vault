// The /become briefing: what a character knows and is, exactly up to a cutoff chapter. No spoilers, no "truth".
import { buildClock, buildSnapshots } from '../parser/derive.js';
import { chapterRef } from '../parser/markdown.js';
import { parseDate } from '../lib/dates.js';
import { ageAt } from '../lib/kin.js';

/** Genealogy: "--at 1880-06-01" → the last date step on or before that date (steps are dates as written). */
function dateCut(model, seq, at) {
  if (model.chapters[at]?.timeStep) return at;
  const d = parseDate(at);
  if (!d) return null;
  return seq.filter((s) => !model.chapters[s]?.date || model.chapters[s].date.sort <= d.sort).at(-1) ?? null;
}

export function briefing(model, name, { at, cont = 'main' }) {
  const id = model.nameIndex[String(name).toLowerCase()];
  const e = id && model.entities[id];
  if (!e || e.type !== 'character') throw new Error(`No character "${name}"`);
  const clock = buildClock(model);
  const seq = clock.sequences[cont] ?? clock.sequences.main;
  const cut = (at && model.genealogy ? dateCut(model, seq, String(at)) : chapterRef(at)) ?? seq.at(-1);
  const ci = seq.indexOf(cut);
  if (ci < 0) throw new Error(`${at} is not in continuity ${cont}`);
  const ok = (cid) => !cid || (seq.indexOf(cid) >= 0 && seq.indexOf(cid) <= ci);
  const snap = buildSnapshots(model, seq)[ci];
  const strip = (s) => s.replace(/\s*\(\[\[[^\]]+\]\]\)\s*$/, '');
  const L = [`# Briefing: ${e.title} at ${cut}${cont !== 'main' ? ` (${cont})` : ''}`,
    `You know only what is below. Anything after ${cut} has not happened for you.`, ''];
  L.push('## Now', `- where: ${snap.presence[id] ? model.entities[snap.presence[id].place]?.title ?? snap.presence[id].place : 'unknown'}`, `- status: ${snap.status[id] ?? 'alive'}`);
  if (model.genealogy) {
    const a = ageAt(e, parseDate(at) ?? model.chapters[cut]?.date ?? null);
    if (a.age !== null) L.push(`- age: ${a.atDeath ? `died at about ${a.age}` : `about ${a.age}`}${a.approx ? ' (uncertain dates)' : ''}`);
    else if (a.deathUnknown) L.push('- age: very old by now; no death recorded in the sources');
  }
  const pre = (e.preamble.match(/"(.+?)"/) ?? [])[1];
  if (pre) L.push(`- signature line: "${pre}"`);
  L.push('');
  const goals = (e.goals ?? []).filter((g) => g.goal && ok(g.since)).map((g) => `- ${g.goal} [${snap.goals[id]?.[g.goal] ?? g.status ?? 'active'}]`);
  if (goals.length) L.push('## Goals', ...goals, '');
  const fears = (e.fears ?? []).filter((f) => ok(f.source)).map((f) => `- ${f.fear}${f.root ? ` (root: ${f.root})` : ''}`);
  if (fears.length) L.push('## Fears', ...fears, '');
  const dreams = (e.dreams ?? []).filter((d) => ok(d.source)).map((d) => `- ${strip(d.text)}`);
  if (dreams.length) L.push('## Dreams', ...dreams, '');
  const S = e.sections;
  for (const h of ['Core', 'Inner life', 'Values & lines', 'Under pressure', 'Skills & flaws', 'Daily life', 'Body & senses']) {
    // drop the template's empty fields and italic hints ("- **Faith:** _devotion (…)_", "_Who they are underneath_")
    const t = (S[h]?.text ?? '').split('\n').filter((l) => l.trim() && !/^- \*\*[^*]+:\*\*\s*(_[^_]*_)?\s*$/.test(l) && !/^\s*_[^_]+_\s*$/.test(l)).join('\n').trim();
    if (t) L.push(`## ${h}`, t, '');
  }
  const feel = Object.values(snap.rel).filter((r) => r.from === id).map((r) => `- ${model.entities[r.to]?.title}: ${r.bond} (${r.n > 0 ? '+' : ''}${r.n})`);
  const table = (e.relationsTable ?? []).filter((r) => r.withName && !Object.values(snap.rel).some((x) => x.from === id && x.to === r.with) && (snap.introduced.has(r.with) || !r.with)).map((r) => `- ${r.withName}: ${r.feels || r.bond}`);
  if (feel.length + table.length) L.push('## How you feel about people', ...feel, ...table, '');
  if (e.kin) {
    // family as of the cutoff: only people who exist by then (a child born later is unknown to you)
    const known = (pid) => snap.introduced.has(pid) || !model.entities[pid]?.firstSeen;
    const names = (ids) => ids.filter(known).map((pid) => model.entities[pid]?.title).filter(Boolean);
    const fam = [['parents', 'Parents'], ['siblings', 'Siblings'], ['spouses', 'Spouses'], ['children', 'Children']].map(([k, h]) => [h, names(e.kin[k] ?? [])]).filter(([, xs]) => xs.length);
    if (fam.length) L.push('## Your family', ...fam.map(([h, xs]) => `- ${h}: ${xs.join(', ')}`), '');
  }
  const know = (e.knowledge ?? []).filter((k) => ok(k.source)).map((k) => `- ${strip(k.text)}`);
  if (know.length) L.push('## What you know', ...know, '');
  const tl = (e.timeline ?? []).filter((t) => ok(t.step) && (t.step || t.marker === 'EXP')).map((t) => `- ${t.marker}: ${strip(t.text)}`);
  if (tl.length) L.push('## Your story so far', ...tl, '');
  const mem = (e.memories ?? []).filter((m) => ok(m.when)).map((m) => `### ${m.title.replace(/^.*remembers:\s*/, '')} (${m.accuracy}, ${m.charge})\n${m.text}`);
  if (mem.length) L.push('## Your memories (as you remember them)', ...mem, '');
  const v = e.voice;
  if (v) {
    const moods = v.moods.map((m) => ({ mood: m.mood, q: m.quotes.filter((q) => ok(q.source)) })).filter((m) => m.q.length);
    if (moods.length) L.push('## Your voice: lines you have said', ...moods.flatMap((m) => [`### ${m.mood}`, ...m.q.slice(-8).map((q) => `> "${q.text}"`)]), '');
    if (v.diction.length) L.push('## How you talk', ...v.diction.map((d) => `- ${d}`), '');
    const exp = v.expansion.filter((q) => ok(q.source));
    if (exp.length) L.push('## Lines from earlier conversations (expansion)', ...exp.map((q) => `> "${q.text}"`), '');
  }
  const seen = Object.values(model.entities).filter((x) => x.type === 'character' && x.id !== id && snap.introduced.has(x.id))
    .map((x) => {
      const p = (x.perspectives ?? []).find((pp) => pp.by === id);
      return p ? `- ${x.title}: ${strip(p.text.replace(/^- /, ''))}` : null;
    }).filter(Boolean);
  if (seen.length) L.push('## How you see others', ...seen, '');
  return L.join('\n');
}
