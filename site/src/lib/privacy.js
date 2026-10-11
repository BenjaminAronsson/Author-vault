// Living people (living: true) in genealogy worlds: hidden in the viewer by default, and removed from a data file
// built with --redact-living (for a copy you share). Keeps the tree's shape: a numbered placeholder takes their place.
export const REDACTED = 'Levande person';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Replaces living people in a parsed model (in place, returns the new model object). → { model, count } */
export function redactLiving(model) {
  const living = Object.values(model.entities).filter((e) => e.type === 'character' && (e.living || e.fm?.living === true));
  if (!living.length) return { model, count: 0 };
  // their own notes besides the main one (voice, memories) go entirely
  for (const e of living) {
    const folder = e.path.split('/').slice(0, -1).join('/') + '/';
    for (const o of Object.values(model.entities)) if (o.id !== e.id && folder.startsWith('Characters/') && o.path.startsWith(folder)) delete model.entities[o.id];
    Object.assign(e, {
      aliases: [], born: null, died: null, image: null, portraits: [], gallery: [], preamble: '', timeline: [], voice: null, memories: [], perspectives: [],
      fm: { type: 'character', living: true }, sections: {}, sectionOrder: [], relationsTable: [], goals: [], fears: [], dreams: [], knowledge: [], links: [],
    });
  }
  // then every mention anywhere (ids, paths, links, text) becomes the placeholder
  let json = JSON.stringify(model);
  living.forEach((e, i) => {
    const name = e.path.split('/').pop().replace(/\.md$/, '');
    const ph = `${REDACTED} ${i + 1}`;
    for (const n of new Set([name, e.title].filter((x) => x && x.length > 2))) json = json.replace(new RegExp(esc(JSON.stringify(n).slice(1, -1)), 'gi'), ph);
  });
  const out = JSON.parse(json);
  for (const k of Object.keys(out.nameIndex)) {
    const id = out.nameIndex[k];
    if (k !== k.toLowerCase()) { delete out.nameIndex[k]; out.nameIndex[k.toLowerCase()] ??= id; } // keys were lower-case names
    if (!out.entities[id]) delete out.nameIndex[k.toLowerCase()];
  }
  return { model: out, count: living.length };
}
