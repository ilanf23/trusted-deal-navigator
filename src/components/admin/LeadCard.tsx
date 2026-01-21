import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Calendar, CheckCircle2, Clock, PhoneIncoming, PhoneOutgoing, MessageSquare } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];

interface Touchpoint {
  type: string;
  direction: string;
  date: string;
}

interface LeadCardProps {
  lead: Lead;
  touchpoint?: Touchpoint;
  onClick?: () => void;
}

const sourceColors: Record<string, string> = {
  'Website': 'bg-blue-100 text-blue-700',
  'LinkedIn': 'bg-sky-100 text-sky-700',
  'Referral': 'bg-green-100 text-green-700',
  'Google Ads': 'bg-amber-100 text-amber-700',
  'Trade Show': 'bg-purple-100 text-purple-700',
  'Cold Call': 'bg-gray-100 text-gray-700',
};

const getTouchpointIcon = (type: string, direction: string) => {
  if (type === 'call') {
    return direction === 'inbound' 
      ? <PhoneIncoming className="w-3 h-3 text-green-600" />
      : <PhoneOutgoing className="w-3 h-3 text-blue-600" />;
  }
  if (type === 'email') {
    return <Mail className="w-3 h-3 text-purple-600" />;
  }
  if (type === 'sms') {
    return <MessageSquare className="w-3 h-3 text-cyan-600" />;
  }
  return <MessageSquare className="w-3 h-3 text-muted-foreground" />;
};

const getTouchpointLabel = (type: string, direction: string) => {
  if (type === 'call') {
    return direction === 'inbound' ? 'Inbound call' : 'Outbound call';
  }
  if (type === 'email') {
    return direction === 'inbound' ? 'Email received' : 'Email sent';
  }
  if (type === 'sms') {
    return direction === 'inbound' ? 'SMS received' : 'SMS sent';
  }
  return type;
};

export const LeadCard = ({ lead, touchpoint, onClick }: LeadCardProps) => {
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

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not dragging
    if (!isDragging && onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary z-50' : ''
      }`}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-sm leading-tight truncate">{lead.name}</h4>
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
          </div>
        </div>
        
        {lead.company_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}

        {/* Last Touchpoint Indicator */}
        {touchpoint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/50">
                {getTouchpointIcon(touchpoint.type, touchpoint.direction)}
                <span className="truncate">
                  {getTouchpointLabel(touchpoint.type, touchpoint.direction)}
                </span>
                <span className="text-[10px] opacity-70 ml-auto">
                  {formatDistanceToNow(new Date(touchpoint.date), { addSuffix: true })}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {getTouchpointLabel(touchpoint.type, touchpoint.direction)} - {new Date(touchpoint.date).toLocaleDateString()}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 pt-1 border-t border-border/50">
            <Calendar className="w-3 h-3" />
            <span>No contact yet</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
