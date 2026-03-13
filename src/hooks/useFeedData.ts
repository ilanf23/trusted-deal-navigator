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
  time: string;
  rawDate: Date;
  stage?: string;
  direction?: string;
  /** Source section: 'lead', 'people', 'company' */
  source?: string;
  checklistTitle?: string;
  checklistItems?: FeedChecklistItem[];
  assignedToId: string | null;
  phoneNumber: string | null;
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
        { data: tasks },
        { data: leadActivities },
        { data: people },
        { data: peopleActivities },
        { data: outboundEmails },
        { data: checklists },
        { data: checklistItems },
      ] = await Promise.all([
        // All leads (no pipeline filter — every pipeline)
        supabase
          .from('leads')
          .select('id, name, company_name, status, notes, created_at, updated_at, source, assigned_to, phone')
          .order('updated_at', { ascending: false })
          .limit(200),
        // Team members for name/avatar mapping
        supabase
          .from('team_members')
          .select('id, name, avatar_url'),
        // Communications (calls, emails, SMS)
        supabase
          .from('evan_communications')
          .select('id, communication_type, direction, content, created_at, lead_id, phone_number')
          .order('created_at', { ascending: false })
          .limit(200),
        // Tasks
        supabase
          .from('evan_tasks')
          .select('id, title, created_at, lead_id, assignee_name, status')
          .order('created_at', { ascending: false })
          .limit(100),
        // Lead activities (logged activities from all pipelines)
        supabase
          .from('lead_activities')
          .select('id, activity_type, content, title, created_at, created_by, lead_id')
          .order('created_at', { ascending: false })
          .limit(200),
        // People (contacts)
        supabase
          .from('leads')
          .select('id, name, company_name, assigned_to, created_at, updated_at, notes')
          .order('updated_at', { ascending: false })
          .limit(100),
        // People activities
        supabase
          .from('people_activities')
          .select('id, activity_type, content, title, created_at, person_id')
          .order('created_at', { ascending: false })
          .limit(100),
        // Outbound emails (Gmail sent emails linked to leads)
        supabase
          .from('outbound_emails')
          .select('id, subject, to_email, body_plain, sent_at, created_at, lead_id, user_id, status')
          .eq('status', 'sent')
          .order('sent_at', { ascending: false })
          .limit(200),
        // Checklists linked to activities
        supabase
          .from('lead_checklists')
          .select('id, title, activity_id')
          .not('activity_id', 'is', null),
        // Checklist items
        supabase
          .from('lead_checklist_items')
          .select('id, checklist_id, text, is_checked, position')
          .order('position', { ascending: true }),
      ]);

      // ── Build lookup maps ──
      const teamMap = new Map((teamMembers || []).map(tm => [tm.id, { name: tm.name, avatarUrl: tm.avatar_url }]));
      const teamNameMap = new Map((teamMembers || []).map(tm => [tm.name.toLowerCase(), tm.avatar_url]));
      const leadMap = new Map((leads || []).map(l => [l.id, { name: l.name, company: l.company_name, status: l.status, assignedTo: l.assigned_to, phone: l.phone }]));
      const peopleMap = new Map((people || []).map(p => [p.id, { name: p.name, company: p.company_name, assignedTo: p.assigned_to }]));

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

      // Track lead_activities IDs to deduplicate against lead.notes
      const leadActivityLeadIds = new Set<string>();

      // ── 1. Lead Activities (from lead_activities table — all pipelines) ──
      for (const la of (leadActivities || [])) {
        leadActivityLeadIds.add(la.lead_id);
        const leadInfo = leadMap.get(la.lead_id);
        const creatorInfo = la.created_by ? teamMap.get(la.created_by) : null;
        const actorName = creatorInfo?.name || 'Team';

        let type: FeedActivityType = 'note';
        const at = la.activity_type?.toLowerCase() || '';
        if (at === 'call') type = 'call';
        else if (at === 'email') type = 'email';
        else if (at === 'sms') type = 'sms';
        else if (at === 'task' || at === 'todo') type = 'task_created';
        else if (at === 'stage_change') type = 'stage_change';

        const clData = checklistByActivity.get(la.id);
        activities.push({
          id: `la-${la.id}`,
          type,
          actorName,
          actorInitial: actorName.charAt(0).toUpperCase(),
          actorAvatarUrl: creatorInfo?.avatarUrl || null,
          leadName: leadInfo?.name || 'Unknown',
          leadCompany: leadInfo?.company || null,
          leadId: la.lead_id,
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

      // ── 2. Lead notes (only for leads not already covered by lead_activities) ──
      for (const lead of (leads || [])) {
        if (!lead.notes) continue;
        // Skip if this lead already has entries from lead_activities
        if (leadActivityLeadIds.has(lead.id)) continue;

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
      for (const comm of (comms || [])) {
        const leadInfo = comm.lead_id ? leadMap.get(comm.lead_id) : null;
        const commType = comm.communication_type as string;
        let type: FeedActivityType = 'email';
        if (commType === 'call') type = 'call';
        else if (commType === 'sms') type = 'sms';

        const commActorName = comm.direction === 'outbound' ? 'Evan' : (leadInfo?.name || 'Unknown');
        activities.push({
          id: `comm-${comm.id}`,
          type,
          actorName: commActorName,
          actorInitial: commActorName.charAt(0).toUpperCase(),
          actorAvatarUrl: comm.direction === 'outbound' ? (teamNameMap.get('evan') || null) : null,
          leadName: leadInfo?.name || 'Unknown Contact',
          leadCompany: leadInfo?.company || null,
          leadId: comm.lead_id,
          content: comm.content || `${commType} ${comm.direction}`,
          time: formatTime(comm.created_at),
          rawDate: new Date(comm.created_at),
          direction: comm.direction,
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: comm.phone_number || leadInfo?.phone || null,
        });
      }

      // ── 4. Tasks ──
      for (const task of (tasks || [])) {
        const leadInfo = task.lead_id ? leadMap.get(task.lead_id) : null;
        const taskActorName = task.assignee_name || 'Team';
        activities.push({
          id: `task-${task.id}`,
          type: 'task_created',
          actorName: taskActorName,
          actorInitial: taskActorName.charAt(0).toUpperCase(),
          actorAvatarUrl: teamNameMap.get(taskActorName.toLowerCase()) || null,
          leadName: leadInfo?.name || 'General',
          leadCompany: leadInfo?.company || null,
          leadId: task.lead_id,
          content: task.title,
          time: formatTime(task.created_at),
          rawDate: new Date(task.created_at),
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: leadInfo?.phone || null,
        });
      }

      // ── 5. Outbound Emails (Gmail) ──
      for (const email of (outboundEmails || [])) {
        const leadInfo = email.lead_id ? leadMap.get(email.lead_id) : null;
        const senderInfo = email.user_id ? teamMap.get(email.user_id) : null;
        const actorName = senderInfo?.name || 'Team';
        const sentDate = email.sent_at || email.created_at;
        activities.push({
          id: `oe-${email.id}`,
          type: 'email',
          actorName,
          actorInitial: actorName.charAt(0).toUpperCase(),
          actorAvatarUrl: senderInfo?.avatarUrl || null,
          leadName: leadInfo?.name || email.to_email,
          leadCompany: leadInfo?.company || null,
          leadId: email.lead_id,
          content: email.subject + (email.body_plain ? ` — ${email.body_plain.slice(0, 200)}` : ''),
          time: formatTime(sentDate),
          rawDate: new Date(sentDate),
          direction: 'outbound',
          source: 'lead',
          assignedToId: leadInfo?.assignedTo || null,
          phoneNumber: leadInfo?.phone || null,
        });
      }

      // ── 6. People Activities ──
      for (const pa of (peopleActivities || [])) {
        const personInfo = peopleMap.get(pa.person_id);
        let type: FeedActivityType = 'note';
        const at = pa.activity_type?.toLowerCase() || '';
        if (at === 'call') type = 'call';
        else if (at === 'email') type = 'email';
        else if (at === 'sms') type = 'sms';
        else if (at === 'task' || at === 'todo') type = 'task_created';

        activities.push({
          id: `pa-${pa.id}`,
          type,
          actorName: 'Team',
          actorInitial: 'T',
          actorAvatarUrl: null,
          leadName: personInfo?.name || 'Unknown Contact',
          leadCompany: personInfo?.company || null,
          leadId: null,
          content: pa.content || pa.title || `${pa.activity_type} logged`,
          time: formatTime(pa.created_at),
          rawDate: new Date(pa.created_at),
          source: 'people',
          assignedToId: personInfo?.assignedTo || null,
          phoneNumber: null,
        });
      }

      // ── 7. People with notes (contacts that have notes but no dedicated activities) ──
      const peopleWithActivities = new Set((peopleActivities || []).map(pa => pa.person_id));
      for (const person of (people || [])) {
        if (!person.notes || peopleWithActivities.has(person.id)) continue;
        const assigneeInfo = person.assigned_to ? teamMap.get(person.assigned_to) : null;
        const actorName = assigneeInfo?.name || 'Team';
        activities.push({
          id: `person-note-${person.id}`,
          type: 'note',
          actorName,
          actorInitial: actorName.charAt(0).toUpperCase(),
          actorAvatarUrl: assigneeInfo?.avatarUrl || null,
          leadName: person.name,
          leadCompany: person.company_name,
          leadId: null,
          content: person.notes,
          time: formatTime(person.updated_at),
          rawDate: new Date(person.updated_at),
          source: 'people',
          assignedToId: person.assigned_to || null,
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
