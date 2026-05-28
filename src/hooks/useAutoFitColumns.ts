import { useState, useMemo, useCallback } from 'react';

// ── Character-width approximations ──
const CHAR_W = 7.8;   // px per char at 13px font
const CHAR_W_SM = 6.5; // px per char at 11px / badge font
const CELL_PAD = 32;   // px-4 each side

export { CHAR_W, CHAR_W_SM };

export interface AutoFitColumnDef {
  /** Extract the display text from each data item for this column */
  getText: (item: any) => string | null | undefined;
  /** Character width multiplier (default: 7.8) — use 6.5 for smaller badge text */
  charWidth?: number;
  /** Extra pixels for icons, avatars, badges, gaps */
  extraPx?: number;
}

interface UseAutoFitColumnsOptions {
  /** Minimum widths per column — every column must have an entry */
  minWidths: Record<string, number>;
  /** Auto-fit config — only columns that should auto-size from data */
  autoFitConfig?: Record<string, AutoFitColumnDef>;
  /** The filtered / visible data array used to measure text lengths */
  data: any[];
  /** localStorage key for persisting user-drag overrides */
  storageKey: string;
  /** Maximum auto-fit width cap (default: 500) */
  maxAutoWidth?: number;
}

// Bump when persisted-width semantics change so stale narrow widths from
// prior versions are discarded rather than clamped. Once-only reset for users.
const STORAGE_VERSION = 'v2';
// Defensive ceiling on any persisted width to keep corrupt/stale values from
// producing absurd layouts. User drags above maxAutoWidth are still honored.
const MAX_PERSISTED_WIDTH = 2000;

/** Parse and validate the localStorage payload — keep only finite positive numbers. */
function readSavedWidths(storageKey: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${storageKey}:${STORAGE_VERSION}`);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_PERSISTED_WIDTH) {
        out[k] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Computes auto-fit column widths from actual data content.
 *
 * Merge priority:  minWidths  →  auto-fit from data  →  user-saved overrides
 * Saved overrides are clamped to [minWidth, MAX_PERSISTED_WIDTH] so a stale
 * narrow saved width can never push a row into wrapping.
 *
 * Reference implementation extracted from Underwriting.tsx (lines 682-730).
 */
export function useAutoFitColumns({
  minWidths,
  autoFitConfig,
  data,
  storageKey,
  maxAutoWidth = 500,
}: UseAutoFitColumnsOptions) {
  // User-saved widths from manual column resizing
  const [savedColumnWidths, setSavedColumnWidths] = useState<Record<string, number>>(() =>
    readSavedWidths(storageKey),
  );

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    if (!Number.isFinite(newWidth) || newWidth <= 0) return;
    const clamped = Math.min(MAX_PERSISTED_WIDTH, Math.round(newWidth));
    setSavedColumnWidths(prev => {
      const next = { ...prev, [columnId]: clamped };
      try {
        localStorage.setItem(`${storageKey}:${STORAGE_VERSION}`, JSON.stringify(next));
      } catch { /* quota / private mode — non-fatal */ }
      return next;
    });
  }, [storageKey]);

  const columnWidths = useMemo(() => {
    // Helper: measure max text width across all items
    const maxTextW = (items: (string | null | undefined)[], charWidth = CHAR_W, extra = 0) => {
      let max = 0;
      for (const s of items) {
        const len = (s ?? '').length;
        if (len > max) max = len;
      }
      return Math.min(maxAutoWidth, Math.ceil(max * charWidth + CELL_PAD + extra));
    };

    // Compute auto-fit widths from data
    const auto: Record<string, number> = {};
    if (data.length > 0 && autoFitConfig) {
      for (const [key, cfg] of Object.entries(autoFitConfig)) {
        auto[key] = maxTextW(
          data.map(cfg.getText),
          cfg.charWidth ?? CHAR_W,
          cfg.extraPx ?? 0,
        );
      }
    }

    // Merge: minimums → auto-fit → clamped user-saved overrides
    const merged: Record<string, number> = { ...minWidths };
    for (const key of Object.keys(merged)) {
      const minW = merged[key];
      if (auto[key] !== undefined) {
        merged[key] = Math.max(minW, auto[key]);
      }
      const saved = savedColumnWidths[key];
      if (saved !== undefined) {
        // Floor at the column's own minimum so a stale narrow width can never
        // induce wrapping; cap at MAX_PERSISTED_WIDTH for sanity.
        merged[key] = Math.min(MAX_PERSISTED_WIDTH, Math.max(minW, saved));
      }
    }
    return merged;
  }, [data, autoFitConfig, savedColumnWidths, minWidths, maxAutoWidth]);

  return { columnWidths, handleColumnResize };
}
