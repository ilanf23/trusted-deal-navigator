import { useSortable } from '@dnd-kit/sortable';
import { Grip } from 'lucide-react';
import { cn } from '@/lib/utils';
import ResizableColumnHeader from './ResizableColumnHeader';

interface SortableColumnHeaderProps {
  /** Stable column id (must match the id used in `<SortableContext items=...>`). */
  columnId: string;
  /** Current width as a `Npx` string — passed through to the resize handle. */
  currentWidth: string;
  /** Resize callback — passed through to ResizableColumnHeader. */
  onResize: (columnId: string, newWidth: number) => void;
  /** Header label content (icon + text). */
  children: React.ReactNode;
  /** Optional inline content rendered after the resize wrapper (e.g. sort menu). */
  trailing?: React.ReactNode;
  /** Disable drag (for locked columns rendered alongside sortable ones). */
  disabled?: boolean;
  className?: string;
  minWidth?: number;
  maxWidth?: number;
}

/**
 * A draggable + resizable column header. Wraps `ResizableColumnHeader` and
 * adds a grip handle that activates the dnd-kit drag listeners.
 *
 * Design notes
 *  - We do NOT apply dnd-kit's `transform` here. Sliding column-header inner
 *    content while the rest of the column (background, body cells) stays put
 *    looks broken. Instead the dragged column dims, a `<DragOverlay>` (set up
 *    in `DraggableColumnsContext`) shows a floating ghost, and a vertical
 *    drop indicator highlights the side the column will land on.
 *  - The grip is the *only* drag activator. Clicks on the label, sort menu,
 *    and resize edge stay unaffected.
 */
const SortableColumnHeader = ({
  columnId,
  currentWidth,
  onResize,
  children,
  trailing,
  disabled,
  className,
  minWidth,
  maxWidth,
}: SortableColumnHeaderProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    isOver,
    activeIndex,
    overIndex,
  } = useSortable({ id: columnId, disabled });

  // Drop-indicator side: drop on the same side the dragged item is travelling
  // *from*. Dragging right-to-left lands on the over item's left edge; left-
  // to-right lands on the right edge. activeIndex is -1 when nothing is
  // active, which short-circuits both branches.
  const isDropTarget = isOver && !isDragging && activeIndex !== -1;
  const dropOnLeft = isDropTarget && activeIndex > overIndex;
  const dropOnRight = isDropTarget && activeIndex < overIndex;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative flex items-center w-full h-full',
        // Dim the source column while it's being lifted; the floating
        // DragOverlay carries the visual weight during drag.
        isDragging && 'opacity-30',
        className,
      )}
    >
      {/* Drop indicator — a thick purple bar on the side the column will land on. */}
      {dropOnLeft && (
        <span className="pointer-events-none absolute -left-1 top-0 bottom-0 w-1 bg-[#3b2778] rounded-full shadow-[0_0_6px_rgba(59,39,120,0.6)]" />
      )}
      {dropOnRight && (
        <span className="pointer-events-none absolute -right-1 top-0 bottom-0 w-1 bg-[#3b2778] rounded-full shadow-[0_0_6px_rgba(59,39,120,0.6)]" />
      )}

      {/* Drag grip — always faintly present so the column reads as draggable;
          brightens on column hover; full punch + bg pill on grip hover. */}
      {!disabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${columnId} column`}
          title="Drag to reorder"
          className={cn(
            'shrink-0 mr-1.5 h-6 w-5 flex items-center justify-center rounded',
            'cursor-grab active:cursor-grabbing touch-none select-none',
            'opacity-30 group-hover/col:opacity-80',
            'hover:opacity-100 hover:bg-[#c8bdd6]',
            'text-[#3b2778] dark:text-muted-foreground',
            'transition-[opacity,background-color] duration-150',
          )}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Grip className="h-4 w-4" strokeWidth={2} />
        </button>
      )}

      <ResizableColumnHeader
        columnId={columnId}
        currentWidth={currentWidth}
        onResize={onResize}
        minWidth={minWidth}
        maxWidth={maxWidth}
        className="flex-1 min-w-0"
      >
        {children}
        {trailing}
      </ResizableColumnHeader>
    </div>
  );
};

export default SortableColumnHeader;
