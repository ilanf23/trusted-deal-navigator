import { createClient } from '../_shared/supabase.ts';
import { enforceRateLimit } from '../_shared/rateLimit.ts';
import { requireAdmin } from '../_shared/auth.ts';
import { transcribeCommunication } from '../_shared/transcription.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

// Hard cutoff: all Twilio calls created before this ISO timestamp are hidden
// from the call history UI. Set on 2026-05-26 when the feature was reset so
// the history could start from scratch without touching Twilio's records.
// Remove (or move earlier) when older calls should re-appear.
const CALL_HISTORY_VISIBLE_AFTER = '2026-05-26T14:11:30Z';

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
  transcription_status: string | null;
  transcription_error: string | null;
  recording_url: string | null;
  recording_sid: string | null;
  recording_status: string | null;
  call_sid: string;
  user_id: string | null;
  pipeline: { name: string; company_name: string | null } | null;
  // Matched CRM contact resolved by the customer-side phone number against
  // public.people (direct people.phone match first, related_contact_points
  // polymorphic table second). Null when nothing matches — the UI falls back to the
  // pipeline name, then to the raw phone, then to "Unknown caller".
  contact: { id: string; name: string; company_name: string | null } | null;
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
    // Per-rep scoping: super_admins (or owners) see every call on the Twilio
    // account; everyone else is scoped to calls touching their own number.
    // (Briefly switched to SaaS-wide visibility, then reverted at user
    // request — each rep should only see their own call history.)
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
    // Twilio's StartTime>= filter narrows the API payload to calls on/after
    // the cutoff. We also re-apply the cutoff in JS below so the boundary is
    // authoritative regardless of how Twilio interprets the param.
    const baseParams = (): URLSearchParams => {
      const p = new URLSearchParams({ PageSize: String(pageSize) });
      p.append('StartTime>=', CALL_HISTORY_VISIBLE_AFTER);
      return p;
    };

    // Per-rep scope: super_admins/owners get the full account-wide list;
    // everyone else is scoped to calls touching their own ownerNumber.
    // Twilio's filter is AND-only across From/To, so to scope by "either
    // side matches my number" we issue two calls in parallel and dedupe by
    // Sid.
    let rawTwilioCalls: TwilioCall[];
    if (seeAll) {
      rawTwilioCalls = await fetchTwilioCalls(accountSid, authToken, baseParams());
    } else {
      const num = ownerNumber as string;
      const fromParams = baseParams();
      fromParams.append('From', num);
      const toParams = baseParams();
      toParams.append('To', num);
      const [fromMine, toMine] = await Promise.all([
        fetchTwilioCalls(accountSid, authToken, fromParams),
        fetchTwilioCalls(accountSid, authToken, toParams),
      ]);
      const seen = new Set<string>();
      rawTwilioCalls = [...fromMine, ...toMine].filter((c) => {
        if (seen.has(c.sid)) return false;
        seen.add(c.sid);
        return true;
      });
    }

    const cutoffMs = new Date(CALL_HISTORY_VISIBLE_AFTER).getTime();
    const twilioCalls = rawTwilioCalls.filter((c) => {
      const t = new Date(c.date_created).getTime();
      return Number.isFinite(t) && t >= cutoffMs;
    });

    twilioCalls.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

    // Drop the internal browser-client legs of each call. Twilio's Calls API
    // returns BOTH legs of every call — the customer-side leg (real PSTN
    // number) and the client-side leg (`client:clx-admin-<userId>`, the leg
    // that rings the rep's browser tab). The client leg has no phone number,
    // duplicates the customer leg in the UI, and carries no info that isn't
    // already on the communications row (rep attribution lives in user_id).
    // Filtering on either side of the call catches it in both directions:
    // inbound child legs (to: client:...) and outbound parent legs initiated
    // from the browser SDK (from: client:...).
    const visibleCalls = twilioCalls.filter(
      (c) => !c.from.startsWith('client:') && !c.to.startsWith('client:'),
    );

    const limited = visibleCalls.slice(0, pageSize);

    // Build a `users.id → users.name` map so we can swap out raw Twilio Client
    // identities like `client:clx-admin-<userId>` for the human-readable rep
    // name (e.g. "Evan") wherever they would otherwise leak into the UI.
    const { data: clientUsers } = await supabase
      .from('users')
      .select('id, name');
    const userIdToName = new Map<string, string>(
      ((clientUsers ?? []) as { id: string; name: string | null }[])
        .filter((u) => !!u.name)
        .map((u) => [u.id, u.name as string]),
    );

    // Replace `client:clx-admin[-<userId>]` with the matching admin's name.
    // Real phone numbers and any other identity shape pass through untouched.
    const friendlyIdentity = (raw: string | null | undefined): string => {
      if (!raw) return '';
      if (!raw.startsWith('client:')) return raw;
      const m = raw.match(/^client:clx-admin(?:-(.+))?$/);
      if (!m) return raw;
      const userId = m[1];
      if (userId) {
        return userIdToName.get(userId) ?? 'Admin';
      }
      return 'Admin';
    };

    // Enrichment: pull every communications row matching the returned call_sids
    // in a single query. This is where transcript / recording_url / lead_id
    // live — Twilio doesn't know about any of that. We deliberately do NOT
    // attempt an embedded `pipeline:pipeline(...)` join here: there is no FK
    // from communications.lead_id to pipeline (or potential), so PostgREST
    // can't infer the relation and the entire enrichment silently returns
    // zero rows — which is why stored transcripts were missing from this view.
    const callSids = limited.map((c) => c.sid);
    const { data: commRows, error: commError } = callSids.length
      ? await supabase
          .from('communications')
          .select(`
            id,
            call_sid,
            transcript,
            transcription_status,
            transcription_error,
            recording_url,
            recording_sid,
            recording_status,
            lead_id,
            user_id
          `)
          .in('call_sid', callSids)
      : { data: [], error: null };

    if (commError) {
      // Fail visibly. Previously this query failed silently and rows were
      // returned with `source: 'twilio'` as though no transcript existed,
      // which is the exact UX the user reported. Surface the error so the
      // client sees it and can refresh; do NOT pretend everything succeeded.
      console.error('[twilio-call-history] communications enrichment failed:', commError.message);
      return new Response(
        JSON.stringify({
          error: 'Failed to enrich call history',
          detail: commError.message,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    type CommRow = {
      id: string;
      call_sid: string;
      transcript: string | null;
      transcription_status: string | null;
      transcription_error: string | null;
      recording_url: string | null;
      recording_sid: string | null;
      recording_status: string | null;
      lead_id: string | null;
      user_id: string | null;
    };
    const commBySid = new Map<string, CommRow>(
      ((commRows ?? []) as unknown as CommRow[]).map((row) => [row.call_sid, row]),
    );

    // Resolve opportunity (potential) name/company in a separate query keyed
    // off the unique lead_ids on the matched communications rows. Memory map
    // is O(n) and avoids the broken embedded relation entirely.
    const leadIds = Array.from(
      new Set(
        ((commRows ?? []) as unknown as CommRow[])
          .map((row) => row.lead_id)
          .filter((id): id is string => !!id),
      ),
    );
    let opportunityById = new Map<string, { name: string; company_name: string | null }>();
    if (leadIds.length > 0) {
      const { data: opportunities, error: oppError } = await supabase
        .from('deals')
        .select('id, name, company_name')
        .in('id', leadIds);
      if (oppError) {
        console.error('[twilio-call-history] opportunity enrichment failed:', oppError.message);
        // Non-fatal: we'd rather show calls without deal names than 500 here.
        // The primary communications enrichment already succeeded.
      } else if (opportunities) {
        opportunityById = new Map(
          (opportunities as Array<{ id: string; name: string; company_name: string | null }>).map(
            (o) => [o.id, { name: o.name, company_name: o.company_name }],
          ),
        );
      }
    }

    // ── CRM contact enrichment ─────────────────────────────────────────────
    // Resolve every customer-side phone number on the call list to a person in
    // public.people. Two lookup paths because phone numbers can live in either
    // place depending on how the contact was created:
    //   1. people.phone — direct column; populated when a contact was created
    //      from the People UI with a single phone field.
    //   2. related_contact_points (kind='phone') — polymorphic, multi-value
    //      table; populated when a contact has multiple numbers
    //      (mobile/work/home) and from imports.
    // Both are matched on the LAST 10 DIGITS to ignore +1, parens, dashes,
    // spaces. people.phone wins ties — contacts created directly in the People
    // UI should display "as themselves" even if a stale related_contact_points row
    // points the same number at another related.
    const lastTen = (raw: string): string => raw.replace(/\D/g, '').slice(-10);

    const callerPhones = Array.from(
      new Set(
        limited
          .map((c) => otherPartyNumber(c, ownerNumber))
          .filter((p): p is string => !!p)
          .map(lastTen)
          .filter((p) => p.length === 10),
      ),
    );

    const contactByLastTen = new Map<string, { id: string; name: string; company_name: string | null }>();

    if (callerPhones.length > 0) {
      // Path 1: direct people.phone match. We can't `WHERE last10(phone) IN
      // (...)` server-side without a generated column, so pull every row with
      // a non-null phone (the table is bounded by CRM size — small) and
      // bucket client-side. ilike with an OR on N variants would also work
      // but blows up at >50 numbers.
      const { data: directPeople, error: directPeopleErr } = await supabase
        .from('people')
        .select('id, name, company_name, phone')
        .not('phone', 'is', null);
      if (directPeopleErr) {
        console.error('[twilio-call-history] people direct lookup failed:', directPeopleErr.message);
      } else if (directPeople) {
        const wanted = new Set(callerPhones);
        for (const p of directPeople as Array<{ id: string; name: string; company_name: string | null; phone: string | null }>) {
          if (!p.phone) continue;
          const key = lastTen(p.phone);
          if (key.length === 10 && wanted.has(key) && !contactByLastTen.has(key)) {
            contactByLastTen.set(key, { id: p.id, name: p.name, company_name: p.company_name });
          }
        }
      }

      // Path 2: related_contact_points (kind='phone') for any phone we still
      // haven't resolved. Only
      // pull rows whose related_type points at the people table (enum value is
      // 'people', not 'person'). Skipping the other related_type values
      // (companies, potential, underwriting, lender_management, pipeline)
      // ensures we don't resolve a call to a company name or a deal name —
      // the user explicitly wanted people to be the source of truth.
      const missing = callerPhones.filter((p) => !contactByLastTen.has(p));
      if (missing.length > 0) {
        // Try last-10-digit ilike on each missing number. Single OR-clause is
        // fine for the bounded missing-set; PostgREST builds it server-side.
        const orClause = missing
          .map((p) => `value.ilike.%${p}`)
          .join(',');
        // related_contact_points.related_id now points at the canonical related
        // table; the actual people.id lives in related.source_id, so embed
        // related via the FK and resolve through source_id. Note: the embedded
        // related.kind (people/companies/deal) is distinct from the contact
        // point's own kind column ('email'/'phone') filtered here.
        const { data: ephones, error: ephonesErr } = await supabase
          .from('related_contact_points')
          .select('related_id, related_type, value, related!inner(kind, source_id)')
          .eq('kind', 'phone')
          .eq('related_type', 'people')
          .or(orClause);
        if (ephonesErr) {
          console.error('[twilio-call-history] related_contact_points lookup failed:', ephonesErr.message);
        } else if (ephones && ephones.length > 0) {
          // With !inner the embed types as an object, but handle array shape
          // defensively in case the client returns one.
          const sourceIdOf = (e: { related?: { source_id: string | null } | Array<{ source_id: string | null }> | null }): string | null => {
            const ent = Array.isArray(e.related) ? e.related[0] : e.related;
            return ent?.source_id ?? null;
          };
          const personIds = Array.from(
            new Set(
              (ephones as Array<{ related?: { source_id: string | null } | Array<{ source_id: string | null }> | null }>)
                .map(sourceIdOf)
                .filter((id): id is string => typeof id === 'string' && id.length > 0),
            ),
          );
          const personById = new Map<string, { id: string; name: string; company_name: string | null }>();
          if (personIds.length > 0) {
            const { data: personRows, error: personErr } = await supabase
              .from('people')
              .select('id, name, company_name')
              .in('id', personIds);
            if (personErr) {
              console.error('[twilio-call-history] people-by-id lookup failed:', personErr.message);
            } else if (personRows) {
              for (const p of personRows as Array<{ id: string; name: string; company_name: string | null }>) {
                personById.set(p.id, p);
              }
            }
          }
          for (const e of ephones as Array<{ value: string; related?: { source_id: string | null } | Array<{ source_id: string | null }> | null }>) {
            const key = lastTen(e.value);
            if (key.length !== 10) continue;
            if (contactByLastTen.has(key)) continue;
            const sourceId = sourceIdOf(e);
            const person = sourceId ? personById.get(sourceId) : undefined;
            if (person) contactByLastTen.set(key, person);
          }
        }
      }
    }

    const merged: CallHistoryRow[] = limited.map((call) => {
      const enrichment = commBySid.get(call.sid);
      const opportunity = enrichment?.lead_id
        ? opportunityById.get(enrichment.lead_id) ?? null
        : null;
      const customerPhone = otherPartyNumber(call, ownerNumber);
      const contact = customerPhone
        ? contactByLastTen.get(lastTen(customerPhone)) ?? null
        : null;
      return {
        // Use the communications.id when present so existing UI actions
        // (transcript dialog, retry-transcription) keep working. Fall back to
        // the Twilio Sid for calls that never landed in our DB.
        id: enrichment?.id ?? call.sid,
        communication_type: 'call',
        direction: normalizeDirection(call.direction),
        phone_number: friendlyIdentity(otherPartyNumber(call, ownerNumber)),
        status: call.status,
        duration_seconds: parseDuration(call.duration),
        created_at: call.start_time ?? call.date_created,
        lead_id: enrichment?.lead_id ?? null,
        transcript: enrichment?.transcript ?? null,
        transcription_status: enrichment?.transcription_status ?? null,
        transcription_error: enrichment?.transcription_error ?? null,
        recording_url: enrichment?.recording_url ?? null,
        recording_sid: enrichment?.recording_sid ?? null,
        recording_status: enrichment?.recording_status ?? null,
        call_sid: call.sid,
        user_id: enrichment?.user_id ?? null,
        pipeline: opportunity,
        contact,
        source: enrichment ? 'communications' : 'twilio',
      };
    });

    // ── Zombie sweeper ─────────────────────────────────────────────────────
    // Background fire-and-forget: any transcription stuck in 'processing' for
    // more than 10 minutes gets re-queued via the same pipeline. This protects
    // against Whisper jobs killed by the ~150-second EdgeRuntime.waitUntil
    // window, OpenAI rate-limit storms that exhausted retries, or pipelines
    // that died before they could mark the row 'failed'. Re-queue is
    // idempotent (skipIfPresent) so a transcript that finished between sweeps
    // is left alone. Capped at 5 rows per page-load to avoid hammering OpenAI
    // and to bound the latency cost of the sweep.
    try {
      const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: stuck } = await supabase
        .from('communications')
        .select('id')
        .eq('communication_type', 'call')
        .eq('transcription_status', 'processing')
        .lt('transcription_updated_at', stuckCutoff)
        .not('recording_url', 'is', null)
        .limit(5);
      if (stuck && stuck.length > 0) {
        console.log(`[twilio-call-history] sweeper re-queuing ${stuck.length} stuck transcription(s)`);
        for (const row of stuck) {
          const work = transcribeCommunication(supabase, row.id, { skipIfPresent: true })
            .then((res) => {
              if (!res.ok) console.error('[twilio-call-history] sweeper retry failed:', res.error, { commId: row.id });
              else console.log('[twilio-call-history] sweeper retry complete', { commId: row.id });
            })
            .catch((err) => console.error('[twilio-call-history] sweeper retry threw:', err, { commId: row.id }));
          if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
            EdgeRuntime.waitUntil(work);
          }
        }
      }
    } catch (sweepErr) {
      // Sweeper must never break the page load — log and move on.
      console.error('[twilio-call-history] sweeper threw (non-fatal):', sweepErr);
    }

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
