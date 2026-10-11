// Small frontmatter edits made in the viewer (map pins, local maps): written straight into the vault in
// folder mode, otherwise kept in the browser (localStorage) until saved or copied as YAML.
import { store } from './store.svelte.js';
import { setRaw, removeField } from './frontmatter.js';
import { writeFile, readFile, pickWorldDir } from './images.js';

const KEY = (w) => `edits:${w}`;
const toRaw = (key, value) => (value == null ? null : key === 'map' ? `{x: ${value.x.toFixed(3)}, y: ${value.y.toFixed(3)}}` : JSON.stringify(value));

function applyToModel({ id, key, value }) {
  const e = store.model.entities[id];
  if (!e) return;
  if (key === 'map') e.map = value ? { x: value.x, y: value.y } : null;
  if (key === 'map_image') { e.mapSketch = value === 'sketch'; if (value == null) e.mapImage = null; }
  if (key === 'depicts' || key === 'regions') retag(e, key, value);
  e.fm = { ...e.fm, [key]: value ?? undefined };
}
// photo tags: keep the Media note's people and everyone's photo lists in step with the edit
const idOf = (ref) => store.model.nameIndex[String(ref ?? '').replace(/^\[\[|\]\]$/g, '').split('|')[0].trim().toLowerCase()] ?? null;
function retag(e, key, value) {
  if (key === 'regions') { e.regions = (value ?? []).map((r) => ({ ...r, who: idOf(r.who) })).filter((r) => r.who); return; }
  const before = new Set(e.depicts ?? []);
  e.depicts = (value ?? []).map(idOf).filter(Boolean);
  for (const id of before) if (!e.depicts.includes(id)) { const t = store.model.entities[id]; if (t?.media) t.media = t.media.filter((m) => m !== e.id); }
  for (const id of e.depicts) { const t = store.model.entities[id]; if (t && !(t.media ?? []).includes(e.id)) t.media = [...(t.media ?? []), e.id]; }
}
function persist() { try { localStorage.setItem(KEY(store.model.world), JSON.stringify(store.pendingEdits)); } catch {} }

export function loadEdits(world) {
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY(world)) || '[]'); } catch {}
  store.pendingEdits = list;
  list.forEach(applyToModel);
  if (list.length) store.touch();
}

async function ensurePermission(dir) {
  if ((await dir.queryPermission?.({ mode: 'readwrite' })) !== 'granted') await dir.requestPermission?.({ mode: 'readwrite' });
}

/** Sets (or with value=null removes) a frontmatter field on an entity. */
export async function editField(entity, key, value) {
  const edit = { id: entity.id, path: entity.path, key, value: value ?? null, raw: toRaw(key, value) };
  applyToModel(edit);
  store.touch();
  if (store.source?.dir) {
    await ensurePermission(store.source.dir);
    const text = await readFile(store.source.dir, entity.path);
    await writeFile(store.source.dir, entity.path, edit.raw == null ? removeField(text, key) : setRaw(text, key, edit.raw));
    return { saved: true };
  }
  store.pendingEdits = [...store.pendingEdits.filter((p) => !(p.path === edit.path && p.key === key)), edit];
  persist();
  return { saved: false };
}

/** Writes all pending edits into the world folder (asks for it if needed). */
export async function saveEdits(givenDir = null) {
  if (!store.pendingEdits.length) return 0;
  const dir = givenDir ?? store.source?.dir ?? (await pickWorldDir());
  await ensurePermission(dir);
  for (const e of store.pendingEdits) {
    const text = await readFile(dir, e.path);
    await writeFile(dir, e.path, e.raw == null ? removeField(text, e.key) : setRaw(text, e.key, e.raw));
  }
  const n = store.pendingEdits.length;
  store.pendingEdits = [];
  persist();
  store.source = { ...store.source, dir };
  return n;
}

/** Pending edits as YAML lines grouped by note, for copy-paste. */
export function editsYaml() {
  const by = {};
  for (const e of store.pendingEdits) (by[e.path] ??= []).push(e.raw == null ? `# remove: ${e.key}` : `${e.key}: ${e.raw}`);
  return Object.entries(by).map(([p, lines]) => `${p}\n  ${lines.join('\n  ')}`).join('\n\n');
}
