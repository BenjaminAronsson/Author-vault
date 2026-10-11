// localStorage that never throws: blocked site data, private modes and sandboxed frames make it throw on access.
// Reads fall back to null, writes are dropped; the viewer works, it just doesn't remember.
export const load = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
export const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
