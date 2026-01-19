import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock, FileWarning, AlertTriangle, Calendar } from 'lucide-react';
import { startOfDay, endOfDay, subDays, isToday } from 'date-fns';

interface TodaysPrioritiesProps {
  evanId?: string;
}

export const TodaysPriorities = ({ evanId }: TodaysPrioritiesProps) => {
  const today = new Date();

  const { data: priorities } = useQuery({
    queryKey: ['evan-todays-priorities', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      // Get today's appointments
      const { data: appointments } = await supabase
        .from('evan_appointments')
        .select('*')
        .gte('start_time', startOfDay(today).toISOString())
        .lte('start_time', endOfDay(today).toISOString());

      // Get pending tasks due today or overdue
      const { data: tasks } = await supabase
        .from('evan_tasks')
        .select('*')
        .eq('is_completed', false)
        .lte('due_date', endOfDay(today).toISOString());

      // Get Evan's leads
      const { data: leads } = await supabase
        .from('leads')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId);

      // Calculate priorities
      const followUpsDue = leads?.filter(l => {
        const daysSinceUpdate = Math.floor(
          (today.getTime() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUpdate >= 3 && l.status !== 'funded';
      }).length || 0;

      const docsMissing = leads?.filter(l => 
        l.status === 'document_collection' && 
        !(l as any).lead_responses?.length
      ).length || 0;

      const stuckDeals = leads?.filter(l => {
        const daysSinceUpdate = Math.floor(
          (today.getTime() - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSinceUpdate >= 7 && !['funded', 'discovery'].includes(l.status);
      }).length || 0;

      // Get recent communications to determine calls to make
      const { data: recentCalls } = await supabase
        .from('evan_communications')
        .select('lead_id')
        .eq('communication_type', 'call')
        .gte('created_at', subDays(today, 7).toISOString());

      const leadIdsContacted = new Set(recentCalls?.map(c => c.lead_id));
      const callsToMake = leads?.filter(l => 
        l.status !== 'funded' && 
        !leadIdsContacted.has(l.id)
      ).length || 0;

      return {
        callsToMake,
        followUpsDue,
        docsMissing,
        stuckDeals,
        meetingsToday: appointments?.length || 0,
        tasksDue: tasks?.length || 0,
      };
    },
    enabled: !!evanId,
  });

  const priorityItems = [
    {
      label: 'Calls to Make',
      value: priorities?.callsToMake || 0,
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      urgent: (priorities?.callsToMake || 0) > 5,
    },
    {
      label: 'Follow-ups Due',
      value: priorities?.followUpsDue || 0,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      urgent: (priorities?.followUpsDue || 0) > 3,
    },
    {
      label: 'Docs Missing',
      value: priorities?.docsMissing || 0,
      icon: FileWarning,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      urgent: (priorities?.docsMissing || 0) > 0,
    },
    {
      label: 'Deals Stuck',
      value: priorities?.stuckDeals || 0,
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      urgent: (priorities?.stuckDeals || 0) > 0,
    },
    {
      label: 'Meetings Today',
      value: priorities?.meetingsToday || 0,
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      urgent: false,
    },
  ];

  const totalPriorities = priorityItems.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-gradient-to-br from-card to-card/80 border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-primary" />
            Today's Priorities
          </CardTitle>
          <Badge variant="outline" className={
            totalPriorities > 10 ? 'border-red-500 text-red-500' :
            totalPriorities > 5 ? 'border-amber-500 text-amber-500' :
            'border-green-500 text-green-500'
          }>
            {totalPriorities} items
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {priorityItems.map((item, index) => (
            <div
              key={index}
              className={`relative p-4 rounded-xl ${item.bgColor} border ${
                item.urgent && item.value > 0 ? 'border-red-500/50 animate-pulse' : 'border-transparent'
              } transition-all hover:scale-105 cursor-pointer`}
            >
              {item.urgent && item.value > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full" />
              )}
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
