import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Calendar } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface LeadCardProps {
  lead: Lead;
}

const sourceColors: Record<string, string> = {
  'Website': 'bg-blue-100 text-blue-700',
  'LinkedIn': 'bg-sky-100 text-sky-700',
  'Referral': 'bg-green-100 text-green-700',
  'Google Ads': 'bg-amber-100 text-amber-700',
  'Trade Show': 'bg-purple-100 text-purple-700',
  'Cold Call': 'bg-gray-100 text-gray-700',
};

export const LeadCard = ({ lead }: LeadCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: lead.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary z-50' : ''
      }`}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm leading-tight">{lead.name}</h4>
          {lead.source && (
            <Badge variant="secondary" className={`text-xs shrink-0 ${sourceColors[lead.source] || 'bg-gray-100 text-gray-700'}`}>
              {lead.source}
            </Badge>
          )}
        </div>
        
        {lead.company_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}
        
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3 h-3" />
            <span>{lead.phone}</span>
          </div>
        )}
        
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t">
          <Calendar className="w-3 h-3" />
          <span>{new Date(lead.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};
