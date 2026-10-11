// In-world dates as genealogists write them: "1843-05-12", "12 maj 1843", "ca 1843", "före 1850",
// "mellan 1840 och 1845", "1840–45". Parsed into a sort key so steps can be ordered by real time,
// while the original text is kept as the label (dates are stored as written, see SCHEMA › Archive).

const MONTHS = {
  jan: 1, januari: 1, january: 1, feb: 2, febr: 2, februari: 2, february: 2, mar: 3, mars: 3, march: 3,
  apr: 4, april: 4, maj: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7,
  aug: 8, augusti: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};
const QUAL = [
  [/^(?:ca\.?|c:a|cirka|omkr\.?|omkring|abt\.?|about|~)\s*/i, 'about'],
  [/^(?:före|innan|bef\.?|before)\s+/i, 'before'],
  [/^(?:efter|aft\.?|after)\s+/i, 'after'],
];

/** One point: "1843-05-12" | "1843-05" | "1843" | "12 maj 1843" | "maj 1843" | "12/5 1843" → {y,m,d} */
function point(s) {
  s = s.trim().replace(/[.,]$/, '');
  let m;
  if ((m = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(s))) return { y: +m[1], m: +(m[2] ?? 0), d: +(m[3] ?? 0) };
  if ((m = /^(\d{1,2})\/(\d{1,2})\s+(\d{4})$/.exec(s))) return { y: +m[3], m: +m[2], d: +m[1] };
  if ((m = /^(?:(\d{1,2})\.?\s+)?([a-zåäö]+)\.?\s+(\d{4})$/i.exec(s)) && MONTHS[m[2].toLowerCase()]) return { y: +m[3], m: MONTHS[m[2].toLowerCase()], d: +(m[1] ?? 0) };
  return null;
}
const key = ({ y, m, d }) => y * 10000 + m * 100 + d;
const precisionOf = ({ m, d }) => (d ? 'day' : m ? 'month' : 'year');

/**
 * Parse a date expression.
 * → { sort, from, to, precision: day|month|year|span, qual: exact|about|before|after|between, label } or null.
 * `sort` orders steps: year-only sorts first within its year, "före X" just before X, "efter X" just after X.
 */
export function parseDate(text) {
  if (text === null || text === undefined) return null;
  const label = String(text).trim();
  if (!label) return null;
  let s = label, qual = 'exact';
  for (const [rx, q] of QUAL) if (rx.test(s)) { s = s.replace(rx, ''); qual = q; break; }
  let m;
  // spans: "mellan 1840 och 1845", "1840–1845", "1840-45" (a year range, not an ISO month)
  if (qual === 'exact' && ((m = /^(?:mellan|bet\.?|between)\s+(.+?)\s+(?:och|and|&)\s+(.+)$/i.exec(s)) || (m = /^(\d{4})\s*[–—]\s*(\d{2,4})$/.exec(s)) || (m = /^(\d{4})-(\d{2})$/.exec(s)) && +m[2] > 12 || (m = /^(\d{4})-(\d{4})$/.exec(s)))) {
    const a = point(m[1]);
    const bs = /^\d{2}$/.test(m[2]) && a ? String(a.y).slice(0, 2) + m[2] : m[2];
    const b = point(bs);
    if (a && b && key(b) >= key(a)) return { sort: key(a), from: key(a), to: key(b), precision: 'span', qual: 'between', label, year: a.y };
  }
  const p = point(s);
  if (!p) return null;
  const k = key(p);
  const sort = qual === 'before' ? k - 0.5 : qual === 'after' ? k + 0.5 : k;
  return { sort, from: qual === 'after' ? k : null, to: qual === 'before' ? k : null, precision: precisionOf(p), qual, label, year: p.y };
}

/** Year of a parsed date (start of a span). */
export const yearOf = (d) => d?.year ?? null;

/** Compare two date expressions (unparseable last). */
export function compareDates(a, b) {
  const x = parseDate(a), y = parseDate(b);
  if (!x || !y) return (x ? -1 : 0) - (y ? -1 : 0);
  return x.sort - y.sort;
}

/** Does this timeline marker look like a date rather than a chapter id? */
export const isDateMarker = (marker) => parseDate(marker) !== null;

const RANK = { span: 0, year: 1, month: 2, day: 3 };
/** Earliest/latest possible day (as sort keys) a date expression allows. "ca" allows ±5 years (ages in records are often off). */
function bounds(d) {
  const lo = (k) => k, hi = (k) => (k % 10000 === 0 ? k + 1231 : k % 100 === 0 ? k + 31 : k);
  if (d.qual === 'between') return [d.from, hi(d.to)];
  const k = Math.round(d.qual === 'before' ? d.to : d.qual === 'after' ? d.from : d.sort);
  if (d.qual === 'before') return [-Infinity, k];
  if (d.qual === 'after') return [k, Infinity];
  if (d.qual === 'about') return [lo(k) - 50000, hi(k) + 50000];
  return [lo(k), hi(k)];
}
/**
 * Two expressions of the same date from different sources:
 * 'same' | 'refines' (b is more precise and fits inside a) | 'coarser' (b fits a but says less) | 'conflict' | null (unparseable).
 */
export function compareDateClaims(a, b) {
  const x = parseDate(a), y = parseDate(b);
  if (!x || !y) return null;
  if (x.label === y.label) return 'same';
  const [xl, xh] = bounds(x), [yl, yh] = bounds(y);
  if (yh < xl || yl > xh) return 'conflict';
  const exact = (d) => d.qual === 'exact' ? RANK[d.precision] : 0.5;
  return exact(y) > exact(x) ? 'refines' : 'coarser';
}
