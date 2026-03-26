import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Mail, Phone, Calendar, CheckCircle2, Clock, PhoneIncoming, PhoneOutgoing, MessageSquare, Maximize2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { getLeadDisplayName } from '@/lib/utils';
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
  teamMemberMap?: Record<string, string>;
  teamAvatarMap?: Record<string, string>;
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

const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

const AVATAR_COLORS = [
  'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600',
  'bg-amber-600', 'bg-cyan-600', 'bg-pink-600', 'bg-indigo-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const LeadCard = ({ lead, touchpoint, teamMemberMap, teamAvatarMap, onClick }: LeadCardProps) => {
  const navigate = useNavigate();
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
      className={`group/card cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'shadow-lg ring-2 ring-primary z-50' : ''
      }`}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="h-5 w-5 rounded-full shrink-0 overflow-hidden">
              {lead.image_url ? (
                <img src={lead.image_url} alt={lead.name} className="h-full w-full object-cover" />
              ) : (
                <div className={`h-full w-full ${getAvatarColor(lead.name)} flex items-center justify-center text-white text-[8px] font-bold`}>
                  {lead.name[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <h4 className="font-semibold text-sm leading-tight truncate">{getLeadDisplayName(lead)}</h4>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClick?.(); }}
              className="shrink-0 opacity-0 group-hover/card:opacity-100 transition-opacity hover:text-foreground"
            >
              <Maximize2 className="w-4 h-4 text-muted-foreground/60 hover:text-foreground transition-colors" />
            </button>
          </div>
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
            {/* Owner Avatar */}
            {lead.assigned_to && teamMemberMap && (() => {
              const ownerName = teamMemberMap[lead.assigned_to!];
              const ownerAvatar = teamAvatarMap?.[lead.assigned_to!];
              if (!ownerName) return null;
              const ownerInitial = ownerName[0]?.toUpperCase();
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="h-5 w-5 rounded-full overflow-hidden shrink-0 shadow-sm">
                      {ownerAvatar ? (
                        <img src={ownerAvatar} alt={ownerName} className="h-full w-full object-cover" />
                      ) : (
                        <div className={`h-full w-full ${getAvatarColor(ownerName)} flex items-center justify-center text-white text-[8px] font-bold`}>
                          {ownerInitial}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{ownerName}</TooltipContent>
                </Tooltip>
              );
            })()}
          </div>
        </div>
        
        {lead.company_name && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{lead.company_name}</span>
          </div>
        )}

        {lead.phone && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const params = new URLSearchParams({ phone: lead.phone! });
              if (lead.id) params.set('leadId', lead.id);
              navigate(`/admin/calls?${params.toString()}`);
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-blue-600 transition-colors"
          >
            <Phone className="w-3 h-3" />
            <span className="truncate">{formatPhoneNumber(lead.phone)}</span>
          </button>
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
