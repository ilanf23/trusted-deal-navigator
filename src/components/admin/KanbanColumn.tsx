import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  title: string;
  color: string;
}

export const KanbanColumn = ({ status, leads, title, color }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-muted/50 rounded-lg min-w-[280px] max-w-[280px] h-full transition-all ${
        isOver ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''
      }`}
    >
      <div className={`p-3 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">{title}</h3>
          <span className="bg-white/20 text-white text-sm px-2 py-0.5 rounded-full">
            {leads.length}
          </span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2 min-h-[100px]">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              Drop leads here
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
