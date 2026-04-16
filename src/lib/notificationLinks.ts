/**
 * Canonical URL builder for `notifications.link_url`.
 *
 * Any code inserting into `public.notifications` MUST populate `link_url` via
 * this helper. Keeping the mapping in one place ensures the NotificationBell
 * click-through lands on the correct view for every notification type.
 */

type LinkInput =
  | { type: 'email'; threadId: string }
  | { type: 'lead'; personId: string }
  | { type: 'opportunity' | 'closed'; leadId: string }
  | { type: 'project'; projectId: string }
  | { type: 'system' };

export function buildNotificationLink(input: LinkInput): string | null {
  switch (input.type) {
    case 'email':
      return `/admin/gmail?thread=${encodeURIComponent(input.threadId)}`;
    case 'lead':
      return `/admin/contacts/people/expanded-view/${input.personId}`;
    case 'opportunity':
    case 'closed':
      return `/admin/pipeline/potential/expanded-view/${input.leadId}`;
    case 'project':
      return `/admin/pipeline/projects/expanded-view/${input.projectId}`;
    case 'system':
      return null;
  }
}
