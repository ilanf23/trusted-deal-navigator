import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2 } from 'lucide-react';

interface CallsActivityWidgetProps {
  callsData: {
    total: number;
    inbound: number;
    outbound: number;
    totalDuration: number;
    dailyCalls: { day: string; count: number }[];
  };
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
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            Calls This Week
          </CardTitle>
          <Link to="/admin/calls">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View Calls <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2.5 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-1.5 mb-1">
                  <PhoneIncoming className="h-3 w-3 text-green-600" />
                  <span className="text-[10px] text-muted-foreground uppercase">Inbound</span>
                </div>
                <p className="text-lg font-bold">{callsData.inbound}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-1.5 mb-1">
                  <PhoneOutgoing className="h-3 w-3 text-blue-600" />
                  <span className="text-[10px] text-muted-foreground uppercase">Outbound</span>
                </div>
                <p className="text-lg font-bold">{callsData.outbound}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span className="font-medium">{callsData.total} total</span>
              <span>&middot;</span>
              <Clock className="h-3 w-3" />
              <span>{formatDuration(callsData.totalDuration)}</span>
            </div>
            {callsData.dailyCalls.length > 0 && (
              <div className="h-[80px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsData.dailyCalls}>
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => [`${value} calls`, '']}
                      contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                    />
                    <Bar dataKey="count" fill="hsl(217, 91%, 50%)" radius={[3, 3, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
