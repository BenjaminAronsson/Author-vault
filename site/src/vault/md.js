// Line-based markdown editing for notes: find `## sections`, append lines once, add or update table rows.
// Everything is append-only: lines are only ever added, or a single table cell is updated.

const norm = (s) => String(s ?? '').toLowerCase().replace(/\[\[([^\]|#]+)(?:[^\]]*)?\]\]/g, '$1').replace(/[*_`"“”'’]/g, '').replace(/\s+/g, ' ').trim();
export { norm };

function bodyStart(lines) {
  if (lines[0]?.trim() !== '---') return 0;
  const end = lines.indexOf('---', 1);
  return end > 0 ? end + 1 : 0;
}

/** [start, end) line range of a `## heading` section (content after the heading line). null if missing. */
export function sectionRange(lines, heading) {
  const h = heading.toLowerCase();
  const from = bodyStart(lines);
  let i = lines.findIndex((l, k) => k >= from && /^## /.test(l) && l.slice(3).trim().toLowerCase().startsWith(h));
  if (i < 0) return null;
  let j = i + 1;
  while (j < lines.length && !/^## /.test(lines[j])) j++;
  return [i + 1, j];
}

/** Ensures `## heading` exists (appended at the end, or before `beforeHeading` if given). Returns lines. */
export function ensureSection(lines, heading, beforeHeading = null) {
  if (sectionRange(lines, heading)) return lines;
  const at = beforeHeading ? sectionRange(lines, beforeHeading) : null;
  const block = [`## ${heading}`, ''];
  if (at) { lines.splice(at[0] - 1, 0, ...block); return lines; }
  while (lines.length && lines.at(-1).trim() === '') lines.pop();
  lines.push('', ...block);
  return lines;
}

/** Index just after the last non-empty line of a range (where new lines go). */
function insertPoint(lines, [s, e]) {
  let k = e;
  while (k > s && lines[k - 1].trim() === '') k--;
  return k;
}

/** Appends lines to a section unless an equivalent line is already there. Returns number added. */
export function appendToSection(lines, heading, newLines) {
  ensureSection(lines, heading);
  let added = 0;
  for (const nl of newLines) {
    const r = sectionRange(lines, heading);
    const existing = new Set(lines.slice(r[0], r[1]).map(norm));
    if (existing.has(norm(nl))) continue;
    // drop template placeholders like "- " or "- **Wants:** " only when we add real content
    const at = insertPoint(lines, r);
    lines.splice(at, 0, nl);
    if (at === r[0] || lines[at - 1]?.trim() === '' || /^#{2,3} /.test(lines[at - 1] ?? '')) { /* fine */ }
    added++;
  }
  // keep one blank line after the section content
  const r = sectionRange(lines, heading);
  const ip = insertPoint(lines, r);
  if (ip === r[1] && r[1] < lines.length) lines.splice(ip, 0, '');
  return added;
}

/** Ensures `### sub` inside `## heading`, appends lines there (deduped). */
export function appendToSubsection(lines, heading, sub, newLines) {
  ensureSection(lines, heading);
  let r = sectionRange(lines, heading);
  let i = lines.slice(r[0], r[1]).findIndex((l) => /^### /.test(l) && norm(l.slice(4)) === norm(sub));
  if (i < 0) {
    const at = insertPoint(lines, r);
    lines.splice(at, 0, ...(at > r[0] && lines[at - 1].trim() !== '' ? [''] : []), `### ${sub}`);
    r = sectionRange(lines, heading);
    i = lines.slice(r[0], r[1]).findIndex((l) => /^### /.test(l) && norm(l.slice(4)) === norm(sub));
  }
  const subStart = r[0] + i + 1;
  let subEnd = subStart;
  while (subEnd < r[1] && !/^### /.test(lines[subEnd])) subEnd++;
  let added = 0;
  for (const nl of newLines) {
    const existing = new Set(lines.slice(subStart, subEnd + added).map(norm));
    if (existing.has(norm(nl))) continue;
    const at = insertPoint(lines, [subStart, subEnd + added]);
    lines.splice(at, 0, nl);
    added++;
  }
  return added;
}

const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const rowLine = (cs) => `| ${cs.join(' | ')} |`;

/**
 * Adds a row to the first table in a section (matching on the first column), or updates given columns
 * of an existing row (only cells listed in `update`). Creates the table with `header` if none exists.
 * Returns 'added' | 'updated' | 'unchanged'.
 */
export function upsertTableRow(lines, heading, header, row, { update = [] } = {}) {
  ensureSection(lines, heading);
  const r = sectionRange(lines, heading);
  let t0 = -1, t1 = -1;
  for (let k = r[0]; k < r[1]; k++) {
    if (/^\s*\|/.test(lines[k])) { if (t0 < 0) t0 = k; t1 = k; } else if (t0 >= 0) break;
  }
  if (t0 < 0) {
    const at = insertPoint(lines, r);
    const head = [rowLine(header), rowLine(header.map(() => '---'))];
    lines.splice(at, 0, ...(at > r[0] && lines[at - 1].trim() !== '' ? [''] : []), ...head);
    return upsertTableRow(lines, heading, header, row, { update });
  }
  const head = cells(lines[t0]).map((h) => h.toLowerCase());
  const col = (name) => head.findIndex((h) => h === name.toLowerCase() || h.startsWith(name.toLowerCase()));
  const values = head.map((h) => {
    const key = Object.keys(row).find((k) => h === k.toLowerCase() || h.startsWith(k.toLowerCase()));
    return key ? String(row[key] ?? '').replace(/\|/g, '/') : '';
  });
  // existing row with same first cell? (ignore placeholder rows with an empty first cell)
  for (let k = t0 + 2; k <= t1; k++) {
    const cs = cells(lines[k]);
    if (!cs[0]) continue;
    if (norm(cs[0]) === norm(values[0])) {
      let changed = false;
      for (const u of update) {
        const c = col(u);
        if (c >= 0 && values[c] && norm(cs[c]) !== norm(values[c])) { cs[c] = values[c]; changed = true; }
      }
      // fill empty cells (never overwrite filled ones unless listed in update)
      values.forEach((v, c) => { if (v && !cs[c]) { cs[c] = v; changed = true; } });
      if (changed) lines[k] = rowLine(cs.concat(Array(Math.max(0, head.length - cs.length)).fill('')).slice(0, head.length));
      return changed ? 'updated' : 'unchanged';
    }
  }
  // drop an empty placeholder row from the template, then add ours
  for (let k = t1; k >= t0 + 2; k--) if (!cells(lines[k])[0]) { lines.splice(k, 1); t1--; }
  lines.splice(t1 + 1, 0, rowLine(values));
  return 'added';
}

/** Removes template placeholder lines that would look like real content: empty list items, empty quotes. */
export function stripPlaceholders(text) {
  return text.split('\n').filter((l) => !/^\s*-\s*$/.test(l) && !/^>\s*""\s*—/.test(l) && !/^> \[!quote\][^\n]*$/.test(l) || false).join('\n');
}
