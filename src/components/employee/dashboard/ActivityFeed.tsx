import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Activity, Phone, Mail, FileText, ArrowRight } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

interface ActivityFeedProps {
  evanId?: string;
}

export const ActivityFeed = ({ evanId }: ActivityFeedProps) => {
  const { data: activities } = useQuery({
    queryKey: ['activity-feed', evanId],
    queryFn: async () => {
      if (!evanId) return [];

      // Get recent communications
      const { data: comms } = await supabase
        .from('communications')
        .select('*, leads(name, company_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      // Get recent notes
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent lead status changes (approximated by updated_at)
      const { data: recentLeads } = await supabase
        .from('pipeline')
        .select('id, name, status, updated_at, company_name')
        .eq('assigned_to', evanId)
        .order('updated_at', { ascending: false })
        .limit(5);

      // Combine and sort all activities
      const allActivities: any[] = [];

      comms?.forEach(comm => {
        allActivities.push({
          id: comm.id,
          type: comm.communication_type === 'call' ? 'call' : 'email',
          title: comm.communication_type === 'call' ? 'Phone Call' : 'Message',
          description: (comm as any).leads?.name || comm.phone_number || 'Unknown',
          detail: comm.direction === 'outbound' ? 'Outgoing' : 'Incoming',
          timestamp: new Date(comm.created_at),
          icon: comm.communication_type === 'call' ? Phone : Mail,
        });
      });

      notes?.forEach(note => {
        allActivities.push({
          id: note.id,
          type: 'note',
          title: 'Note Added',
          description: note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''),
          detail: note.is_pinned ? 'Pinned' : '',
          timestamp: new Date(note.created_at),
          icon: FileText,
        });
      });

      recentLeads?.forEach(lead => {
        allActivities.push({
          id: `status-${lead.id}`,
          type: 'status',
          title: 'Status Updated',
          description: lead.name,
          detail: lead.status.replace('_', ' '),
          timestamp: new Date(lead.updated_at),
          icon: ArrowRight,
        });
      });

      // Sort by timestamp descending
      return allActivities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 15);
    },
    enabled: !!evanId,
  });

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5 text-muted-foreground" />
          Activity Feed
          <DbTableBadge tables={['communications', 'notes']} />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[300px] px-6">
          {!activities?.length ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No recent activity
            </p>
          ) : (
            <div className="space-y-1 pb-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="mt-0.5 p-1.5 rounded-full bg-muted">
                    <activity.icon className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{activity.title}</span>
                      {activity.detail && (
                        <Badge variant="secondary" className="text-xs">
                          {activity.detail}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activity.description}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
