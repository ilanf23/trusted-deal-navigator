import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCall } from '@/contexts/CallContext';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Play, FileText, Clock, ChevronDown, ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

/**
 * Shared call-history section for the three pipeline expanded views.
 *
 * Pulls from `communications` (communication_type = 'call') scoped to the
 * current deal. Each row renders direction, duration, timestamp, and —
 * when available — play-recording + expand-transcript controls.
 *
 * Additional features vs. Copper's call history:
 *  - Inline click-to-redial via the global CallContext (Twilio Device).
 *  - Expandable transcript preview (we already store AI transcripts on the
 *    communications row for rated calls).
 *  - "Missed" state highlighted by status badge.
 */

interface CommunicationRow {
  id: string;
  communication_type: string;
  direction: string;
  status: string | null;
  phone_number: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
  user_id: string | null;
  content: string | null;
  call_sid: string | null;
}

export type LeadCallHistoryEntity = 'potential' | 'underwriting' | 'lender_management';

interface LeadCallHistorySectionProps {
  leadId: string;
  entityType: LeadCallHistoryEntity;
  teamMembers: Array<{ id: string; name: string }>;
  /** Optional: a phone number to use when "redial" is clicked with no
   *  phone on the row (falls back to the deal's primary phone). */
  fallbackPhone?: string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function directionIcon(direction: string, status: string | null) {
  if (status === 'missed' || status === 'no-answer' || status === 'failed') {
    return <PhoneMissed className="h-3.5 w-3.5 text-red-500" />;
  }
  if (direction === 'inbound') {
    return <PhoneIncoming className="h-3.5 w-3.5 text-blue-600" />;
  }
  return <PhoneOutgoing className="h-3.5 w-3.5 text-emerald-600" />;
}

export function LeadCallHistorySection({
  leadId,
  entityType,
  teamMembers,
  fallbackPhone,
}: LeadCallHistorySectionProps) {
  const { makeOutboundCall } = useCall();
  const [activeCall, setActiveCall] = useState<CommunicationRow | null>(null);
  const [open, setOpen] = useState(true);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['lead-call-history', entityType, leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communications')
        .select(
          'id, communication_type, direction, status, phone_number, duration_seconds, recording_url, transcript, created_at, user_id, content, call_sid',
        )
        .eq('lead_id', leadId)
        .eq('communication_type', 'call')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CommunicationRow[];
    },
    staleTime: 30_000,
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of teamMembers) map[m.id] = m.name;
    return map;
  }, [teamMembers]);

  const handleRedial = (phone: string | null) => {
    const target = phone ?? fallbackPhone ?? '';
    if (!target) return;
    void makeOutboundCall(target, leadId, undefined);
  };

  const activeCallMember = activeCall?.user_id
    ? teamMemberMap[activeCall.user_id] ?? '—'
    : '—';

  const count = calls.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-2.5 hover:bg-muted/50 px-4 rounded-lg transition-colors">
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Phone className="h-3.5 w-3.5 text-rose-500" /> Calls
        </span>
        <Badge
          variant="secondary"
          className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center rounded-full ml-1 bg-muted text-muted-foreground"
        >
          {count}
        </Badge>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-2">
        <div className="space-y-1.5 py-1">
          {isLoading && (
            <p className="text-xs text-muted-foreground">Loading calls…</p>
          )}
          {!isLoading && calls.length === 0 && (
            <p className="text-xs text-muted-foreground">No calls logged</p>
          )}
          {calls.map((c) => {
            const member = c.user_id
              ? teamMemberMap[c.user_id] ?? '—'
              : '—';
            const hasDetail = !!(c.recording_url || c.transcript);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCall(c)}
                className="w-full text-left rounded-lg border border-border bg-card/60 hover:bg-muted/60 px-2 py-1.5 text-xs transition-colors cursor-pointer"
                title={hasDetail ? 'View transcript & recording' : 'View call details'}
              >
                <div className="flex items-center gap-2">
                  {directionIcon(c.direction, c.status)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {c.phone_number ?? 'Unknown number'}
                      {c.status === 'missed' && (
                        <span className="ml-1.5 text-[10px] text-red-500 font-semibold">
                          MISSED
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {format(parseISO(c.created_at), 'MMM d, yyyy · h:mm a')} ·{' '}
                      <Clock className="inline h-2.5 w-2.5 -mt-0.5" />{' '}
                      {formatDuration(c.duration_seconds)} · {member}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      asChild
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      title="Redial"
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRedial(c.phone_number);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRedial(c.phone_number);
                          }
                        }}
                      >
                        <Phone className="h-3 w-3" />
                      </span>
                    </Button>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CollapsibleContent>

      <Dialog
        open={!!activeCall}
        onOpenChange={(o) => !o && setActiveCall(null)}
      >
        <DialogContent className="max-w-lg">
          {activeCall && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  {directionIcon(activeCall.direction, activeCall.status)}
                  {activeCall.phone_number ?? 'Unknown number'}
                  {activeCall.status === 'missed' && (
                    <span className="text-[10px] text-red-500 font-semibold">
                      MISSED
                    </span>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {format(parseISO(activeCall.created_at), 'MMM d, yyyy · h:mm a')} ·{' '}
                  <Clock className="inline h-3 w-3 -mt-0.5" />{' '}
                  {formatDuration(activeCall.duration_seconds)} · {activeCallMember}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {activeCall.recording_url ? (
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-muted-foreground shrink-0" />
                    <audio
                      controls
                      src={activeCall.recording_url}
                      className="h-8 w-full"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No recording available for this call.
                  </p>
                )}

                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Transcript
                    </span>
                  </div>
                  {activeCall.transcript ? (
                    <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {activeCall.transcript}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No transcript available for this call.
                    </p>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      handleRedial(activeCall.phone_number);
                      setActiveCall(null);
                    }}
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Redial
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
