import { useCallback, useEffect, useMemo, useState } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent } from '@dnd-kit/core';
import { useAuth } from '@/contexts/AuthContext';

interface UseColumnOrderOptions {
  /** Stable id for this table (e.g. 'people', 'underwriting'). */
  tableId: string;
  /** Authoritative list of column keys that exist for this table. */
  defaultOrder: string[];
  /**
   * Keys that are pinned at the start of the table and cannot be reordered
   * (sticky checkbox column, person/name column, etc.). They are always
   * surfaced first in the order they appear here, regardless of saved state.
   */
  lockedStart?: string[];
  /** Keys pinned at the end (e.g. trailing actions column). */
  lockedEnd?: string[];
}

const STORAGE_PREFIX = 'col-order-v1';

const buildKey = (userId: string | undefined, tableId: string) =>
  `${STORAGE_PREFIX}:${userId ?? 'anon'}:${tableId}`;

/**
 * Reconcile the saved order with the authoritative `defaultOrder`:
 *   - drop saved keys that no longer exist
 *   - append any new keys in their default position
 * Returns the reorderable middle section only — locked keys live outside.
 */
const reconcile = (saved: string[], reorderable: string[]): string[] => {
  const allowed = new Set(reorderable);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of saved) {
    if (allowed.has(k) && !seen.has(k)) {
      out.push(k);
      seen.add(k);
    }
  }
  for (const k of reorderable) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
};

/**
 * Persist a per-user column order for a single table.
 *
 * Storage is `localStorage`, keyed by user id + table id. The hook is
 * resilient to columns being added or removed in code: missing keys fall
 * back to their default position, removed keys are dropped on next save.
 *
 * Pair with `<DraggableColumnsContext>` and `<SortableColumnHeader>`.
 */
export function useColumnOrder({
  tableId,
  defaultOrder,
  lockedStart = [],
  lockedEnd = [],
}: UseColumnOrderOptions) {
  const { user } = useAuth();
  const userId = user?.id;
  const storageKey = buildKey(userId, tableId);

  const lockedStartSet = useMemo(() => new Set(lockedStart), [lockedStart]);
  const lockedEndSet = useMemo(() => new Set(lockedEnd), [lockedEnd]);

  const reorderableDefaults = useMemo(
    () => defaultOrder.filter(k => !lockedStartSet.has(k) && !lockedEndSet.has(k)),
    [defaultOrder, lockedStartSet, lockedEndSet],
  );

  const [reorderable, setReorderable] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(buildKey(userId, tableId));
      if (raw) return reconcile(JSON.parse(raw), reorderableDefaults);
    } catch { /* ignore corrupt storage */ }
    return reorderableDefaults;
  });

  // If the user changes mid-session (impersonation, sign-out/in), reload.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        setReorderable(reconcile(JSON.parse(raw), reorderableDefaults));
        return;
      }
    } catch { /* ignore */ }
    setReorderable(reorderableDefaults);
  }, [storageKey, reorderableDefaults]);

  // Reconcile if `defaultOrder` itself changes (column added/removed in code).
  useEffect(() => {
    setReorderable(prev => {
      const next = reconcile(prev, reorderableDefaults);
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next;
    });
  }, [reorderableDefaults]);

  const persist = useCallback(
    (next: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch { /* quota / private mode — silently fail */ }
    },
    [storageKey],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setReorderable(prev => {
        const from = prev.indexOf(String(active.id));
        const to = prev.indexOf(String(over.id));
        if (from === -1 || to === -1) return prev;
        const next = arrayMove(prev, from, to);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const reset = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setReorderable(reorderableDefaults);
  }, [storageKey, reorderableDefaults]);

  const orderedKeys = useMemo(
    () => [...lockedStart, ...reorderable, ...lockedEnd],
    [lockedStart, reorderable, lockedEnd],
  );

  return {
    /** Full ordered list including locked keys — render headers/cells from this. */
    orderedKeys,
    /** Just the reorderable middle — feed this to `<SortableContext items=...>`. */
    reorderableKeys: reorderable,
    /** dnd-kit DragEnd handler — pass to `<DndContext onDragEnd=...>`. */
    handleDragEnd,
    /** Restore default order. */
    reset,
  };
}
