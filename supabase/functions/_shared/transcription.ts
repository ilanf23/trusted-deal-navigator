import { createClient } from './supabase.ts';

/**
 * Shared transcription pipeline for Twilio recordings.
 *
 * Used by:
 *   - twilio-call-status (background, fire-and-forget via EdgeRuntime.waitUntil)
 *   - retry-call-transcription (foreground, returns transcript to admin)
 *
 * Stages:
 *   1. Fetch the Twilio recording with HTTP Basic auth (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).
 *   2. POST the audio to OpenAI Whisper (whisper-1) for raw transcription (OPENAI_API_KEY).
 *   3. Send raw transcript through Lovable AI Gateway (google/gemini-3-flash-preview)
 *      for speaker-label formatting (LOVABLE_API_KEY). Falls back to the raw
 *      transcript if speaker labeling fails — never blocks transcript persistence.
 *   4. Persist the labeled transcript to communications.transcript.
 */

type SupabaseClient = ReturnType<typeof createClient>;

interface CommunicationLite {
  id: string;
  recording_url: string | null;
  transcript: string | null;
  call_sid: string | null;
  direction: string | null;
  user_id: string | null;
}

export type TranscribeResult =
  | { ok: true; transcript: string; alreadyPresent?: boolean }
  | { ok: false; error: string };

/**
 * Download a Twilio recording (mp3) using the Twilio account's Basic auth header.
 * Twilio recording URLs are private, so unauthenticated GETs return 401.
 */
export async function fetchTwilioRecordingAsBlob(recordingUrl: string): Promise<Blob> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  const basicAuth = btoa(`${accountSid}:${authToken}`);

  let url = recordingUrl;
  if (!url.endsWith('.mp3') && !url.endsWith('.wav')) {
    url = `${url}.mp3`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Basic ${basicAuth}` },
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recording: ${response.status} ${response.statusText}`);
  }

  return await response.blob();
}

/**
 * Send audio through OpenAI Whisper (whisper-1) and return the raw transcript text.
 */
export async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.mp3');
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper transcription failed: ${err}`);
  }

  return (await response.text()).trim();
}

/**
 * Add speaker labels using Lovable AI Gateway (Gemini Flash). On failure,
 * returns the raw transcript so the caller can still persist *something*.
 */
export async function addSpeakerLabels(
  rawTranscript: string,
  direction: string,
  agentName: string,
): Promise<string> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!lovableApiKey) {
    return rawTranscript;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a transcript formatter. Add speaker labels to the following call transcript. The call direction is "${direction}". For inbound calls, the external caller speaks first. For outbound calls, our team member (${agentName}) speaks first. Label speakers as "${agentName}:" and "Caller:" on each line. Return ONLY the labeled transcript, no other text.`,
          },
          { role: 'user', content: rawTranscript },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error('[transcription] speaker labeling failed:', await response.text());
      return rawTranscript;
    }

    const data = await response.json();
    const labeled = data?.choices?.[0]?.message?.content;
    return typeof labeled === 'string' && labeled.trim().length > 0 ? labeled : rawTranscript;
  } catch (err) {
    console.error('[transcription] speaker labeling error:', err);
    return rawTranscript;
  }
}

/**
 * End-to-end orchestrator: pull communication row, run pipeline, persist transcript.
 *
 * Designed to be safe in both foreground (admin retry) and background
 * (Twilio webhook EdgeRuntime.waitUntil) execution. Never throws — always
 * returns a discriminated result the caller can branch on.
 */
export async function transcribeCommunication(
  supabase: SupabaseClient,
  communicationId: string,
  opts: { skipIfPresent?: boolean } = {},
): Promise<TranscribeResult> {
  try {
    const { data, error } = await supabase
      .from('communications')
      .select('id, recording_url, transcript, call_sid, direction, user_id')
      .eq('id', communicationId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: `Communication lookup failed: ${error.message}` };
    }
    if (!data) {
      return { ok: false, error: 'Communication not found' };
    }

    const comm = data as CommunicationLite;

    if (opts.skipIfPresent && comm.transcript && comm.transcript.trim().length > 0) {
      return { ok: true, transcript: comm.transcript, alreadyPresent: true };
    }

    if (!comm.recording_url) {
      return { ok: false, error: 'No recording available for this call' };
    }

    // Resolve direction (fall back to active_calls if missing on communication).
    let direction = comm.direction || 'inbound';
    if ((!comm.direction || comm.direction.length === 0) && comm.call_sid) {
      const { data: activeCall } = await supabase
        .from('active_calls')
        .select('direction')
        .eq('call_sid', comm.call_sid)
        .maybeSingle();
      if (activeCall?.direction) {
        direction = activeCall.direction;
      }
    }

    // Resolve agent display name from the call's owning user.
    let agentName = 'Agent';
    if (comm.user_id) {
      const { data: agent } = await supabase
        .from('users')
        .select('name')
        .eq('id', comm.user_id)
        .maybeSingle();
      if (agent?.name && typeof agent.name === 'string' && agent.name.trim().length > 0) {
        agentName = agent.name;
      }
    }

    const audioBlob = await fetchTwilioRecordingAsBlob(comm.recording_url);
    const rawTranscript = await transcribeWithWhisper(audioBlob);
    const transcript = await addSpeakerLabels(rawTranscript, direction, agentName);

    const { error: updateErr } = await supabase
      .from('communications')
      .update({ transcript })
      .eq('id', comm.id);

    if (updateErr) {
      return { ok: false, error: `Failed to persist transcript: ${updateErr.message}` };
    }

    return { ok: true, transcript };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
