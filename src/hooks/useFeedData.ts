import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { STAGE_LABELS } from '@/constants/appConfig';

export type FeedActivityType = 'lead_created' | 'lead_updated' | 'note' | 'call' | 'email' | 'sms' | 'task_created' | 'stage_change';

export interface FeedChecklistItem {
  text: string;
  isChecked: boolean;
}

export interface FeedActivity {
  id: string;
  type: FeedActivityType;
  actorName: string;
  actorInitial: string;
  actorAvatarUrl: string | null;
  leadName: string;
  leadCompany: string | null;
  leadId: string | null;
  content: string;
  subject?: string | null;
  time: string;
  rawDate: Date;
  stage?: string;
  direction?: string;
  /** Original activity_type from the database (e.g. 'annual_follow_up', 'meeting', 'zoom_call') */
  subType?: string;
  /** Source section: 'lead', 'people', 'company' */
  source?: string;
  checklistTitle?: string;
  checklistItems?: FeedChecklistItem[];
  assignedToId: string | null;
  phoneNumber: string | null;
  ccRecipients?: { name: string; email: string }[];
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  toEmail?: string | null;
}

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 24) {
    return format(date, 'h:mm a');
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return formatDistanceToNow(date, { addSuffix: true });
};

/** Parse a CC string like "Name <email>, other@x.com" into structured recipients */
function parseCcRecipients(cc: string | null | undefined): { name: string; email: string }[] {
  if (!cc || !cc.trim()) return [];
  return cc.split(',').map(part => {
    const trimmed = part.trim();
    const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/);
    if (match) {
      return { name: match[1].trim().replace(/^["']|["']$/g, ''), email: match[2].trim() };
    }
    // Plain email address — derive name from local part
    const email = trimmed;
    const local = email.split('@')[0] || '';
    const name = local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { name, email };
  }).filter(r => r.email.includes('@'));
}

export const useFeedData = () => {
  return useQuery({
    queryKey: ['feed-activities'],
    queryFn: async () => {
      const activities: FeedActivity[] = [];

      // ── Parallel fetch all data sources ──
      const [
        { data: leads },
        { data: teamMembers },
        { data: comms },
        { data: leadActivities },
        { data: outboundEmails },
        { data: checklists },
        { data: checklistItems },
      ] = await Promise.all([
        // All deals (no pipeline filter — every pipeline)
        supabase
          .from('potential')
          .select('id, name, company_name, status, notes, created_at, updated_at, source, assigned_to, phone')
          .order('updated_at', { ascending: false })
          .limit(200),
        // Team members for name/avatar mapping
        supabase
          .from('users')
          .select('id, name, avatar_url'),
        // Communications (calls, emails, SMS)
        supabase
          .from('communications')
          .select('id, communication_type, direction, content, created_at, lead_id, phone_number, user_id')
          .order('created_at', { ascending: false })
          .limit(200),
        // Activities (logged activities from all pipelines)
        supabase
          .from('activities')
          .select('id, activity_type, content, title, created_at, created_by, entity_id')
          .order('created_at', { ascending: false })
          .limit(200),
        // Outbound emails (Gmail sent emails linked to leads)
        supabase
          .from('outbound_emails')
          .select('id, subject, to_email, cc_emails, body_plain, sent_at, created_at, lead_id, user_id, status, gmail_thread_id, gmail_message_id')
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(200),
        // Checklists linked to activities
        supabase
          .from('underwriting_checklists')
          .select('id, title, activity_id')
          .not('activity_id', 'is', null),
        // Checklist items
        supabase
          .from('underwriting_checklist_items')
          .select('id, checklist_id, text, is_checked, position')
          .order('position', { ascending: true }),
      ]);

      // ── Build lookup maps ──
      const teamMap = new Map((teamMembers || []).map(tm => [tm.id, { name: tm.name, avatarUrl: tm.avatar_url }]));
      const teamNameMap = new Map((teamMembers || []).map(tm => [tm.name.toLowerCase(), tm.avatar_url]));
      const leadMap = new Map((leads || []).map(l => [l.id, { name: l.name, company: l.company_name, status: l.status, assignedTo: l.assigned_to, phone: l.phone }]));
      // Note: 'leads' above is actually 'pipeline' (deals) data

      // ── Build checklist map: activityId → { title, items[] } ──
      const checklistByActivity = new Map<string, { title: string | null; items: FeedChecklistItem[] }>();
      if (checklists?.length) {
        const itemsByChecklist = new Map<string, FeedChecklistItem[]>();
        for (const item of (checklistItems || [])) {
          const arr = itemsByChecklist.get(item.checklist_id) || [];
          arr.push({ text: item.text, isChecked: item.is_checked ?? false });
          itemsByChecklist.set(item.checklist_id, arr);
        }
        for (const cl of checklists) {
          if (cl.activity_id && itemsByChecklist.has(cl.id)) {
            checklistByActivity.set(cl.activity_id, {
              title: cl.title,
              items: itemsByChecklist.get(cl.id)!,
            });
          }
        }
      }

      // Track activities entity IDs to deduplicate against lead.notes
      const activityEntityIds = new Set<string>();

      // ── 1. Activities (from activities table — all pipelines) ──
      for (const la of (leadActivities || [])) {
        activityEntityIds.add(la.entity_id);
        const leadInfo = leadMap.get(la.entity_id);
        const creatorInfo = la.created_by ? teamMap.get(la.created_by) : null;
        const actorName = creatorInfo?.name || 'Team';

        const at = la.activity_type?.toLowerCase() || '';
        // Skip internal-only activity types (tasks, stage changes)
        if (at === 'task' || at === 'todo' || at === 'stage_change') continue;

        let type: FeedActivityType = 'note';
        if (at === 'call') type = 'call';
        else if (at === 'email') type = 'email';
        else if (at === 'sms') type = 'sms';

        const clData = checklistByActivity.get(la.id);
        activities.push({
          id: `la-${la.id}`,
          type,
          subType: la.activity_type || undefined,
          actorName,
          actorInitial: actorName.charAt(0).toUpperCase(),
          actorAvatarUrl: creatorInfo?.avatarUrl || null,
          leadName: leadInfo?.name || 'Unknown',
          leadCompany: leadInfo?.company || null,
          leadId: la.entity_id,
          content: la.content || la.title || `${la.activity_type} logged`,
          time: formatTime(la.created_at),
          rawDate: new Date(la.created_at),
          stage: leadInfo?.status ? (STAGE_LABELS[leadInfo.status] || leadInfo.status) : undefined,
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: leadInfo?.phone || null,
          ...(clData && {
            checklistTitle: clData.title || undefined,
            checklistItems: clData.items,
          }),
        });
      }

      // ── 2. Deal notes (only for deals not already covered by activities) ──
      for (const lead of (leads || [])) {
        if (!lead.notes) continue;
        // Skip if this deal already has entries from activities
        if (activityEntityIds.has(lead.id)) continue;

        const assigneeInfo = lead.assigned_to ? teamMap.get(lead.assigned_to) : null;
        const assigneeName = assigneeInfo?.name || 'Team';
        activities.push({
          id: `lead-note-${lead.id}`,
          type: 'note',
          actorName: assigneeName,
          actorInitial: assigneeName.charAt(0).toUpperCase(),
          actorAvatarUrl: assigneeInfo?.avatarUrl || null,
          leadName: lead.name,
          leadCompany: lead.company_name,
          leadId: lead.id,
          content: lead.notes,
          time: formatTime(lead.updated_at),
          rawDate: new Date(lead.updated_at),
          stage: STAGE_LABELS[lead.status] || lead.status,
          source: 'lead',
          assignedToId: lead.assigned_to || null,
          phoneNumber: lead.phone || null,
        });
      }

      // ── 3. Communications (calls, emails, SMS) ──
      // Mock subjects for comm-table emails that lack a real subject
      const MOCK_EMAIL_SUBJECTS = [
        'Re: Loan Application Update',
        'Following Up on Our Conversation',
        'Documents Needed for Closing',
        'Updated Term Sheet Attached',
        'Re: Tenant Estoppel Certificates',
        'SBA 7(a) Pre-Qualification',
        'Re: Commercial Mortgage Rate Lock',
        'Due Diligence Checklist',
        'Underwriting Update - Action Required',
        'Re: Partnership Opportunity',
        'Financial Statements Request',
        'Re: Zoning Variance Application',
        'Title Search Results',
        'Re: LOI for Acquisition Financing',
        'Lender Approval - Next Steps',
        'Re: Debt Service Coverage Analysis',
        'Closing Date Confirmation',
        'Re: Borrower Entity Formation Docs',
        'Personal Guarantee Discussion',
        'Re: Loan Covenant Compliance',
      ];
      let mockSubjectIdx = 0;

      for (const comm of (comms || [])) {
        const leadInfo = comm.lead_id ? leadMap.get(comm.lead_id) : null;
        const commType = comm.communication_type as string;
        let type: FeedActivityType = 'email';
        if (commType === 'call') type = 'call';
        else if (commType === 'sms') type = 'sms';

        // Assign a mock subject for emails
        const emailSubject = type === 'email'
          ? MOCK_EMAIL_SUBJECTS[mockSubjectIdx++ % MOCK_EMAIL_SUBJECTS.length]
          : undefined;

        const commActorName = comm.direction === 'outbound'
          ? (comm.user_id ? teamMap.get(comm.user_id)?.name : null) || 'Team'
          : (leadInfo?.name || 'Unknown');
        activities.push({
          id: `comm-${comm.id}`,
          type,
          subType: commType || undefined,
          actorName: commActorName,
          actorInitial: commActorName.charAt(0).toUpperCase(),
          actorAvatarUrl: comm.direction === 'outbound' && comm.user_id ? (teamMap.get(comm.user_id)?.avatarUrl || null) : null,
          leadName: leadInfo?.name || 'Unknown Contact',
          leadCompany: leadInfo?.company || null,
          leadId: comm.lead_id,
          subject: emailSubject || null,
          content: comm.content || `${commType} ${comm.direction}`,
          time: formatTime(comm.created_at),
          rawDate: new Date(comm.created_at),
          direction: comm.direction,
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: comm.phone_number || leadInfo?.phone || null,
        });
      }

      // ── 4. Outbound Emails (Gmail) ──
      for (const email of (outboundEmails || [])) {
        const leadInfo = email.lead_id ? leadMap.get(email.lead_id) : null;
        const senderInfo = email.user_id ? teamMap.get(email.user_id) : null;
        const actorName = senderInfo?.name || 'Team';
        const sentDate = email.sent_at || email.created_at;
        const ccRecipients = parseCcRecipients((email as any).cc_emails);
        activities.push({
          id: `oe-${email.id}`,
          type: 'email',
          subType: 'email',
          actorName,
          actorInitial: actorName.charAt(0).toUpperCase(),
          actorAvatarUrl: senderInfo?.avatarUrl || null,
          leadName: leadInfo?.name || email.to_email,
          leadCompany: leadInfo?.company || null,
          leadId: email.lead_id,
          subject: email.subject || null,
          content: email.body_plain?.slice(0, 300) || '',
          time: formatTime(sentDate),
          rawDate: new Date(sentDate),
          direction: 'outbound',
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: leadInfo?.phone || null,
          ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
          gmailThreadId: email.gmail_thread_id || null,
          gmailMessageId: email.gmail_message_id || null,
          toEmail: email.to_email || null,
        });
      }

      // ── Mock email activities for March 20th ──
      const mar20 = [
        { id: 'mock-email-1', time: '9:15 AM', subject: 'Re: SBA 504 Loan - Final Approval', actor: 'Team', lead: 'Michael Torres', company: 'Torres Holdings LLC', content: 'Hi Michael, great news — we just received final approval from the lender on your SBA 504 loan. The term sheet is attached for your review. Let me know if you have any questions before we move to closing.' },
        { id: 'mock-email-2', time: '10:02 AM', subject: 'Updated Financial Projections Attached', actor: 'Team', lead: 'Sarah Chen', company: 'Granite Management', content: 'Sarah, per our call yesterday, I\'ve attached the updated 3-year financial projections incorporating the revised revenue assumptions. The debt service coverage ratio now comes in at 1.35x which should satisfy the lender\'s requirements.' },
        { id: 'mock-email-3', time: '10:45 AM', subject: 'Re: Bridge Loan for 450 Commerce Blvd', actor: 'Team', lead: 'David Park', company: 'Park Capital Group', content: 'David, I spoke with the bridge lender this morning. They\'re comfortable with the 18-month term and are willing to go up to 80% LTV. I\'ll send over the formal term sheet by end of day tomorrow.' },
        { id: 'mock-email-4', time: '11:30 AM', subject: 'Appraisal Ordered - 1200 Industrial Way', actor: 'Team', lead: 'Angela Cooper', company: 'Cooper Office Partners', content: 'Angela, just a quick update — the appraisal has been ordered for the Industrial Way property. The appraiser is scheduled for next Wednesday. We should have the report back within 10 business days.' },
        { id: 'mock-email-5', time: '1:15 PM', subject: 'Re: Refinance Options - Current Market Rates', actor: 'Team', lead: 'Robert Kim', company: 'Cedarpoint Trust', content: 'Robert, I\'ve put together a comparison of three refinance options based on today\'s rates. The 7-year fixed at 6.25% looks like the strongest fit given your hold period. Happy to walk through the numbers on a call this week.' },
        { id: 'mock-email-6', time: '2:40 PM', subject: 'Environmental Phase I - Clear Report', actor: 'Team', lead: 'Lisa Nakamura', company: 'Sterling Group', content: 'Lisa, we received the Phase I environmental report and it came back clean — no recognized environmental conditions. This clears the last due diligence item. I\'ll update the lender and push for commitment letter this week.' },
        { id: 'mock-email-7', time: '3:20 PM', subject: 'Re: Construction Draw #4 Approved', actor: 'Team', lead: 'James O\'Brien', company: 'Atlantic Development Co', content: 'James, draw #4 for $285,000 has been approved by the lender. Funds should be wired to the title company by Thursday. Please confirm the contractor\'s updated schedule at your convenience.' },
        { id: 'mock-email-8', time: '4:05 PM', subject: 'Insurance Certificate - Action Needed', actor: 'Team', lead: 'Elizabeth Garcia', company: 'Westfield Properties', content: 'Elizabeth, the lender is requesting an updated insurance certificate naming them as loss payee before we can schedule closing. Could you have your broker send this over to me directly? Happy to provide the exact mortgagee clause language.' },
      ];

      for (const mock of mar20) {
        activities.push({
          id: mock.id,
          type: 'email',
          actorName: mock.actor,
          actorInitial: mock.actor.charAt(0).toUpperCase(),
          actorAvatarUrl: teamNameMap.get(mock.actor.toLowerCase()) || null,
          leadName: mock.lead,
          leadCompany: mock.company,
          leadId: null,
          subject: mock.subject,
          content: mock.content,
          time: mock.time,
          rawDate: new Date('2026-03-20T' + (mock.time.includes('PM') ? (parseInt(mock.time) === 12 ? 12 : parseInt(mock.time) + 12) : parseInt(mock.time)).toString().padStart(2, '0') + ':' + mock.time.split(':')[1].slice(0, 2) + ':00'),
          direction: 'outbound',
          source: 'lead',
          assignedToId: null,
          phoneNumber: null,
        });
      }

      // Sort by date descending
      activities.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

      return activities;
    },
    refetchInterval: 30000,
  });
};
