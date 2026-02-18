import { useState, useCallback } from 'react';
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import type { Module } from './ModuleCard';

const COLUMNS = [
  { id: 'planned',     label: 'Backlog / Planned',  color: 'bg-slate-100 dark:bg-slate-800/60' },
  { id: 'in_progress', label: 'In Progress',         color: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'in_review',   label: 'In Review',           color: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'complete',    label: 'Done',                color: 'bg-green-50 dark:bg-green-900/20' },
  { id: 'on_hold',     label: 'On Hold',             color: 'bg-red-50 dark:bg-red-900/20' },
];

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-slate-400',
};

function KanbanCard({ module, isDragging }: { module: Module; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: module.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="p-3 cursor-grab active:cursor-grabbing shadow-sm border border-border/60 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-1.5 mb-1.5">
          <p className="text-sm font-semibold text-foreground leading-tight">{module.name}</p>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${PRIORITY_DOT[module.priority] ?? 'bg-slate-400'}`} title={module.priority} />
        </div>
        {module.business_owner && (
          <p className="text-[11px] text-muted-foreground mb-1.5">{module.business_owner}</p>
        )}
        {module.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{module.description}</p>
        )}
        {module.taskCount !== undefined && module.taskCount > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {module.doneCount}/{module.taskCount} tasks
          </p>
        )}
      </Card>
    </div>
  );
}

function OverlayCard({ module }: { module: Module }) {
  return (
    <Card className="p-3 shadow-lg border border-primary/30 rotate-2 cursor-grabbing w-60">
      <p className="text-sm font-semibold text-foreground">{module.name}</p>
      {module.business_owner && <p className="text-[11px] text-muted-foreground">{module.business_owner}</p>}
    </Card>
  );
}

interface ModulePipelineBoardProps {
  modules: Module[];
  onRefresh: () => void;
}

export default function ModulePipelineBoard({ modules, onRefresh }: ModulePipelineBoardProps) {
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const getColumnModules = (colId: string) =>
    modules.filter(m => m.status === colId);

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveModule(modules.find(m => m.id === active.id) ?? null);
  };

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setActiveModule(null);
    if (!over || active.id === over.id) return;

    // Check if dropped onto a column header or another card
    const targetColumnId = COLUMNS.find(c => c.id === over.id)?.id
      ?? modules.find(m => m.id === over.id)?.status;

    if (!targetColumnId) return;

    const draggedModule = modules.find(m => m.id === active.id);
    if (!draggedModule || draggedModule.status === targetColumnId) return;

    await supabase.from('modules').update({ status: targetColumnId }).eq('id', draggedModule.id);
    onRefresh();
  }, [modules, onRefresh]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
        {COLUMNS.map(col => {
          const colModules = getColumnModules(col.id);
          return (
            <div
              key={col.id}
              id={col.id}
              className={`flex-shrink-0 w-56 rounded-xl ${col.color} p-3 flex flex-col gap-2`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-foreground/70 uppercase tracking-wide">{col.label}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{colModules.length}</Badge>
              </div>
              <SortableContext items={colModules.map(m => m.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 flex-1">
                  {colModules.map(mod => (
                    <KanbanCard key={mod.id} module={mod} isDragging={activeModule?.id === mod.id} />
                  ))}
                  {colModules.length === 0 && (
                    <div className="border-2 border-dashed border-border/40 rounded-lg h-16 flex items-center justify-center">
                      <p className="text-[11px] text-muted-foreground/60">Drop here</p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>
      <DragOverlay>
        {activeModule ? <OverlayCard module={activeModule} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
