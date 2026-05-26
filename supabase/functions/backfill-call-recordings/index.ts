import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { transcribeCommunication } from '../_shared/transcription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

/**
 * Recover Twilio recordings + transcripts for communications rows whose
 * webhook attribution missed (recording callback never fired, or the
 * recording landed but Whisper failed). Replaces the prior unverified-JWT
 * backfill: now admin-only, supports inbound + outbound, supports targeted
 * single-call repair by communicationId or call_sid, and never combines
 * recording recovery with orphan deletion in the same default flow.
 *
 * Request body (all fields optional):
 *   {
 *     communicationId?: string,    // repair exactly this row
 *     callSid?: string,            // repair the row matching this Twilio Sid
 *     days_back?: number = 30,     // window for the broad scan
 *     dry_run?: boolean = true,    // never write unless explicitly false
 *     include_missing_transcript?: boolean = true,
 *     delete_orphans?: boolean = false,  // opt-in destructive cleanup
 *   }
 */

interface TwilioCall {
  sid: string;
  status: string;
  duration: string | null;
}

interface TwilioRecording {
  sid: string;
  uri: string;
  duration: string | null;
}

async function twilioGet<T>(path: string, accountSid: string, authToken: string): Promise<T | null> {
  const url = `https://api.twilio.com${path}`;
  const basic = btoa(`${accountSid}:${authToken}`);
  const res = await fetch(url, { headers: { Authorization: `Basic ${basic}` } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Twilio GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return await res.json() as T;
}

type CommRow = {
  id: string;
  call_sid: string | null;
  direction: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  status: string | null;
  lead_id: string | null;
  transcript: string | null;
};

interface RepairBody {
  communicationId?: string;
  callSid?: string;
  days_back?: number;
  dry_run?: boolean;
  include_missing_transcript?: boolean;
  delete_orphans?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'backfill-call-recordings', 5, 60);
  if (rateLimitResponse) return rateLimitResponse;

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!accountSid || !authToken) {
    return new Response(
      JSON.stringify({ error: 'Twilio credentials missing in env' }),
      { status: 500, headers: corsHeaders },
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Admin-only. requireAdmin verifies the Authorization bearer JWT against
  // auth.users and checks users.app_role ∈ {admin, super_admin}. Replaces the
  // unverified-JWT shape check that previously gated this endpoint.
  const authResult = await requireAdmin(req, supabase, { corsHeaders });
  if (!authResult.ok) return authResult.response;

  let body: RepairBody = {};
  try {
    body = await req.json();
  } catch {
    // empty body == defaults
  }
  const daysBack = body.days_back ?? 30;
  const dryRun = body.dry_run ?? true;
  const includeMissingTranscript = body.include_missing_transcript ?? true;
  const deleteOrphans = body.delete_orphans ?? false; // opt-in, separate from repair

  // Build candidate set. Three modes:
  //   1. communicationId — repair exactly one row.
  //   2. callSid — repair the row matching that Twilio Sid.
  //   3. broad scan — within days_back window, all calls (both directions)
  //      that have a call_sid AND (missing recording OR optionally missing
  //      transcript despite a recording).
  let candidates: CommRow[] = [];
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  if (body.communicationId) {
    const { data, error } = await supabase
      .from('communications')
      .select('id, call_sid, direction, duration_seconds, recording_url, status, lead_id, transcript')
      .eq('id', body.communicationId)
      .maybeSingle();
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to load communication', detail: error.message }),
        { status: 500, headers: corsHeaders },
      );
    }
    if (!data) {
      return new Response(JSON.stringify({ error: 'communication not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    candidates = [data as CommRow];
  } else if (body.callSid) {
    const { data, error } = await supabase
      .from('communications')
      .select('id, call_sid, direction, duration_seconds, recording_url, status, lead_id, transcript')
      .eq('call_sid', body.callSid)
      .maybeSingle();
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to load communication by call_sid', detail: error.message }),
        { status: 500, headers: corsHeaders },
      );
    }
    if (!data) {
      return new Response(JSON.stringify({ error: 'no communication for that call_sid' }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    candidates = [data as CommRow];
  } else {
    // Broad scan. Include both directions. Include rows where recording_url
    // is null OR (recording_url exists but transcript is null), when the
    // caller has opted into transcript repair. Do NOT require lead_id —
    // unlinked rows are valid repair targets.
    const orClauses = ['recording_url.is.null'];
    if (includeMissingTranscript) orClauses.push('transcript.is.null');
    const { data, error } = await supabase
      .from('communications')
      .select('id, call_sid, direction, duration_seconds, recording_url, status, lead_id, transcript')
      .eq('communication_type', 'call')
      .gte('created_at', since)
      .not('call_sid', 'is', null)
      .or(orClauses.join(','));
    if (error) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch communications', detail: error.message }),
        { status: 500, headers: corsHeaders },
      );
    }
    candidates = (data ?? []) as CommRow[];
  }

  const results: Array<Record<string, unknown>> = [];
  let updatedCount = 0;
  let transcribedCount = 0;
  let errorCount = 0;

  for (const row of candidates) {
    if (!row.call_sid) {
      results.push({ id: row.id, action: 'skip', reason: 'no call_sid' });
      continue;
    }
    try {
      const call = await twilioGet<TwilioCall>(
        `/2010-04-01/Accounts/${accountSid}/Calls/${row.call_sid}.json`,
        accountSid,
        authToken,
      );
      if (!call) {
        results.push({
          id: row.id,
          call_sid: row.call_sid,
          action: 'skip',
          reason: 'call not found in Twilio',
        });
        continue;
      }

      const recordings = await twilioGet<{ recordings: TwilioRecording[] }>(
        `/2010-04-01/Accounts/${accountSid}/Calls/${row.call_sid}/Recordings.json`,
        accountSid,
        authToken,
      );
      const recording = recordings?.recordings?.[0] ?? null;
      const mp3Url = recording
        ? `https://api.twilio.com${recording.uri.replace('.json', '')}.mp3`
        : null;

      const update: Record<string, unknown> = {};
      const callDur = parseInt(call.duration ?? '');
      if (row.duration_seconds == null && Number.isFinite(callDur) && callDur > 0) {
        update.duration_seconds = callDur;
      }
      if (!row.status && call.status) {
        update.status = call.status;
      }
      if (!row.recording_url && mp3Url) {
        update.recording_url = mp3Url;
        update.recording_sid = recording!.sid;
        update.recording_status = 'available';
      } else if (!mp3Url && !row.recording_url) {
        update.recording_status = 'not_found';
      }

      // Need transcription if: caller wants transcripts AND we (now) have a
      // recording AND no transcript yet. The shared transcription helper will
      // also write transcription_status transitions.
      const willHaveRecording = !!mp3Url || !!row.recording_url;
      const willTranscribe = includeMissingTranscript && !row.transcript && willHaveRecording;

      if (Object.keys(update).length === 0 && !willTranscribe) {
        results.push({
          id: row.id,
          call_sid: row.call_sid,
          action: 'noop',
          call_status: call.status,
          has_recording: willHaveRecording,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          id: row.id,
          call_sid: row.call_sid,
          action: 'would-update',
          update,
          would_transcribe: willTranscribe,
        });
        continue;
      }

      if (Object.keys(update).length > 0) {
        const { error: updateError } = await supabase
          .from('communications')
          .update(update)
          .eq('id', row.id);

        if (updateError) {
          errorCount++;
          results.push({
            id: row.id,
            call_sid: row.call_sid,
            action: 'error',
            error: updateError.message,
          });
          continue;
        }
        updatedCount++;
      }

      if (willTranscribe) {
        const transcribeRes = await transcribeCommunication(supabase, row.id, {
          skipIfPresent: true,
        });
        if (transcribeRes.ok && !transcribeRes.alreadyPresent) {
          transcribedCount++;
          results.push({
            id: row.id,
            call_sid: row.call_sid,
            action: 'updated-and-transcribed',
            update,
          });
        } else if (!transcribeRes.ok) {
          errorCount++;
          results.push({
            id: row.id,
            call_sid: row.call_sid,
            action: 'updated-transcription-failed',
            update,
            error: transcribeRes.error,
          });
        } else {
          results.push({
            id: row.id,
            call_sid: row.call_sid,
            action: 'updated',
            update,
          });
        }
      } else {
        results.push({ id: row.id, call_sid: row.call_sid, action: 'updated', update });
      }
    } catch (err) {
      errorCount++;
      results.push({
        id: row.id,
        call_sid: row.call_sid,
        action: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Orphan cleanup. Decoupled from repair: only runs when explicitly enabled,
  // and even then a dry_run does not delete. The selection is narrower than
  // before — only rows with the exact "Outgoing call - <status>" content that
  // the old buggy webhook path generated.
  let orphansFound = 0;
  let orphansDeleted = 0;
  let orphanIds: string[] = [];
  if (deleteOrphans && !body.communicationId && !body.callSid) {
    const { data: orphans } = await supabase
      .from('communications')
      .select('id, call_sid, created_at')
      .eq('communication_type', 'call')
      .eq('direction', 'outbound')
      .is('lead_id', null)
      .like('content', 'Outgoing call - %')
      .gte('created_at', since);

    orphanIds = (orphans ?? []).map((o) => o.id);
    orphansFound = orphanIds.length;

    if (!dryRun && orphanIds.length > 0) {
      const { error: delError } = await supabase
        .from('communications')
        .delete()
        .in('id', orphanIds);
      if (!delError) orphansDeleted = orphanIds.length;
    }
  }

  return new Response(
    JSON.stringify({
      dry_run: dryRun,
      mode: body.communicationId
        ? 'single-by-id'
        : body.callSid
          ? 'single-by-call-sid'
          : 'window-scan',
      days_back: body.communicationId || body.callSid ? null : daysBack,
      since: body.communicationId || body.callSid ? null : since,
      include_missing_transcript: includeMissingTranscript,
      delete_orphans: deleteOrphans,
      candidates_found: candidates.length,
      updated: dryRun
        ? results.filter((r) => r.action === 'would-update').length
        : updatedCount,
      transcribed: dryRun
        ? results.filter((r) => r.would_transcribe).length
        : transcribedCount,
      orphans_found: orphansFound,
      orphans_deleted: orphansDeleted,
      errors: errorCount,
      results,
    }, null, 2),
    { status: 200, headers: corsHeaders },
  );
});
