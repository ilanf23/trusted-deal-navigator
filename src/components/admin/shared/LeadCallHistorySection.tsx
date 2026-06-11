import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCall } from '@/contexts/CallContext';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Play, FileText, Clock, ChevronDown, ChevronRight, RefreshCw, Loader2, AlertCircle,
} from 'lucide-react';
import { CallRecordingPlayer } from './CallRecordingPlayer';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  recording_status: string | null;
  transcript: string | null;
  transcription_status: string | null;
  transcription_error: string | null;
  created_at: string;
  user_id: string | null;
  content: string | null;
  call_sid: string | null;
}

type CallDetailState =
  | { kind: 'transcript-ready'; transcript: string }
  | { kind: 'transcript-processing' }
  | { kind: 'transcript-failed'; error: string | null }
  | { kind: 'recording-pending' }
  | { kind: 'no-recording'; hasCallSid: boolean };

function detailState(c: CommunicationRow): CallDetailState {
  if (c.transcript && c.transcript.trim().length > 0) {
    return { kind: 'transcript-ready', transcript: c.transcript };
  }
  if (c.transcription_status === 'processing' || c.transcription_status === 'pending') {
    return { kind: 'transcript-processing' };
  }
  if (c.transcription_status === 'failed') {
    return { kind: 'transcript-failed', error: c.transcription_error };
  }
  if (c.recording_url) {
    return { kind: 'recording-pending' };
  }
  return { kind: 'no-recording', hasCallSid: !!c.call_sid };
}

export type LeadCallHistoryEntity = 'potential' | 'underwriting' | 'lender_management';

interface LeadCallHistorySectionProps {
  leadId: string;
  relatedType: LeadCallHistoryEntity;
  teamMembers: Array<{ id: string; name: string }>;
  /** Optional: a phone number to use when "redial" is clicked with no
   *  phone on the row (falls back to the deal's primary phone). */
  fallbackPhone?: string | null;
  /** Optional: also surface calls whose phone_number matches any of these
   *  (matched on the last 10 digits), not just calls linked by lead_id.
   *  Lets a deal show inbound calls that were attributed to the contact. */
  phoneNumbers?: Array<string | null | undefined>;
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
  relatedType,
  teamMembers,
  fallbackPhone,
  phoneNumbers = [],
}: LeadCallHistorySectionProps) {
  const { makeOutboundCall } = useCall();
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState<CommunicationRow | null>(null);
  const [open, setOpen] = useState(true);
  const [busyAction, setBusyAction] = useState<null | 'recover' | 'retry'>(null);

  const last10s = useMemo(
    () =>
      Array.from(
        new Set(
          phoneNumbers
            .map((p) => (p ?? '').replace(/\D/g, '').slice(-10))
            .filter((d) => d.length === 10),
        ),
      ),
    [phoneNumbers],
  );

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['lead-call-history', relatedType, leadId, last10s.join(',')],
    queryFn: async () => {
      // Match calls linked to this deal (lead_id) OR placed/received on any of
      // the deal contact's phone numbers.
      const orParts = [
        `lead_id.eq.${leadId}`,
        ...last10s.map((d) => `phone_number.ilike.%${d}%`),
      ];
      const { data, error } = await supabase
        .from('communications')
        .select(
          'id, communication_type, direction, status, phone_number, duration_seconds, recording_url, recording_status, transcript, transcription_status, transcription_error, created_at, user_id, content, call_sid',
        )
        .eq('communication_type', 'call')
        .or(orParts.join(','))
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as CommunicationRow[];
    },
    staleTime: 30_000,
    // Only poll when at least one call is mid-flight. Avoids hammering the
    // DB for completed history while still catching the transition from
    // "processing" to "completed" without the user having to refresh.
    refetchInterval: (query) => {
      const rows = (query.state.data ?? []) as CommunicationRow[];
      const pending = rows.some((r) =>
        r.transcription_status === 'processing' || r.transcription_status === 'pending',
      );
      return pending ? 5000 : false;
    },
  });

  // Live-subscribe to the open call's row. The history query already polls,
  // but a per-row realtime subscription means the modal updates the instant
  // Whisper finishes instead of waiting for the next 5s poll. Cleans up on
  // close / unmount.
  useEffect(() => {
    if (!activeCall?.id) return;
    const channel = supabase
      .channel(`comm-${activeCall.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'communications', filter: `id=eq.${activeCall.id}` },
        (payload) => {
          const updated = payload.new as unknown as CommunicationRow;
          setActiveCall((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
          void queryClient.invalidateQueries({ queryKey: ['lead-call-history', relatedType, leadId] });
          void queryClient.invalidateQueries({ queryKey: ['call-history'] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeCall?.id, relatedType, leadId, queryClient]);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ['lead-call-history', relatedType, leadId] });
    void queryClient.invalidateQueries({ queryKey: ['call-history'] });
  };

  const handleRecoverRecording = async (call: CommunicationRow) => {
    if (!call.call_sid) {
      toast.error('No Twilio call SID — nothing to recover');
      return;
    }
    setBusyAction('recover');
    try {
      const { data, error } = await supabase.functions.invoke('backfill-call-recordings', {
        body: { communicationId: call.id, dry_run: false, include_missing_transcript: true },
      });
      if (error) throw error;
      const results = (data?.results ?? []) as Array<{ action?: string }>;
      const wasUpdated = results.some(
        (r) => r.action === 'updated' || r.action === 'updated-and-transcribed',
      );
      if (wasUpdated) {
        toast.success('Recording recovered');
      } else {
        toast.message('No recording found in Twilio for this call');
      }
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRetryTranscription = async (call: CommunicationRow) => {
    setBusyAction('retry');
    try {
      // Clear existing transcript first so the helper actually re-runs the
      // pipeline (it skips when a transcript is present).
      if (call.transcript) {
        await supabase
          .from('communications')
          .update({
            transcript: null,
            transcription_status: 'processing',
            transcription_error: null,
            transcription_updated_at: new Date().toISOString(),
          })
          .eq('id', call.id);
      }
      const { error } = await supabase.functions.invoke('retry-call-transcription', {
        body: { communicationId: call.id },
      });
      if (error) throw error;
      toast.success('Retry queued');
      invalidateAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setBusyAction(null);
    }
  };

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
                    <CallRecordingPlayer communicationId={activeCall.id} />
                  </div>
                ) : activeCall.recording_status === 'pending' ? (
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Recording processing…
                  </p>
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
                  {(() => {
                    const state = detailState(activeCall);
                    switch (state.kind) {
                      case 'transcript-ready':
                        return (
                          <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                            <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                              {state.transcript}
                            </p>
                          </div>
                        );
                      case 'transcript-processing':
                        return (
                          <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Generating transcript… this usually takes under a minute.
                          </p>
                        );
                      case 'transcript-failed':
                        return (
                          <div className="rounded-md border border-rose-200 bg-rose-50/50 p-2.5">
                            <p className="text-xs text-rose-700 flex items-start gap-1.5">
                              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>
                                Transcription failed.
                                {state.error ? ` ${state.error}` : ''}
                              </span>
                            </p>
                          </div>
                        );
                      case 'recording-pending':
                        return (
                          <p className="text-xs text-muted-foreground italic">
                            Recording saved — transcript will appear once Whisper finishes.
                          </p>
                        );
                      case 'no-recording':
                        return (
                          <p className="text-xs text-muted-foreground italic">
                            {state.hasCallSid
                              ? 'No recording in our database for this call.'
                              : 'No recording available for this call.'}
                          </p>
                        );
                    }
                  })()}
                </div>

                <div className="flex flex-wrap justify-end gap-2 pt-1">
                  {(() => {
                    const state = detailState(activeCall);
                    const showRecover = state.kind === 'no-recording' && state.hasCallSid;
                    const showRetry =
                      state.kind === 'transcript-failed' ||
                      (state.kind === 'recording-pending' && !!activeCall.recording_url);
                    return (
                      <>
                        {showRecover && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyAction !== null}
                            onClick={() => handleRecoverRecording(activeCall)}
                          >
                            {busyAction === 'recover' ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Recover recording
                          </Button>
                        )}
                        {showRetry && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={busyAction !== null}
                            onClick={() => handleRetryTranscription(activeCall)}
                          >
                            {busyAction === 'retry' ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            )}
                            Retry transcription
                          </Button>
                        )}
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
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Collapsible>
  );
}
