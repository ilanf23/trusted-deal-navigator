import { useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';

type UseKanbanDragOpts<T extends { id: string }> = {
  items: T[];
  getGroupKey: (item: T) => string | null | undefined;
  validGroupKeys: string[];
  onMove: (item: T, fromGroup: string, toGroup: string) => void;
};

export function useKanbanDrag<T extends { id: string }>({
  items,
  getGroupKey,
  validGroupKeys,
  onMove,
}: UseKanbanDragOpts<T>) {
  const [dragged, setDragged] = useState<T | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setDragged(items.find((i) => i.id === event.active.id) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragged(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const overId = String(over.id);
    const targetGroup =
      validGroupKeys.find((k) => k === overId) ??
      (() => {
        const overItem = items.find((i) => i.id === overId);
        return overItem ? getGroupKey(overItem) : undefined;
      })();

    if (!targetGroup) return;

    const item = items.find((i) => i.id === active.id);
    if (!item) return;

    const fromGroup = getGroupKey(item) ?? '';
    if (fromGroup === targetGroup) return;

    onMove(item, fromGroup, targetGroup);
  };

  return { dragged, handleDragStart, handleDragEnd };
}
