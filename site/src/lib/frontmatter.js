// Line-based frontmatter edits that keep the author's comments and formatting intact.
import { load } from 'js-yaml';

function fmBounds(lines) {
  if (lines[0]?.trim() !== '---') return null;
  const end = lines.indexOf('---', 1) >= 0 ? lines.indexOf('---', 1) : lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  return end > 0 ? end : null;
}

/** Sets `key: "<value>"` (replacing an existing line, or adding one before the closing ---). */
export function setField(text, key, value) {
  return setRaw(text, key, JSON.stringify(value));
}

/** Like setField, but writes the YAML value verbatim (e.g. a flow map `{x: 0.4, y: 0.6}`). */
export function setRaw(text, key, raw) {
  const lines = text.split('\n');
  const end = fmBounds(lines);
  const line = `${key}: ${raw}`;
  if (end == null) return `---\n${line}\n---\n${text}`;
  const i = lines.slice(1, end).findIndex((l) => l.startsWith(`${key}:`));
  if (i >= 0) {
    // drop a following block list belonging to the old value
    let j = i + 2;
    while (j < end && /^\s+-\s/.test(lines[j])) j++;
    lines.splice(i + 1, j - (i + 1), line);
  } else lines.splice(end, 0, line);
  return lines.join('\n');
}

/** Appends an item to a YAML list field (flow `[...]` or block), rewriting it as a block list. */
export function addListItem(text, key, itemFlow) {
  const lines = text.split('\n');
  const end = fmBounds(lines);
  if (end == null) return `---\n${key}:\n  - ${itemFlow}\n---\n${text}`;
  const i = lines.slice(1, end).findIndex((l) => l.startsWith(`${key}:`)) + 1;
  if (i === 0) { lines.splice(end, 0, `${key}:`, `  - ${itemFlow}`); return lines.join('\n'); }
  const rest = lines[i].slice(key.length + 1).replace(/\s+#.*$/, '').trim();
  let j = i + 1;
  while (j < end && /^\s+-\s/.test(lines[j])) j++;
  const block = lines.slice(i + 1, j);
  let items = block.map((l) => l.replace(/^\s+-\s/, ''));
  if (rest && rest !== '[]') {
    try {
      const parsed = load(rest);
      items = (Array.isArray(parsed) ? parsed : [parsed]).map((v) => toFlow(v)).concat(items);
    } catch { items = [rest, ...items]; }
  }
  items.push(itemFlow);
  lines.splice(i, j - i, `${key}:`, ...items.map((s) => `  - ${s}`));
  return lines.join('\n');
}

function toFlow(v) {
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${k}: ${typeof x === 'string' && /[\[\]{}:,#]/.test(x) ? JSON.stringify(x) : x}`).join(', ')}}`;
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

/** Removes `key:` (and a block list under it) from the frontmatter. */
export function removeField(text, key) {
  const lines = text.split('\n');
  const end = fmBounds(lines);
  if (end == null) return text;
  const i = lines.slice(1, end).findIndex((l) => l.startsWith(`${key}:`)) + 1;
  if (i === 0) return text;
  let j = i + 1;
  while (j < end && /^\s+-\s/.test(lines[j])) j++;
  lines.splice(i, j - i);
  return lines.join('\n');
}
