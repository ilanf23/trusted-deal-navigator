import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { STAGE_LABELS } from '@/constants/appConfig';

export type FeedActivityType = 'lead_created' | 'lead_updated' | 'note' | 'call' | 'email' | 'sms' | 'task_created' | 'stage_change';

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

      // Fetch recent leads with their assignee info
      const { data: leads } = await supabase
        .from('leads')
        .select('id, name, company_name, status, notes, created_at, updated_at, source, assigned_to')
        .order('updated_at', { ascending: false })
        .limit(50);

      // Fetch team members for name mapping
      const { data: teamMembers } = await supabase
        .from('team_members')
        .select('id, name, avatar_url');

      const teamMap = new Map((teamMembers || []).map(tm => [tm.id, { name: tm.name, avatarUrl: tm.avatar_url }]));
      const teamNameMap = new Map((teamMembers || []).map(tm => [tm.name.toLowerCase(), tm.avatar_url]));

      // Fetch recent communications
      const { data: comms } = await supabase
        .from('evan_communications')
        .select('id, communication_type, direction, content, created_at, lead_id, phone_number')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch recent tasks
      const { data: tasks } = await supabase
        .from('evan_tasks')
        .select('id, title, created_at, lead_id, assignee_name, status')
        .order('created_at', { ascending: false })
        .limit(30);

      // Build lead name map for lookups
      const leadMap = new Map((leads || []).map(l => [l.id, { name: l.name, company: l.company_name }]));

      // Add lead activities
      for (const lead of (leads || [])) {
        const assigneeInfo = lead.assigned_to ? teamMap.get(lead.assigned_to) : null;
        const assigneeName = assigneeInfo?.name || 'Team';
        const assigneeAvatar = assigneeInfo?.avatarUrl || null;

        // Lead with notes = note activity
        if (lead.notes) {
          activities.push({
            id: `lead-note-${lead.id}`,
            type: 'note',
            actorName: assigneeName,
            actorInitial: assigneeName.charAt(0).toUpperCase(),
            actorAvatarUrl: assigneeAvatar,
            leadName: lead.name,
            leadCompany: lead.company_name,
            leadId: lead.id,
            content: lead.notes,
            time: formatTime(lead.updated_at),
            rawDate: new Date(lead.updated_at),
            stage: STAGE_LABELS[lead.status] || lead.status,
          });
        }

      }

      // Add communications
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
        });
      }

      // Add tasks
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
        });
      }

      // Sort by date descending
      activities.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());

      return activities;
    },
    refetchInterval: 30000, // Refresh every 30s
  });
};

