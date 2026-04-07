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

/**
 * Computes auto-fit column widths from actual data content.
 *
 * Merge priority:  minWidths  →  auto-fit from data  →  user-saved overrides
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
  const [savedColumnWidths, setSavedColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore corrupt localStorage */ }
    return {};
  });

  const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
    setSavedColumnWidths(prev => {
      const next = { ...prev, [columnId]: newWidth };
      localStorage.setItem(storageKey, JSON.stringify(next));
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

    // Merge: minimums → auto-fit → user-saved overrides
    const merged: Record<string, number> = { ...minWidths };
    for (const key of Object.keys(merged)) {
      if (auto[key] !== undefined) {
        merged[key] = Math.max(merged[key], auto[key]);
      }
      if (savedColumnWidths[key] !== undefined) {
        merged[key] = savedColumnWidths[key];
      }
    }
    return merged;
  }, [data, autoFitConfig, savedColumnWidths, minWidths, maxAutoWidth]);

  return { columnWidths, handleColumnResize };
}
