// GEDCOM 5.5.1 export of a genealogy world, for Disgen, MyHeritage, Holger and friends.
// People, births/deaths (with place and source), families from parents and spouses, and the archive as SOUR records.
// Living people are left out unless asked for.
import { parseDate, compareDates } from '../lib/dates.js';
import { kinIndex, kinDetail } from '../lib/kin.js';

const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** "1843-05-12" → "12 MAY 1843", "ca 1843" → "ABT 1843", "före 1850" → "BEF 1850", "1840–45" → "BET 1840 AND 1845" */
export function gedcomDate(text) {
  const d = parseDate(text);
  if (!d) return text ? `(${String(text).replace(/[()]/g, '')})` : null; // GEDCOM date phrase
  const one = (k) => { const y = Math.floor(k / 10000), m = Math.floor(k / 100) % 100, dd = Math.round(k % 100); return [dd || null, m ? MON[m - 1] : null, y].filter(Boolean).join(' '); };
  if (d.qual === 'between') return `BET ${one(d.from)} AND ${one(d.to)}`;
  if (d.qual === 'before') return `BEF ${one(d.to)}`;
  if (d.qual === 'after') return `AFT ${one(d.from)}`;
  return `${d.qual === 'about' ? 'ABT ' : ''}${one(Math.round(d.sort))}`;
}

/** "Anna Persdotter (1843–1910)" → "Anna /Persdotter/" (the last word is taken as the surname) */
export function gedcomName(title) {
  const n = String(title).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = n.split(/\s+/);
  return parts.length > 1 ? `${parts.slice(0, -1).join(' ')} /${parts.at(-1)}/` : `${n} //`;
}

export function toGedcom(model, { includeLiving = false, source = 'Author Vault' } = {}) {
  const people = Object.values(model.entities).filter((e) => e.type === 'character' && (includeLiving || !e.living));
  const keep = new Set(people.map((p) => p.id));
  const iid = new Map(people.map((p, i) => [p.id, `@I${i + 1}@`]));
  const sources = Object.values(model.chapters).filter((c) => c.archive);
  const sid = new Map(sources.map((c, i) => [c.id, `@S${i + 1}@`]));
  const L = ['0 HEAD', `1 SOUR ${source.replace(/\s+/g, '_')}`, '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8', `1 NOTE Exported from the world ${model.world}`];
  const text = (lvl, tag, s) => {
    const lines = String(s ?? '').split('\n');
    const out = [];
    lines.forEach((ln, i) => {
      let rest = ln;
      out.push(`${i ? lvl + 1 : lvl} ${i ? 'CONT' : tag} ${rest.slice(0, 200)}`.trimEnd());
      for (rest = rest.slice(200); rest; rest = rest.slice(200)) out.push(`${lvl + 1} CONC ${rest.slice(0, 200)}`);
    });
    return out;
  };
  const cite = (lvl, t) => {
    const src = t?.links?.map((l) => model.nameIndex[l.toLowerCase()] && Object.values(model.chapters).find((c) => c.entity === model.nameIndex[l.toLowerCase()] && c.archive)).find(Boolean);
    if (!src) return [];
    const q = { belagd: 3, trolig: 2, hypotes: 1 }[t.confidence] ?? (t.evidence === 'tradition' ? 0 : null);
    return [`${lvl} SOUR ${sid.get(src.id)}`, ...(q !== null ? [`${lvl + 1} QUAY ${q}`] : [])];
  };
  // the timeline line that dates a birth/death, for its place and source
  const lineFor = (e, date, rx) => e.timeline.find((t) => t.marker === date) ?? e.timeline.find((t) => rx.test(t.text));
  const event = (e, tag, date, rx) => {
    if (!date) return [];
    const t = lineFor(e, String(date), rx);
    const plac = t?.tags.at ? model.entities[t.tags.at]?.title : null;
    return [`1 ${tag}`, `2 DATE ${gedcomDate(date)}`, ...(plac ? [`2 PLAC ${plac}`] : []), ...cite(2, t)];
  };
  for (const e of people) {
    L.push(`0 ${iid.get(e.id)} INDI`, `1 NAME ${gedcomName(e.title)}`);
    const main = gedcomName(e.title);
    for (const a of e.aliases ?? []) if (a.split(/\s+/).length > 1 && gedcomName(a) !== main) L.push(`1 NAME ${gedcomName(a)}`, '2 TYPE aka');
    L.push(...event(e, 'BIRT', e.born, /föd|born/i), ...event(e, 'DEAT', e.died, /död|dör|dog|died/i));
    for (const t of e.timeline.filter((t) => t.step && !/föd|born|död|dör|died/i.test(t.text)).sort((a, b) => compareDates(a.marker, b.marker))) {
      L.push('1 EVEN', `2 TYPE ${t.text.replace(/\s*\(\[\[[^\]]+\]\]\)\s*$/, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).slice(0, 90)}`,
        ...(t.marker !== 'odaterat' ? [`2 DATE ${gedcomDate(t.marker)}`] : []), ...(t.tags.at && model.entities[t.tags.at] ? [`2 PLAC ${model.entities[t.tags.at].title}`] : []), ...cite(2, t));
    }
  }
  // families: one per couple (spouses, or two parents of the same child), single-parent families too
  const idx = kinIndex(model);
  const fams = new Map();
  const famOf = (a, b) => { const k = [a, b].filter(Boolean).sort().join('|'); if (!fams.has(k)) fams.set(k, { partners: [a, b].filter(Boolean), children: new Set() }); return fams.get(k); };
  for (const [a, set] of idx.spouses) for (const b of set) if (keep.has(a) && keep.has(b)) famOf(a, b);
  for (const [child, set] of idx.parents) {
    if (!keep.has(child)) continue;
    const ps = [...set].filter((p) => keep.has(p));
    if (!ps.length) continue;
    famOf(ps[0], ps[1]).children.add(child);
    for (const extra of ps.slice(2)) famOf(extra).children.add(child);
  }
  const famIds = [...fams.values()].map((f, i) => ({ ...f, id: `@F${i + 1}@` }));
  const famc = {}, fams_ = {};
  for (const f of famIds) {
    L.push(`0 ${f.id} FAM`);
    const sex = (id) => sexOf(model, id);
    const [p1, p2] = f.partners;
    const husb = f.partners.find((p) => sex(p) === 'M') ?? (sex(p1) === 'F' ? p2 : p1);
    const wife = f.partners.find((p) => p !== husb);
    if (husb) { L.push(`1 HUSB ${iid.get(husb)}`); (fams_[husb] ??= []).push(f.id); }
    if (wife) { L.push(`1 WIFE ${iid.get(wife)}`); (fams_[wife] ??= []).push(f.id); }
    if (p1 && p2) { const d = kinDetail(model, p1, p2); if (d.from) L.push('1 MARR', `2 DATE ${gedcomDate(d.from)}`); }
    for (const c of f.children) {
      L.push(`1 CHIL ${iid.get(c)}`);
      const d = kinDetail(model, c, f.partners[0]);
      if (d.type && d.type !== 'biologisk') L.push(`2 _FREL ${d.type === 'adoptiv' ? 'Adopted' : d.type === 'foster' ? 'Foster' : 'Step'}`);
      (famc[c] ??= []).push(f.id);
    }
  }
  // FAMC/FAMS links go on the people: insert after each INDI's NAME block (rebuild in order)
  const out = [];
  for (let i = 0; i < L.length; i++) {
    out.push(L[i]);
    const m = /^0 (@I\d+@) INDI$/.exec(L[i]);
    if (m) {
      const id = [...iid.entries()].find(([, v]) => v === m[1])[0];
      const sx = sexOf(model, id);
      let j = i + 1;
      while (j < L.length && !L[j].startsWith('0 ')) out.push(L[j++]);
      if (sx) out.push(`1 SEX ${sx}`);
      for (const f of famc[id] ?? []) out.push(`1 FAMC ${f}`);
      for (const f of fams_[id] ?? []) out.push(`1 FAMS ${f}`);
      i = j - 1;
    }
  }
  for (const c of sources) {
    out.push(`0 ${sid.get(c.id)} SOUR`, ...text(1, 'TITL', c.title || c.file || c.id));
    if (c.archiveRef) out.push(...text(1, 'PUBL', c.archiveRef));
    if (c.sourceKind || c.evidence) out.push(...text(1, 'NOTE', [c.sourceKind, c.evidence && `källvärde: ${c.evidence}`, c.dated && `daterad ${c.dated}`].filter(Boolean).join(' · ')));
  }
  out.push('0 TRLR');
  return out.join('\n') + '\n';
}

const MALE = new Set(['far', 'son', 'husbonde', 'dräng', 'bror', 'make', 'man', 'fosterson', 'styvson', 'styvfar', 'fosterfar']);
const FEMALE = new Set(['mor', 'dotter', 'matmor', 'piga', 'syster', 'maka', 'hustru', 'fosterdotter', 'styvdotter', 'styvmor', 'fostermor']);
/** M/F from the roles others' notes give this person ("kin · far"); neutral words ("make/maka", "syskon") don't count. */
function sexOf(model, id) {
  let m = 0, f = 0;
  for (const w of rowsText(model, id).split(/[^\p{L}/]+/u)) { if (w.includes('/')) continue; if (MALE.has(w)) m++; if (FEMALE.has(w)) f++; }
  return m > f ? 'M' : f > m ? 'F' : null;
}

/** How others' Relations rows name this person ("kin · far") — used to guess SEX for GEDCOM. */
function rowsText(model, id) {
  const own = []; // what others call this person: rows on other notes pointing at id carry *their* view; the row on id about X says what X is
  for (const e of Object.values(model.entities)) for (const r of e.relationsTable ?? []) if (r.with === id) own.push(String(r.bond).toLowerCase());
  return own.join(' ');
}
