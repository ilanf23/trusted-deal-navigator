import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { appendSignature, getSignatureHtml } from '@/lib/email-signature';
import { useTeamMember } from '@/hooks/useTeamMember';
import type { Attachment } from '@/components/admin/GmailComposeDialog';

/**
 * Hook for composing + sending emails from the pipeline expanded views.
 *
 * Encapsulates all compose dialog state (to / subject / body / attachments / sending)
 * and the send flow against the `gmail-write` edge function. Logs the send as an
 * activity on the current deal so it shows up in the timeline immediately.
 *
 * Designed to be used with `<GmailComposeDialog />` — spread the returned
 * `dialogProps` onto the dialog and call `openCompose(...)` from any button.
 */

export type LeadEmailComposeTable = 'potential' | 'underwriting' | 'lender_management' | 'lender_programs';

export interface OpenComposeArgs {
  /** Recipient email address. Required. */
  to: string;
  /** Recipient display name for the dialog header. */
  recipientName?: string;
  /** Optional seed subject. Defaults to empty. */
  subject?: string;
  /** Optional seed body (plain text or HTML). Signature is auto-appended. */
  body?: string;
}

interface UseLeadEmailComposeOptions {
  leadId: string | undefined;
  tableName: LeadEmailComposeTable;
  /** Optional callback fired after a successful send. */
  onSent?: () => void;
}

export function useLeadEmailCompose({ leadId, tableName, onSent }: UseLeadEmailComposeOptions) {
  const queryClient = useQueryClient();
  const { teamMember } = useTeamMember();

  const [isOpen, setIsOpen] = useState(false);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Build a signature HTML string tailored to the current team member, falling
  // back to the existing EVAN signature if we don't have one loaded yet.
  const signatureHtml = teamMember
    ? getSignatureHtml(
        teamMember.name ?? '',
        teamMember.email ?? '',
        teamMember.position ?? 'Associate',
      )
    : undefined;

  const openCompose = useCallback(
    (args: OpenComposeArgs) => {
      setTo(args.to ?? '');
      setRecipientName(args.recipientName ?? '');
      setSubject(args.subject ?? '');
      setBody(appendSignature(args.body ?? '', signatureHtml));
      setIsOpen(true);
    },
    [signatureHtml],
  );

  const closeCompose = useCallback(() => {
    setIsOpen(false);
    setTo('');
    setSubject('');
    setBody('');
    setRecipientName('');
  }, []);

  const sendEmail = useCallback(
    async (attachments: Attachment[]) => {
      if (!to || !to.includes('@')) {
        toast.error('Recipient email is required');
        return;
      }
      if (!subject.trim()) {
        toast.error('Subject is required');
        return;
      }

      setSending(true);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        // Convert attachments to the shape the edge function expects.
        const payloadAttachments = await Promise.all(
          attachments.map(async (att) => ({
            filename: att.name,
            mimeType: att.type,
            content:
              att.base64 ??
              (await fileToBase64(att.file)),
          })),
        );

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-write?action=send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to,
              subject,
              body,
              attachments: payloadAttachments,
            }),
          },
        );

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || 'Failed to send email');
        }

        // Log the outbound email as an activity on the current deal so it
        // appears in the timeline without waiting for the next Gmail sync.
        if (leadId) {
          const plainBody = body
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500);
          await supabase.from('activities').insert({
            entity_id: leadId,
            entity_type: tableName,
            activity_type: 'email',
            title: subject,
            content: plainBody,
            created_by: teamMember?.name ?? 'System',
          });

          // Nudge the deal row so sort-by-recent-activity reflects the send.
          // lender_programs has no `last_activity_at` column, so it's skipped here.
          const updates = { last_activity_at: new Date().toISOString() } as const;
          switch (tableName) {
            case 'potential':
              await supabase.from('potential').update(updates).eq('id', leadId);
              break;
            case 'underwriting':
              await supabase.from('underwriting').update(updates).eq('id', leadId);
              break;
            case 'lender_management':
              await supabase.from('lender_management').update(updates).eq('id', leadId);
              break;
            case 'lender_programs':
              break;
          }
        }

        // Invalidate the email/timeline queries so the new message shows up.
        queryClient.invalidateQueries({ queryKey: ['pipeline-lead-gmail-emails', leadId] });
        queryClient.invalidateQueries({ queryKey: ['underwriting-lead-gmail-emails', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lender-management-lead-gmail-emails', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lender-program-gmail-emails', leadId] });
        queryClient.invalidateQueries({ queryKey: ['lender-program-activities', leadId] });
        queryClient.invalidateQueries({ queryKey: ['activities', tableName, leadId] });

        toast.success('Email sent');
        closeCompose();
        onSent?.();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send email';
        toast.error(message);
      } finally {
        setSending(false);
      }
    },
    [to, subject, body, leadId, tableName, teamMember?.name, queryClient, closeCompose, onSent],
  );

  return {
    openCompose,
    closeCompose,
    sendEmail,
    sending,
    /** Spread these directly into `<GmailComposeDialog>`. */
    dialogProps: {
      isOpen,
      onClose: closeCompose,
      to,
      onToChange: setTo,
      subject,
      onSubjectChange: setSubject,
      body,
      onBodyChange: setBody,
      onSend: sendEmail,
      sending,
      recipientName,
    },
  };
}

/** Convert a File to a raw base64 string (no data: prefix). */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
