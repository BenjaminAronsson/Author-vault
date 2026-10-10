// Small, dependency-light markdown helpers tailored to the vault's note shapes.
import { load as loadYaml } from 'js-yaml';

const WIKILINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

export function splitFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { fm: {}, body: text, error: null };
  try {
    return { fm: loadYaml(m[1]) ?? {}, body: text.slice(m[0].length), error: null };
  } catch (e) {
    return { fm: {}, body: text.slice(m[0].length), error: e.message.split('\n')[0] };
  }
}

/** All link targets in a string (or nested value), as raw names. */
export function wikilinks(value) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') for (const m of v.matchAll(WIKILINK)) out.push(m[1].trim());
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return out;
}

export function firstLink(value) {
  return wikilinks(value)[0] ?? null;
}

/** Splits a body into { title, preamble, sections: { [h2]: { text, subs: { [h3]: text } } } }. */
export function sections(body) {
  const res = { title: null, preamble: '', sections: {}, order: [] };
  let h2 = null, h3 = null;
  let fence = false;
  for (const line of body.split(/\r?\n/)) {
    if (/^```/.test(line)) fence = !fence;
    if (!fence) {
      const t = /^# (.+)/.exec(line);
      if (t && res.title === null) { res.title = t[1].trim(); continue; }
      const a = /^## (.+)/.exec(line);
      if (a) { h2 = a[1].trim(); h3 = null; res.sections[h2] ??= { text: '', subs: {}, subOrder: [] }; res.order.push(h2); continue; }
      const b = /^### (.+)/.exec(line);
      if (b && h2) { h3 = b[1].trim(); res.sections[h2].subs[h3] ??= ''; res.sections[h2].subOrder.push(h3); continue; }
    }
    if (!h2) res.preamble += line + '\n';
    else if (h3) res.sections[h2].subs[h3] += line + '\n';
    else res.sections[h2].text += line + '\n';
  }
  return res;
}

/** Full text of a section including its subsections (markdown). */
export function sectionMarkdown(sec) {
  if (!sec) return '';
  let s = sec.text;
  for (const h of sec.subOrder) s += `\n### ${h}\n${sec.subs[h]}`;
  return s.trim();
}

/** Parses the first markdown table in text into row objects keyed by lower-cased header. */
export function table(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter((l) => /^\s*\|/.test(l));
  if (lines.length < 2) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1)
    .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
    .map(cells)
    .filter((r) => r.some((c) => c && c !== '...'))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

/** "- item" lines (top level) of a text block. */
export function listItems(text) {
  if (!text) return [];
  return text.split(/\r?\n/).filter((l) => /^- /.test(l)).map((l) => l.slice(2).trim()).filter(Boolean);
}

/** Quotes in a block: "> "line" — [[B1-C02]]" or "- "line" ([[B1-C02]])". */
export function quotes(text) {
  if (!text) return [];
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const l = raw.replace(/^\s*(>|-)\s*/, '');
    const m = /[“"](.+?)[”"]/.exec(l);
    if (!m || !/^\s*(>|-)/.test(raw)) continue;
    out.push({ text: m[1], source: firstLink(l) });
  }
  return out;
}

/** Normalises "B1/C02", "[[B1-C02]]", "B1-C02" to a chapter id "B1-C02". */
export function chapterRef(v) {
  if (!v) return null;
  const s = String(firstLink(v) ?? v).trim();
  const m = /^(.+?)[/-](C\d+)$/i.exec(s);
  return m ? `${m[1]}-${m[2].toUpperCase()}` : null;
}

export function stripLinks(s) {
  return String(s ?? '').replace(WIKILINK, (_, a, b) => b ?? a);
}
