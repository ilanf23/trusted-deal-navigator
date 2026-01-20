import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LeadCard } from './LeadCard';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

interface Touchpoint {
  type: string;
  direction: string;
  date: string;
}

interface KanbanColumnProps {
  status: LeadStatus;
  leads: Lead[];
  title: string;
  color: string;
  touchpoints?: Record<string, Touchpoint>;
  onLeadClick?: (lead: Lead) => void;
}

export const KanbanColumn = ({ status, leads, title, color, touchpoints = {}, onLeadClick }: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-muted/50 rounded-lg flex-1 min-w-[200px] h-full transition-all ${
        isOver ? 'ring-2 ring-primary ring-offset-2 bg-primary/5' : ''
      }`}
    >
      <div className={`p-4 rounded-t-lg ${color}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white text-base">{title}</h3>
          <span className="bg-white/25 text-white text-sm font-medium px-2.5 py-1 rounded-full">
            {leads.length}
          </span>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3 min-h-[100px]">
          {leads.map((lead) => (
            <LeadCard 
              key={lead.id} 
              lead={lead} 
              touchpoint={touchpoints[lead.id]}
              onClick={() => onLeadClick?.(lead)}
            />
          ))}
          {leads.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-10 border-2 border-dashed border-muted-foreground/20 rounded-lg">
              Drop leads here
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
