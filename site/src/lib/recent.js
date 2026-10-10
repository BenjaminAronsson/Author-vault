// Remembers the last opened world folder (File System Access handles can be stored in IndexedDB).
const DB = 'world-viewer-handles';
function tx(mode, fn) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(DB, 1); } catch { return resolve(null); }
    req.onupgradeneeded = () => req.result.createObjectStore('h');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const r = fn(req.result.transaction('h', mode).objectStore('h'));
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => resolve(null);
    };
  });
}
/** Folder handles from the private sandbox (OPFS) can't be stored safely: Chromium crashes reading them back. */
export async function persistable(handle) {
  try { return handle && !(await (await navigator.storage.getDirectory()).resolve(handle)); } catch { return !!handle; }
}
/** Folder handles live in their own store and are only read on demand (Reopen/Refresh), never at page load. */
export const rememberFolder = async (handle, key = 'last') => ((await persistable(handle)) ? tx('readwrite', (s) => s.put(handle, key)) : null);
export const recentFolder = (key = 'last') => tx('readonly', (s) => s.get(key));
export const hasRecent = () => { try { return localStorage.getItem('recent:last') ?? null; } catch { return null; } };
export const noteRecent = (name) => { try { localStorage.setItem('recent:last', name); } catch {} };
/** Re-asks for permission (needs a user gesture) and returns the handle if granted. */
export async function reopen(handle) {
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission?.(opts)) === 'granted') return handle;
  return (await handle.requestPermission?.(opts)) === 'granted' ? handle : null;
}
