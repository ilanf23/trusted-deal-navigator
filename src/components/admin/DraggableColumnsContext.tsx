import { useState, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  defaultDropAnimationSideEffects,
  type DragEndEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';

interface DraggableColumnsContextProps {
  /** Just the reorderable column keys — locked columns stay outside. */
  items: string[];
  /** From `useColumnOrder().handleDragEnd`. */
  onDragEnd: (event: DragEndEvent) => void;
  /**
   * Render the floating chip shown while a column is being dragged.
   * Receives the active column id; return a styled element (icon + label etc.).
   */
  renderOverlay?: (activeId: string) => ReactNode;
  children: ReactNode;
}

const dropAnimation: DropAnimation = {
  duration: 180,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } },
  }),
};

/**
 * Provides the `DndContext` + horizontal `SortableContext` for a row of
 * `<SortableColumnHeader>` cells. A `<DragOverlay>` portals the dragged
 * column's chip to the document body so it floats above the table while
 * the row positions itself stay visually stable underneath.
 *
 * Pointer activation distance of 6px keeps clicks on the header (sort menu,
 * resize handle) from accidentally starting a drag.
 */
export const DraggableColumnsContext = ({
  items,
  onDragEnd,
  renderOverlay,
  children,
}: DraggableColumnsContextProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    document.body.style.cursor = 'grabbing';
  };

  const handleDragEndInternal = (event: DragEndEvent) => {
    setActiveId(null);
    document.body.style.cursor = '';
    onDragEnd(event);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    document.body.style.cursor = '';
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEndInternal}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items} strategy={horizontalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay dropAnimation={dropAnimation}>
        {activeId && renderOverlay ? renderOverlay(activeId) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DraggableColumnsContext;
