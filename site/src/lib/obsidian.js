/** Each world is its own Obsidian vault, named after the world folder. */
export function obsidianUrl(world, path) {
  if (!world || !path) return null;
  return `obsidian://open?vault=${encodeURIComponent(world)}&file=${encodeURIComponent(path.replace(/\.md$/, ''))}`;
}

/** "B1-C05" → "B1/C05" (the /become argument format). */
export const stepArg = (cid) => (cid ? cid.replace(/-(C\d+)$/, '/$1') : '');

export async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); return true;
  }
}
