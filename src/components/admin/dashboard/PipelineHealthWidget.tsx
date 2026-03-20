import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

const STAGE_CONFIG: { key: string; label: string; color: string; bg: string; text: string }[] = [
  { key: 'discovery', label: 'Discovery', color: '#3B82F6', bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
  { key: 'pre_qualification', label: 'Pre-Qual', color: '#8B5CF6', bg: 'bg-violet-500/10', text: 'text-violet-600 dark:text-violet-400' },
  { key: 'document_collection', label: 'Docs', color: '#06B6D4', bg: 'bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400' },
  { key: 'underwriting', label: 'Underwriting', color: '#F59E0B', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400' },
  { key: 'approval', label: 'Approval', color: '#10B981', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400' },
];

interface PipelineHealthWidgetProps {
  pipelineData: any[] | undefined;
  formatCurrency: (v: number) => string;
}

export const PipelineHealthWidget = ({ pipelineData, formatCurrency }: PipelineHealthWidgetProps) => {
  const { stages, totalValue, totalDeals } = useMemo(() => {
    if (!pipelineData) return { stages: [], totalValue: 0, totalDeals: 0 };

    const stageMap: Record<string, { count: number; amount: number }> = {};
    let total = 0;

    pipelineData.forEach((lead) => {
      const status = lead.status;
      if (!stageMap[status]) stageMap[status] = { count: 0, amount: 0 };
      stageMap[status].count++;
      const amt = (lead.lead_responses?.[0]?.loan_amount || 0) * 0.01;
      stageMap[status].amount += amt;
      total += amt;
    });

    const maxAmount = Math.max(...Object.values(stageMap).map(s => s.amount), 1);

    const stageList = STAGE_CONFIG
      .filter(s => stageMap[s.key])
      .map(s => ({
        ...s,
        count: stageMap[s.key].count,
        amount: stageMap[s.key].amount,
        pct: Math.max(8, Math.round((stageMap[s.key].amount / maxAmount) * 100)),
      }));

    const deals = stageList.reduce((sum, s) => sum + s.count, 0);
    return { stages: stageList, totalValue: total, totalDeals: deals };
  }, [pipelineData]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Pipeline Health
            <DbTableBadge tables={['leads']} />
          </CardTitle>
          <Link to="/admin/pipeline">
            <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted gap-1">
              View Pipeline <ArrowRight className="h-3 w-3" />
            </Badge>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {stages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No deals in pipeline</div>
        ) : (
          <div className="space-y-2.5">
            {stages.map((stage) => (
              <div key={stage.key} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold text-foreground">{stage.label}</span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {stage.count} deals
                    </span>
                  </div>
                  <span className={`text-xs font-bold ${stage.text}`}>
                    {formatCurrency(stage.amount)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted/80 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${stage.pct}%`, backgroundColor: stage.color }}
                  />
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between pt-3 mt-1 border-t">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Total Pipeline</span>
                <span className="text-xs text-muted-foreground ml-2">{totalDeals} deals</span>
              </div>
              <span className="text-xl font-bold text-foreground">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
