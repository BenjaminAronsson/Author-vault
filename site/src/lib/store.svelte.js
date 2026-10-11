// Global app state: the loaded world, the reading bookmark, filters and navigation, mirrored in the URL hash.
import { load } from './storage.js';
import { buildClock, placementAnchor, buildSnapshots, fallbackEdges, introductionIndex, coverage } from '../parser/derive.js';

const CANONS = ['book', 'expansion', 'draft'];

class Store {
  index = $state(typeof window !== 'undefined' ? window.WORLD_INDEX ?? [] : []);
  model = $state.raw(null);
  source = $state.raw(null); // { kind: 'data' | 'folder', vault, dir? (FileSystemDirectoryHandle) }
  loading = $state(false);
  progress = $state(null); // text shown while reading a big folder
  error = $state(null);

  view = $state('home'); // home | timeline | people | places | entity
  sel = $state(null); // entity id
  at = $state(null); // bookmark chapter id
  cont = $state('main');
  canon = $state([...CANONS]);
  future = $state('hide'); // hide | dim
  card = $state(null); // { id, x, y } — the right-click info card
  showLiving = $state(false); // genealogy: people marked living: true stay hidden unless asked for
  searchOpen = $state(false);
  coverageOpen = $state(false);
  pending = $state([]); // images waiting to be saved to the vault
  pendingEdits = $state([]); // frontmatter edits (map pins…) waiting to be saved
  version = $state(0); // bump to re-derive after in-place edits

  canonSet = $derived(new Set(this.canon));
  clock = $derived(this.model ? (this.version, buildClock(this.model, this.canonSet)) : null);
  sequence = $derived(this.clock ? this.clock.sequences[this.cont] ?? this.clock.sequences.main : []);
  stepIndex = $derived(Object.fromEntries(this.sequence.map((c, i) => [c, i])));
  snaps = $derived(this.model ? (this.version, buildSnapshots(this.model, this.sequence, this.canonSet)) : []);
  idx = $derived(this.at && this.at in this.stepIndex ? this.stepIndex[this.at] : this.sequence.length - 1);
  snap = $derived(this.snaps[this.idx] ?? null);
  chapter = $derived(this.model && this.sequence[this.idx] ? this.model.chapters[this.sequence[this.idx]] : null);
  intro = $derived(this.model ? (this.version, introductionIndex(this.model, this.sequence)) : {});
  fallback = $derived(this.model ? fallbackEdges(this.model, this.canonSet) : { edges: {}, co: {} });
  cover = $derived(this.model ? (this.version, coverage(this.model)) : null);
  fork = $derived(this.clock?.forks[this.cont] ?? null);
  /** Books in reading order: base stories (and branch stories) own a range; inserted side stories live inside their host book. */
  books = $derived.by(() => {
    if (!this.model) return [];
    const placed = (sid) => { const s = this.model.stories[sid]; return s && s.continuity === 'main' && !!placementAnchor(s.placement); };
    const out = [];
    this.sequence.forEach((cid, i) => {
      const sid = this.model.chapters[cid].story;
      if (placed(sid) && out.length) {
        const b = out.at(-1); b.end = i;
        const ins = b.inserts.at(-1);
        if (ins && ins.story === sid && ins.end === i - 1) ins.end = i; else b.inserts.push({ story: sid, start: i, end: i });
        return;
      }
      if (!out.length || out.at(-1).story !== sid) {
        const st = this.model.stories[sid];
        out.push({ story: sid, title: st?.title ?? sid, canon: st?.canon ?? 'book', branch: st?.continuity !== 'main', start: i, end: i, inserts: [] });
      } else out.at(-1).end = i;
    });
    return out;
  });
  book = $derived(this.books.find((b) => this.idx >= b.start && this.idx <= b.end) ?? this.books[0] ?? null);
  follow = $state(null); // character the views keep in focus
  playing = $state(false);
  speed = $state(1800); // ms per chapter while playing
  /** How long movement animations take: longer while playing so the flow is easy to follow. */
  animMs = $derived(this.playing ? Math.min(1400, this.speed * 0.75) : 450);
  tourOpen = $state(false);
  entry = $derived(this.index.find((w) => w.name === this.model?.world) ?? null);

  /** Is this entity known at the bookmark (and allowed by the canon filter)? */
  visible(id) {
    const e = this.model?.entities[id];
    if (!e || !this.canonSet.has(e.canon ?? 'book')) return false;
    if (e.living && !this.showLiving) return false;
    if (e.continuity && e.continuity !== 'main' && e.continuity !== this.cont) return false;
    const i = this.intro[id];
    return i === -1 || i <= this.idx || (this.future === 'dim' && i !== Infinity);
  }
  /** Is it after the bookmark (only meaningful when future === 'dim')? */
  isFuture(id) {
    const i = this.intro[id];
    return i !== -1 && i > this.idx;
  }
  /** Step-bound fact (chapter id) visible at the bookmark? */
  stepVisible(cid) {
    if (!cid) return true;
    const i = this.stepIndex[cid];
    if (i === undefined) return this.future === 'dim';
    return i <= this.idx || this.future === 'dim';
  }
  stepIsFuture(cid) {
    const i = this.stepIndex[cid];
    return cid != null && (i === undefined || i > this.idx);
  }
  canonOk(c) { return this.canonSet.has(c ?? 'book'); }

  /** The image path for an entity at the bookmark (latest portrait at or before it, else main image). */
  imageFor(id) {
    const e = this.model?.entities[id];
    if (!e) return null;
    let best = null, bi = -1;
    for (const p of e.portraits ?? []) {
      const i = this.stepIndex[p.at];
      if (i !== undefined && i <= this.idx && i > bi) { best = p.image; bi = i; }
    }
    const path = best ?? e.image;
    if (!path) return null;
    return this.pending.find((p) => p.path === path)?.url ?? this.model.imageUrls?.[path] ?? null;
  }

  name(id) { return this.model?.entities[id]?.title ?? (id ? String(id).split('/').pop() : ''); }

  go(view, sel = null) {
    this.view = view; this.sel = sel;
    if (sel) this.searchOpen = false;
    writeHash(this, true);
  }
  open(id) { if (id) this.go('entity', id); }
  setAt(cid) { if (cid in this.stepIndex) { this.at = cid; writeHash(this, false); } }
  move(delta) {
    const i = Math.max(0, Math.min(this.sequence.length - 1, this.idx + delta));
    this.setAt(this.sequence[i]);
  }
  moveBook(dir) {
    const i = this.books.indexOf(this.book);
    const b = this.books[i + dir];
    if (dir < 0 && this.idx > this.book.start) return this.setAt(this.sequence[this.book.start]);
    if (b) this.setAt(this.sequence[b.start]);
  }
  moveStory(dir) {
    const seq = this.sequence, cur = this.model.chapters[seq[this.idx]]?.story;
    let i = this.idx;
    if (dir > 0) { while (i < seq.length - 1 && this.model.chapters[seq[i]].story === cur) i++; }
    else {
      while (i > 0 && this.model.chapters[seq[i - 1]].story === cur) i--;
      if (i === this.idx && i > 0) { i--; const s = this.model.chapters[seq[i]].story; while (i > 0 && this.model.chapters[seq[i - 1]].story === s) i--; }
    }
    this.setAt(seq[i]);
  }
  toggleCanon(c) {
    this.canon = this.canon.includes(c) ? this.canon.filter((x) => x !== c) : [...this.canon, c];
    if (!this.canon.length) this.canon = ['book'];
    if (!(this.cont in (this.clock?.sequences ?? {}))) this.cont = 'main';
    writeHash(this, false);
  }
  setFollow(id) { this.follow = id || null; writeHash(this, false); }
  setCont(c) { this.cont = c; if (!(this.at in this.stepIndex)) this.at = null; writeHash(this, false); }
  touch() { this.model = { ...this.model }; this.version++; }
}

export const store = new Store();

// ---- URL hash ----------------------------------------------------------------------------------
export function readHash(s = store) {
  const h = new URLSearchParams(location.hash.slice(1));
  return {
    world: h.get('world'),
    view: h.get('view') ?? 'home', sel: h.get('sel'), at: h.get('at'), cont: h.get('cont') ?? 'main', follow: h.get('follow'),
    canon: h.get('canon') ? h.get('canon').split(',').filter((c) => CANONS.includes(c)) : [...CANONS],
    future: h.get('future') === 'dim' ? 'dim' : 'hide',
    living: h.get('living') === 'show',
  };
}
export function applyHash(s = store) {
  const h = readHash(s);
  s.view = h.view; s.sel = h.sel; s.cont = h.cont; s.follow = h.follow; s.canon = h.canon.length ? h.canon : [...CANONS]; s.future = h.future; s.showLiving = h.living;
  s.at = h.at ?? (s.model ? load(`bookmark:${s.model.world}`) : null);
}
let writing = false;
export function writeHash(s = store, push = false) {
  if (!s.model) return;
  const h = new URLSearchParams();
  h.set('world', s.model.world);
  if (s.view !== 'home') h.set('view', s.view);
  if (s.sel) h.set('sel', s.sel);
  if (s.at) h.set('at', s.at);
  if (s.cont !== 'main') h.set('cont', s.cont);
  if (s.follow) h.set('follow', s.follow);
  if (s.canon.length !== CANONS.length) h.set('canon', s.canon.join(','));
  if (s.future === 'dim') h.set('future', 'dim');
  if (s.showLiving) h.set('living', 'show');
  const url = `#${h.toString()}`;
  if (url === location.hash) return;
  writing = true;
  history[push ? 'pushState' : 'replaceState'](null, '', url);
  writing = false;
  if (s.at) try { localStorage.setItem(`bookmark:${s.model.world}`, s.at); } catch {}
}
export const isWritingHash = () => writing;
