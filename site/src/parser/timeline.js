// Parses "- **B1-C03** · `pov:objective` · `at:[[Place]]` · text ([[B1-C03]])" lines.
import { wikilinks, firstLink } from './markdown.js';

export function parseTimelineLine(line) {
  const m = /^\s*- \*\*(.+?)\*\*\s*(.*)$/.exec(line);
  if (!m) return null;
  const entry = { marker: m[1].trim(), pov: null, canon: null, tags: { at: null, rel: [], status: null, goal: [] }, text: '', links: [] };
  const textParts = [];
  for (const part of m[2].split(/\s+·\s+|^·\s*/).map((p) => p.trim()).filter(Boolean)) {
    const t = /^`([a-z_]+):(.*)`$/i.exec(part);
    if (!t) { textParts.push(part); continue; }
    const [, key, val] = t;
    switch (key.toLowerCase()) {
      case 'pov': entry.pov = val; break;
      case 'canon': entry.canon = val; break;
      case 'at': entry.tags.at = firstLink(val) ?? val; break;
      case 'status': entry.tags.status = val; break;
      case 'rel': {
        const r = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]\s*=\s*([^/]*)\/\s*([+-]?\d+)/.exec(val);
        if (r) entry.tags.rel.push({ to: r[1].trim(), bond: r[2].trim(), n: Math.max(-2, Math.min(2, Number(r[3]))) });
        break;
      }
      case 'goal': {
        const g = /^"(.+)"\s*=\s*(\w+)/.exec(val);
        if (g) entry.tags.goal.push({ goal: g[1], status: g[2] });
        break;
      }
      default: (entry.tags.other ??= {})[key] = val;
    }
  }
  entry.text = textParts.join(' · ');
  entry.links = wikilinks(m[2]);
  return entry;
}

export function parseTimeline(text) {
  if (!text) return [];
  return text.split(/\r?\n/).map(parseTimelineLine).filter(Boolean);
}
