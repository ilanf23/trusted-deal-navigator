import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Phone, MessageSquare, Users, CheckCircle, DollarSign } from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

export const EvanMetricsWidget = () => {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);

  const { data: metrics } = useQuery({
    queryKey: ['evan-metrics'],
    queryFn: async () => {
      // Get communications this month
      const { data: monthlyComms } = await supabase
        .from('communications')
        .select('communication_type, direction')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Get communications this week
      const { data: weeklyComms } = await supabase
        .from('communications')
        .select('communication_type')
        .gte('created_at', weekStart.toISOString())
        .lte('created_at', weekEnd.toISOString());

      // Get leads
      const { data: leads } = await supabase
        .from('leads')
        .select('status, created_at');

      // Get tasks completed this month
      const { data: completedTasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('is_completed', true);

      const monthCalls = monthlyComms?.filter(c => c.communication_type === 'call').length || 0;
      const monthSMS = monthlyComms?.filter(c => c.communication_type === 'sms').length || 0;
      const weekTotal = weeklyComms?.length || 0;
      const totalLeads = leads?.length || 0;
      const fundedLeads = leads?.filter(l => l.status === 'won' || l.status === 'funded').length || 0;
      const tasksCompleted = completedTasks?.length || 0;

      return {
        monthCalls,
        monthSMS,
        weekTotal,
        totalLeads,
        fundedLeads,
        tasksCompleted,
        conversionRate: totalLeads > 0 ? Math.round((fundedLeads / totalLeads) * 100) : 0,
      };
    },
  });

  const stats = [
    {
      label: 'Calls This Month',
      value: metrics?.monthCalls || 0,
      icon: Phone,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'SMS This Month',
      value: metrics?.monthSMS || 0,
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Contacts This Week',
      value: metrics?.weekTotal || 0,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      label: 'Total Leads',
      value: metrics?.totalLeads || 0,
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      label: 'Deals Funded',
      value: metrics?.fundedLeads || 0,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Tasks Done',
      value: metrics?.tasksCompleted || 0,
      icon: CheckCircle,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5 text-primary" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="flex flex-col items-center p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center mb-2`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <span className="text-2xl font-bold">{stat.value}</span>
              <span className="text-xs text-muted-foreground text-center">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Conversion Rate */}
        <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Conversion Rate</p>
              <p className="text-xs text-muted-foreground">Leads to Funded Deals</p>
            </div>
            <span className="text-3xl font-bold text-primary">{metrics?.conversionRate || 0}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
