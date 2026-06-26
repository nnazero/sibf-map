import { useState, useCallback } from 'react';

const FAV_KEY = 'sibf_favorites';

const load = (): Set<string> => {
  try { const r = localStorage.getItem(FAV_KEY); return r ? new Set(JSON.parse(r)) : new Set(); }
  catch { return new Set(); }
};
const save = (s: Set<string>) => {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...s])); } catch {}
};

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(load);

  const toggleFav = useCallback((id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      save(next);
      return next;
    });
  }, []);

  return { favorites, toggleFav };
}