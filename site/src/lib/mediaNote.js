// The text of a Media note (a tagged photo). Pure, so both `vault add-media` and the viewer write the same shape.
const link = (x) => (/^\[\[/.test(String(x)) ? String(x) : `[[${String(x).trim()}]]`);
const q = (v) => JSON.stringify(String(v));

/** Frontmatter + body of a Media note. */
export function mediaNote({ file, title, depicts = [], date = null, place = null, event = null, caption = '', source = null, canon = 'book' }) {
  const fm = ['---', 'type: media', `file: ${q(file)}`, `depicts: [${depicts.filter(Boolean).map((d) => q(link(d))).join(', ')}]`,
    ...(date ? [`date: ${q(date)}`] : []), ...(place ? [`place: ${q(link(place))}`] : []), ...(event ? [`event: ${q(link(event))}`] : []),
    ...(caption ? [`caption: ${q(caption)}`] : []), ...(source ? [`source: ${q(link(source))}`] : []), `canon: ${canon}`, 'tags: [media]', '---'];
  return [...fm, `# ${title}`, '', `![[${file}]]`, '', caption ? `${caption}\n` : ''].join('\n');
}

