import { Phone, Mail, MessageSquare, ArrowRight, Clock, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface TouchpointsData {
  total: number;
  calls: number;
  emails: number;
  texts: number;
  other: number;
  inbound: number;
  outbound: number;
  totalDuration: number;
  dailyTouchpoints: { day: string; calls: number; emails: number; texts: number; total: number }[];
}

interface CallsActivityWidgetProps {
  callsData: TouchpointsData;
  isLoading: boolean;
}

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m`;
};

export const CallsActivityWidget = ({ callsData, isLoading }: CallsActivityWidgetProps) => {
  const metrics = [
    { icon: Phone, label: 'Calls', value: callsData.calls, color: 'text-blue-600 dark:text-blue-400' },
    { icon: Mail, label: 'Emails', value: callsData.emails, color: 'text-amber-600 dark:text-amber-400' },
    { icon: MessageSquare, label: 'Texts', value: callsData.texts, color: 'text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold">Touchpoints This Week</h3>
          <DbTableBadge tables={['communications']} />
          <span className="text-xs text-muted-foreground">{callsData.total} total</span>
        </div>
        <Link to="/admin/calls">
          <span className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer">
            View all <ArrowRight className="h-3 w-3" />
          </span>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Metric pills */}
          <div className="grid grid-cols-3 border-t">
            {metrics.map((m) => (
              <div key={m.label} className="px-4 py-3 flex items-center gap-2 border-r last:border-r-0">
                <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
                <div>
                  <p className={`text-lg font-bold leading-tight ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{m.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Direction + duration row */}
          <div className="flex items-center gap-4 px-5 md:px-6 py-2.5 border-t text-xs text-muted-foreground">
            <span>{callsData.inbound} inbound</span>
            <span>{callsData.outbound} outbound</span>
            {callsData.totalDuration > 0 && (
              <>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(callsData.totalDuration)} talk time
                </span>
              </>
            )}
          </div>

          {/* Daily chart */}
          {callsData.dailyTouchpoints.length > 0 && (
            <div className="px-5 md:px-6 pb-4 pt-1">
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsData.dailyTouchpoints}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="calls" stackId="a" fill="hsl(217, 91%, 60%)" radius={0} barSize={20} />
                    <Bar dataKey="emails" stackId="a" fill="hsl(38, 92%, 50%)" radius={0} barSize={20} />
                    <Bar dataKey="texts" stackId="a" fill="hsl(160, 60%, 45%)" radius={[3, 3, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
