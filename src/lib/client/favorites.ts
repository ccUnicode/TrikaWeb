// src/lib/client/favorites.ts
const KEY = 'trikaweb:favorites';
const hasWindow = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function load(): number[] {
  if (!hasWindow()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(Number).filter(n => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

function save(ids: number[]) {
  if (!hasWindow()) return;
  localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent('favorites:changed', { detail: { ids } }));
}

export function getFavorites(): number[] {
  return load();
}

export function isFavorite(id: number): boolean {
  return load().includes(id);
}

export function toggleFavorite(id: number): number[] {
  const ids = new Set(load());
  ids.has(id) ? ids.delete(id) : ids.add(id);
  const next = Array.from(ids);
  save(next);
  return next;
}
