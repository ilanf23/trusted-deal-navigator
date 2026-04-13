import type { ReactNode } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  SensorDescriptor,
  SensorOptions,
  closestCenter,
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
      collisionDetection={closestCenter}
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
