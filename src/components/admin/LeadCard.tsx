import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Calendar, FileQuestion, CheckCircle2, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

  // Questionnaire status
  const questionnaireSent = !!lead.questionnaire_sent_at;
  const questionnaireCompleted = !!lead.questionnaire_completed_at;

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
      <CardContent className="p-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight">{lead.name}</h4>
          <div className="flex items-center gap-1 shrink-0">
            {/* Questionnaire Status Indicator */}
            {questionnaireSent && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`p-1 rounded-full ${questionnaireCompleted ? 'bg-green-100' : 'bg-amber-100'}`}>
                    {questionnaireCompleted ? (
                      <CheckCircle2 className="w-3 h-3 text-green-600" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-600" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {questionnaireCompleted 
                    ? `Questionnaire completed ${new Date(lead.questionnaire_completed_at!).toLocaleDateString()}`
                    : `Questionnaire sent ${new Date(lead.questionnaire_sent_at!).toLocaleDateString()}`
                  }
                </TooltipContent>
              </Tooltip>
            )}
            {lead.source && (
              <Badge variant="secondary" className={`text-xs ${sourceColors[lead.source] || 'bg-gray-100 text-gray-700'}`}>
                {lead.source}
              </Badge>
            )}
          </div>
        </div>
        
        {lead.company_name && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}
        
        {lead.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        
        {lead.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4" />
            <span>{lead.phone}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
          <Calendar className="w-4 h-4" />
          <span>{new Date(lead.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
};
