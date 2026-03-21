import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Trophy, Phone, Mail, UserPlus, CheckSquare, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DbTableBadge } from '@/components/admin/DbTableBadge';
import { Loader2 } from 'lucide-react';

interface ScorecardMiniWidgetProps {
  scorecardData: {
    calls: number;
    emails: number;
    newLeads: number;
    tasksDone: number;
    conversions: number;
  };
  isLoading: boolean;
}

const tiles = [
  { key: 'calls' as const, label: 'Calls', icon: Phone, color: 'text-blue-600' },
  { key: 'emails' as const, label: 'Emails', icon: Mail, color: 'text-violet-600' },
  { key: 'newLeads' as const, label: 'New Leads', icon: UserPlus, color: 'text-orange-600' },
  { key: 'tasksDone' as const, label: 'Tasks Done', icon: CheckSquare, color: 'text-green-600' },
  { key: 'conversions' as const, label: 'Conversions', icon: TrendingUp, color: 'text-emerald-600' },
];

export const ScorecardMiniWidget = ({ scorecardData, isLoading }: ScorecardMiniWidgetProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Weekly Scorecard
            <DbTableBadge tables={['leads', 'communications']} />
          </CardTitle>
          <Link to="/admin/scorecard">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View Scorecard <ArrowRight className="h-3 w-3" />
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
          <div className="space-y-2.5">
            {tiles.map(({ key, label, icon: Icon, color }) => (
              <div key={key} className="flex items-center gap-3 p-2 rounded-lg border bg-card">
                <div className={`p-1.5 rounded-md bg-muted/50 ${color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-muted-foreground flex-1">{label}</span>
                <span className="text-lg font-bold">{scorecardData[key]}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
