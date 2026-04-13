import type { ReactNode } from 'react';
import { DollarSign, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { formatValue } from './formatValue';

type KanbanColumnProps = {
  id: string;
  label: string;
  color: string;
  itemIds: string[];
  onAdd?: () => void;
  emptyMessage?: string;
  totalValue?: number | null;
  children: ReactNode;
};

export function KanbanColumn({
  id,
  label,
  color,
  itemIds,
  onAdd,
  emptyMessage = 'Drop items here',
  totalValue,
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const isEmpty = itemIds.length === 0;
  const showTotal = typeof totalValue === 'number' && totalValue > 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl flex-1 min-w-[220px] max-w-[300px] transition-all ${
        isOver
          ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-background bg-blue-50/30 dark:bg-blue-950/20'
          : 'bg-muted/30'
      }`}
    >
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${color}`} />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide truncate">
            {label}
          </span>
          <span className="ml-auto text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
            {itemIds.length}
          </span>
          {onAdd && (
            <button
              onClick={onAdd}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Add"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {showTotal && (
          <div className="flex items-center gap-1 mt-1 ml-4">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground font-medium">
              {formatValue(totalValue as number)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1">
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {children}
            {isEmpty && (
              <div className="text-center text-muted-foreground text-xs py-10 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                {emptyMessage}
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}
