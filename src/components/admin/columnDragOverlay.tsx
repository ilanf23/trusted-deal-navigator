import { type ComponentType, type ReactNode } from 'react';
import { Grip } from 'lucide-react';

export interface ColumnHeaderDef {
  icon: ComponentType<{ className?: string }>;
  label: string;
}

/**
 * Build a `renderOverlay` callback for `<DraggableColumnsContext>`.
 *
 * Pass the table's column-header lookup (icon + label per column key) plus a
 * function that returns the current width for a given column. Returns the
 * floating chip rendered while a column is being dragged.
 *
 * Usage:
 *   <DraggableColumnsContext
 *     items={...}
 *     onDragEnd={...}
 *     renderOverlay={makeColumnDragOverlay(COLUMN_HEADERS, k => columnWidths[k])}
 *   />
 */
export function makeColumnDragOverlay<K extends string>(
  headers: Record<K, ColumnHeaderDef>,
  getWidth: (key: K) => number | undefined,
): (activeId: string) => ReactNode {
  return (activeId: string) => {
    const def = headers[activeId as K];
    if (!def) return null;
    const Icon = def.icon;
    const w = getWidth(activeId as K) ?? 160;
    return (
      <div
        className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#eee6f6] border-2 border-[#3b2778] shadow-[0_8px_24px_rgba(59,39,120,0.35)] cursor-grabbing"
        style={{ width: w }}
      >
        <Grip className="h-4 w-4 text-[#3b2778] mr-1" strokeWidth={2} />
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778]">
          <Icon className="h-4 w-4" /> {def.label}
        </span>
      </div>
    );
  };
}
