import type { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  SensorDescriptor,
  SensorOptions,
  CollisionDetection,
  pointerWithin,
  rectIntersection,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';

type KanbanBoardProps = {
  sensors?: SensorDescriptor<SensorOptions>[];
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  overlay: ReactNode;
  children: ReactNode;
};

// Sortable cards register their droppable with a `sortable` key on `data.current`;
// columns register bare. Treat anything without that key as a column.
const isColumn = (c: { data: { current?: unknown } }) =>
  !(c.data.current as { sortable?: unknown } | undefined)?.sortable;

const kanbanCollision: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const columnHit = pointerHits.find((h) => {
      const d = args.droppableContainers.find((dc) => dc.id === h.id);
      return d ? isColumn(d) : false;
    });
    return columnHit ? [columnHit] : pointerHits;
  }

  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) {
    const columnHit = rectHits.find((h) => {
      const d = args.droppableContainers.find((dc) => dc.id === h.id);
      return d ? isColumn(d) : false;
    });
    return columnHit ? [columnHit] : rectHits;
  }

  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter(isColumn),
  });
};

export function KanbanBoard({
  sensors,
  onDragStart,
  onDragEnd,
  overlay,
  children,
}: KanbanBoardProps) {
  const defaultSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  return (
    <DndContext
      sensors={sensors ?? defaultSensors}
      collisionDetection={kanbanCollision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4 h-full min-h-[500px]">{children}</div>
      </div>
      <DragOverlay>{overlay}</DragOverlay>
    </DndContext>
  );
}
