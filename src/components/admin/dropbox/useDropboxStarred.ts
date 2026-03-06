import { useState, useCallback } from 'react';

const STORAGE_KEY = 'dropbox-starred-files';

function loadStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveStarred(paths: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...paths]));
}

export function useDropboxStarred() {
  const [starredPaths, setStarredPaths] = useState<Set<string>>(loadStarred);

  const toggleStar = useCallback((path: string) => {
    setStarredPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      saveStarred(next);
      return next;
    });
  }, []);

  const isStarred = useCallback((path: string) => starredPaths.has(path), [starredPaths]);

  return { starredPaths, toggleStar, isStarred };
}
