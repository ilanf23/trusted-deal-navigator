import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

interface TwilioCall {
  sid: string;
  parent_call_sid: string | null;
  from: string;
  from_formatted: string;
  to: string;
  to_formatted: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
  duration: string | null;
  direction: string;
  date_created: string;
}

interface TwilioCallsResponse {
  calls: TwilioCall[];
  next_page_uri: string | null;
}

interface CallHistoryRow {
  id: string;
  communication_type: 'call';
  direction: 'inbound' | 'outbound';
  phone_number: string | null;
  status: string | null;
  duration_seconds: number | null;
  created_at: string;
  lead_id: string | null;
  transcript: string | null;
  recording_url: string | null;
  recording_sid: string | null;
  call_sid: string;
  user_id: string | null;
  pipeline: { name: string; company_name: string | null } | null;
  source: 'twilio' | 'communications';
}

// Twilio's Calls API direction values: 'inbound', 'outbound-api', 'outbound-dial', 'trunking-originating', 'trunking-terminating'.
// Anything not 'inbound' is treated as outbound for the UI.
const normalizeDirection = (twilioDirection: string): 'inbound' | 'outbound' =>
  twilioDirection === 'inbound' ? 'inbound' : 'outbound';

// For an inbound call, the "other party" is `from`. For an outbound call, the
// "other party" is `to`. The CRM phone_number column always stores the
// customer-side number, never our Twilio number.
const otherPartyNumber = (call: TwilioCall, ownerNumber: string | null): string => {
  if (call.direction === 'inbound') return call.from;
  if (ownerNumber && call.from === ownerNumber) return call.to;
  return call.to;
};

const parseDuration = (raw: string | null): number | null => {
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

// Twilio Basic auth header: base64(accountSid:authToken)
const buildTwilioAuthHeader = (accountSid: string, authToken: string): string =>
  `Basic ${btoa(`${accountSid}:${authToken}`)}`;

const fetchTwilioCalls = async (
  accountSid: string,
  authToken: string,
  params: URLSearchParams,
): Promise<TwilioCall[]> => {
  const url = `${TWILIO_API_BASE}/Accounts/${accountSid}/Calls.json?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: buildTwilioAuthHeader(accountSid, authToken),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as TwilioCallsResponse;
  return data.calls ?? [];
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const rateLimitResponse = await enforceRateLimit(req, 'twilio-call-history', 60, 60);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      console.error('[twilio-call-history] missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
      return new Response(
        JSON.stringify({ error: 'Twilio credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authResult = await requireAdmin(req, supabase, { corsHeaders });
    if (!authResult.ok) return authResult.response;

    const teamMemberId = authResult.auth.teamMember!.id;
    const role = authResult.auth.teamMember?.app_role ?? null;

    // Resolve the caller's Twilio number. Used to (a) filter the Twilio API
    // response to just their calls when they aren't a super_admin/owner, and
    // (b) determine which number is "ours" vs "the customer" when mapping.
    const { data: ownerRow, error: ownerError } = await supabase
      .from('users')
      .select('twilio_phone_number')
      .eq('id', teamMemberId)
      .maybeSingle();

    if (ownerError) {
      console.error('[twilio-call-history] users lookup failed:', ownerError.message);
      return new Response(
        JSON.stringify({ error: 'Failed to resolve caller phone number' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const ownerNumber = ownerRow?.twilio_phone_number ?? null;
    // Super admins (or owners) see every call on the Twilio account. Everyone
    // else is scoped to calls touching their own number. Matches the prior
    // RLS-based scoping in src/pages/admin/Calls.tsx.
    const seeAll = role === 'super_admin' || authResult.auth.teamMember?.is_owner === true;

    if (!seeAll && !ownerNumber) {
      // No number assigned and not an owner — nothing to show.
      return new Response(JSON.stringify({ calls: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const pageSize = Math.min(parseInt(url.searchParams.get('pageSize') ?? '200', 10) || 200, 1000);

    // Twilio's filter is AND-only across From/To, so to scope by "either side
    // matches my number" we issue two calls in parallel and dedupe by Sid.
    let twilioCalls: TwilioCall[];
    if (seeAll) {
      const params = new URLSearchParams({ PageSize: String(pageSize) });
      twilioCalls = await fetchTwilioCalls(accountSid, authToken, params);
    } else {
      const num = ownerNumber as string;
      const [fromMine, toMine] = await Promise.all([
        fetchTwilioCalls(
          accountSid,
          authToken,
          new URLSearchParams({ From: num, PageSize: String(pageSize) }),
        ),
        fetchTwilioCalls(
          accountSid,
          authToken,
          new URLSearchParams({ To: num, PageSize: String(pageSize) }),
        ),
      ]);
      const seen = new Set<string>();
      twilioCalls = [...fromMine, ...toMine].filter((c) => {
        if (seen.has(c.sid)) return false;
        seen.add(c.sid);
        return true;
      });
    }

    // Sort newest-first by Twilio's date_created (RFC 2822 string).
    twilioCalls.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());
    const limited = twilioCalls.slice(0, pageSize);

    // Enrichment: pull every communications row matching the returned call_sids
    // in a single query. This is where transcript / recording_url / lead_id /
    // pipeline join data lives — Twilio doesn't know about any of that.
    const callSids = limited.map((c) => c.sid);
    const { data: commRows, error: commError } = callSids.length
      ? await supabase
          .from('communications')
          .select(`
            id,
            call_sid,
            transcript,
            recording_url,
            recording_sid,
            lead_id,
            user_id,
            pipeline:pipeline (
              name,
              company_name
            )
          `)
          .in('call_sid', callSids)
      : { data: [], error: null };

    if (commError) {
      console.error('[twilio-call-history] communications enrichment failed:', commError.message);
    }

    type CommRow = {
      id: string;
      call_sid: string;
      transcript: string | null;
      recording_url: string | null;
      recording_sid: string | null;
      lead_id: string | null;
      user_id: string | null;
      pipeline: { name: string; company_name: string | null } | null;
    };
    const commBySid = new Map<string, CommRow>(
      ((commRows ?? []) as unknown as CommRow[]).map((row) => [row.call_sid, row]),
    );

    const merged: CallHistoryRow[] = limited.map((call) => {
      const enrichment = commBySid.get(call.sid);
      return {
        // Use the communications.id when present so existing UI actions
        // (transcript dialog, retry-transcription) keep working. Fall back to
        // the Twilio Sid for calls that never landed in our DB.
        id: enrichment?.id ?? call.sid,
        communication_type: 'call',
        direction: normalizeDirection(call.direction),
        phone_number: otherPartyNumber(call, ownerNumber),
        status: call.status,
        duration_seconds: parseDuration(call.duration),
        created_at: call.start_time ?? call.date_created,
        lead_id: enrichment?.lead_id ?? null,
        transcript: enrichment?.transcript ?? null,
        recording_url: enrichment?.recording_url ?? null,
        recording_sid: enrichment?.recording_sid ?? null,
        call_sid: call.sid,
        user_id: enrichment?.user_id ?? null,
        pipeline: enrichment?.pipeline ?? null,
        source: enrichment ? 'communications' : 'twilio',
      };
    });

    return new Response(JSON.stringify({ calls: merged }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[twilio-call-history] unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
