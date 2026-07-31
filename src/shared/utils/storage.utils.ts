export function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      window.localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent('central-storage-error', { detail: { key, reason: 'quota_exceeded' } }));
      return;
    }
    throw error;
  }

  window.dispatchEvent(new CustomEvent('central-storage-change', { detail: { key } }));
}

export function removeLocalStorage(key: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(key);
  window.dispatchEvent(new CustomEvent('central-storage-change', { detail: { key } }));
}
