import { type CSSProperties, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import ResizableColumnHeader from './ResizableColumnHeader';
import SortableColumnHeader from './SortableColumnHeader';

interface DraggableThProps {
  /** Stable column id — must match the id used in `<DraggableColumnsContext items=...>`. */
  columnId: string;
  /** Current column width in px. */
  width: number;
  /** Resize callback — wires through to the resize handle. */
  onResize: (columnId: string, newWidth: number) => void;
  /**
   * Set false for locked columns (sticky leading, trailing actions). They
   * still get the resize handle but no drag grip and no sortable wiring.
   */
  draggable?: boolean;
  /**
   * If false, render nothing. Lets callers do
   * `<DraggableTh visible={visibility[key]}>` instead of an outer condition.
   */
  visible?: boolean;
  /** Extra classes appended to the th. */
  className?: string;
  /** Extra inline style merged into the th. */
  style?: CSSProperties;
  /**
   * Optional element rendered after the resize wrapper — typical use is a
   * column sort menu (the three-dot popover each CRM table has).
   */
  trailing?: ReactNode;
  /** Header label content (icon + text). Wrapped in standard CRM typography. */
  children: ReactNode;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * The shared CRM-table column header. Replaces the per-table `ColHeader`
 * helpers. Behavior:
 *  - Locked variant (`draggable={false}`): just resize + standard styling.
 *  - Default: full drag + resize, contributes to a parent
 *    `<DraggableColumnsContext>`.
 *
 * Defined at module scope so React doesn't unmount/remount on every parent
 * render — important under `DndContext`, which re-renders frequently.
 */
const DraggableTh = ({
  columnId,
  width,
  onResize,
  draggable = true,
  visible = true,
  className,
  style,
  trailing,
  children,
  minWidth,
  maxWidth,
}: DraggableThProps) => {
  if (!visible) return null;

  const labelSpan = (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#3b2778] dark:text-muted-foreground">
      {children}
    </span>
  );

  return (
    <th
      className={cn(
        'px-4 py-1.5 text-left whitespace-nowrap group/col bg-[#eee6f6] hover:bg-[#d8cce8] transition-colors hover:z-20',
        className,
      )}
      style={{ width: `${width}px`, minWidth: 60, maxWidth: 500, border: '1px solid #c8bdd6', ...style }}
    >
      {draggable ? (
        <SortableColumnHeader
          columnId={columnId}
          currentWidth={`${width}px`}
          onResize={onResize}
          trailing={trailing}
          minWidth={minWidth}
          maxWidth={maxWidth}
        >
          {labelSpan}
        </SortableColumnHeader>
      ) : (
        <ResizableColumnHeader
          columnId={columnId}
          currentWidth={`${width}px`}
          onResize={onResize}
          minWidth={minWidth}
          maxWidth={maxWidth}
        >
          {labelSpan}
          {trailing}
        </ResizableColumnHeader>
      )}
    </th>
  );
};

export default DraggableTh;
