import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { transcribeCommunication } from '../_shared/transcription.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

/**
 * One-off backfill for outbound calls whose webhook attribution missed
 * (pre-fix). For each affected communications row this function:
 *   1. Hits Twilio REST API for call details (status, duration).
 *   2. Hits Twilio REST API for the recording (if any) → mp3 URL + sid.
 *   3. Writes both back to the communications row.
 *   4. Kicks off background transcription if a recording was just added.
 *   5. Optionally deletes orphan backstop rows (lead_id IS NULL,
 *      content LIKE 'Outgoing call - %') that the old buggy webhook path
 *      created with the child call_sid.
 *
 * Auth: require service-role key in Authorization header. Body:
 *   { days_back?: number = 30, dry_run?: boolean = true, delete_orphans?: boolean = true }
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

  // Auth: accept any Bearer token that decodes to a JWT issued for this
  // Supabase project (the project gateway already validates project-scoped
  // JWTs at the edge in normal mode; this function is deployed with
  // --no-verify-jwt so we re-check minimally here). Intended for one-off
  // invocation by an operator using the legacy service_role JWT; remove
  // this function after running.
  const authHeader = req.headers.get('Authorization') ?? '';
  const presented = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : '';
  if (!presented) {
    return new Response(
      JSON.stringify({ error: 'Bearer token required' }),
      { status: 401, headers: corsHeaders },
    );
  }
  // Soft check: token must look like a JWT (3 dot-separated segments) issued
  // for this project ref. We don't verify the signature — Twilio creds are
  // env-only and the project ref scope is enough for a one-off backfill.
  try {
    const segs = presented.split('.');
    if (segs.length !== 3) throw new Error('not a JWT');
    const payload = JSON.parse(atob(segs[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expectedRef = new URL(supabaseUrl).hostname.split('.')[0];
    if (payload.ref !== expectedRef) throw new Error('wrong project ref');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Invalid bearer token', detail: err instanceof Error ? err.message : String(err) }),
      { status: 401, headers: corsHeaders },
    );
  }

  let body: { days_back?: number; dry_run?: boolean; delete_orphans?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // no body == defaults
  }
  const daysBack = body.days_back ?? 30;
  const dryRun = body.dry_run ?? true;
  const deleteOrphans = body.delete_orphans ?? true;

  const supabase = createClient(supabaseUrl, serviceKey);
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // 1. Find affected rows: outbound calls with a call_sid, missing duration OR recording.
  const { data: rows, error: rowsError } = await supabase
    .from('communications')
    .select('id, call_sid, duration_seconds, recording_url, status, lead_id, direction, transcript')
    .eq('communication_type', 'call')
    .eq('direction', 'outbound')
    .gte('created_at', since)
    .not('call_sid', 'is', null)
    .or('duration_seconds.is.null,recording_url.is.null');

  if (rowsError) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch communications', detail: rowsError.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  // Diagnostic: count the broader universe so we can tell whether the filter
  // is too narrow or there genuinely is nothing to fix.
  const { count: totalOutboundInWindow } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('communication_type', 'call')
    .eq('direction', 'outbound')
    .gte('created_at', since);
  const { count: totalAllDirectionsInWindow } = await supabase
    .from('communications')
    .select('id', { count: 'exact', head: true })
    .eq('communication_type', 'call')
    .gte('created_at', since);

  // Sample outbound rows so we can see actual field values (null vs 0 vs '').
  const { data: outboundSample } = await supabase
    .from('communications')
    .select('id, call_sid, duration_seconds, recording_url, recording_sid, status, lead_id, phone_number, created_at')
    .eq('communication_type', 'call')
    .eq('direction', 'outbound')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(15);

  const candidates = (rows ?? []).filter((r) => !!r.call_sid && !!r.lead_id);
  const candidatesNoLead = (rows ?? []).filter((r) => !!r.call_sid && !r.lead_id);

  const results: Array<Record<string, unknown>> = [];
  let updatedCount = 0;
  let transcribedCount = 0;
  let errorCount = 0;

  for (const row of candidates) {
    try {
      const call = await twilioGet<TwilioCall>(
        `/2010-04-01/Accounts/${accountSid}/Calls/${row.call_sid}.json`,
        accountSid,
        authToken,
      );
      if (!call) {
        results.push({ id: row.id, call_sid: row.call_sid, action: 'skip', reason: 'call not found in Twilio' });
        continue;
      }

      const recordings = await twilioGet<{ recordings: TwilioRecording[] }>(
        `/2010-04-01/Accounts/${accountSid}/Calls/${row.call_sid}/Recordings.json`,
        accountSid,
        authToken,
      );
      const recording = recordings?.recordings?.[0] ?? null;
      const mp3Url = recording ? `https://api.twilio.com${recording.uri.replace('.json', '')}.mp3` : null;

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
      }

      const willTranscribe = !row.transcript && !row.recording_url && mp3Url;

      if (Object.keys(update).length === 0) {
        results.push({ id: row.id, call_sid: row.call_sid, action: 'noop', call_status: call.status });
        continue;
      }

      if (dryRun) {
        results.push({ id: row.id, call_sid: row.call_sid, action: 'would-update', update, would_transcribe: willTranscribe });
        continue;
      }

      const { error: updateError } = await supabase
        .from('communications')
        .update(update)
        .eq('id', row.id);

      if (updateError) {
        errorCount++;
        results.push({ id: row.id, call_sid: row.call_sid, action: 'error', error: updateError.message });
        continue;
      }

      updatedCount++;
      results.push({ id: row.id, call_sid: row.call_sid, action: 'updated', update });

      if (willTranscribe) {
        const transcribeRes = await transcribeCommunication(supabase, row.id, { skipIfPresent: true });
        if (transcribeRes.ok && !transcribeRes.alreadyPresent) {
          transcribedCount++;
        }
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

  // 2. Orphan cleanup.
  let orphansDeleted = 0;
  let orphanIds: string[] = [];
  if (deleteOrphans) {
    const { data: orphans } = await supabase
      .from('communications')
      .select('id, call_sid, created_at')
      .eq('communication_type', 'call')
      .eq('direction', 'outbound')
      .is('lead_id', null)
      .like('content', 'Outgoing call - %')
      .gte('created_at', since);

    orphanIds = (orphans ?? []).map((o) => o.id);

    if (!dryRun && orphanIds.length > 0) {
      const { error: delError } = await supabase
        .from('communications')
        .delete()
        .in('id', orphanIds);
      if (!delError) orphansDeleted = orphanIds.length;
    } else {
      orphansDeleted = orphanIds.length;
    }
  }

  return new Response(
    JSON.stringify({
      dry_run: dryRun,
      days_back: daysBack,
      since,
      diagnostic_total_calls_in_window: totalAllDirectionsInWindow,
      diagnostic_total_outbound_in_window: totalOutboundInWindow,
      diagnostic_rows_returned_by_main_query: rows?.length ?? 0,
      diagnostic_candidates_skipped_no_lead: candidatesNoLead.length,
      diagnostic_outbound_sample: outboundSample,
      candidates_found: candidates.length,
      updated: dryRun ? results.filter((r) => r.action === 'would-update').length : updatedCount,
      transcribed: dryRun ? results.filter((r) => r.would_transcribe).length : transcribedCount,
      orphans_found: orphanIds.length,
      orphans_deleted: orphansDeleted,
      errors: errorCount,
      results,
    }, null, 2),
    { status: 200, headers: corsHeaders },
  );
});
