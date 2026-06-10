import { supabase } from '@/integrations/supabase/client';

/**
 * Push a single appointment to Google Calendar via the `google-calendar-sync`
 * edge function (`syncAppointment` creates or updates the Google event and
 * stamps `google_event_id` / `sync_status` on the row).
 *
 * Best-effort and never throws: if the user has no calendar connected or Google
 * errors, the appointment simply stays `sync_status='pending'` for the manual
 * "Sync to Google" / scheduled `syncAll` to retry later. Callers should not let
 * a sync failure roll back the local save.
 */
export async function syncAppointmentToGoogle(appointmentId: string): Promise<void> {
  try {
    await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'syncAppointment', appointmentId },
    });
  } catch (err) {
    console.warn('Google Calendar push failed; will retry on next full sync:', err);
  }
}

/**
 * Delete a Google Calendar event by its Google event id. Best-effort and never
 * throws. No-op when the appointment was never synced (no google_event_id).
 */
export async function deleteAppointmentFromGoogle(
  googleEventId: string | null | undefined
): Promise<void> {
  if (!googleEventId) return;
  try {
    await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'deleteFromGoogle', googleEventId },
    });
  } catch (err) {
    console.warn('Google Calendar delete failed:', err);
  }
}
