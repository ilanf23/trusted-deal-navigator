import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Kanban } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { DbTableBadge } from '@/components/admin/DbTableBadge';

interface PersonalPipelineProps {
  evanId?: string;
}

const stageConfig = [
  { status: 'initial_review', label: 'Initial Review' },
  { status: 'moving_to_underwriting', label: 'Moving to UW' },
  { status: 'onboarding', label: 'Onboarding' },
  { status: 'underwriting', label: 'UW' },
  { status: 'ready_for_wu_approval', label: 'Ready for Approval' },
  { status: 'pre_approval_issued', label: 'Pre-Approval' },
  { status: 'won', label: 'Won' },
];

export const PersonalPipeline = ({ evanId }: PersonalPipelineProps) => {
  const { data: pipelineData } = useQuery({
    queryKey: ['personal-pipeline', evanId],
    queryFn: async () => {
      if (!evanId) return null;

      const { data: leads } = await supabase
        .from('pipeline')
        .select('*, lead_responses(*)')
        .eq('assigned_to', evanId);

      if (!leads) return null;

      const today = new Date();
      const stageData = stageConfig.map(stage => {
        const stageLeads = leads.filter(l => l.status === stage.status);
        
        let totalAmount = 0;
        let totalFees = 0;
        let totalDays = 0;

        stageLeads.forEach(lead => {
          const loanAmount = (lead as any).lead_responses?.[0]?.loan_amount || 250000;
          totalAmount += loanAmount;
          totalFees += loanAmount * 0.01;
          
          const daysInStage = differenceInDays(today, new Date(lead.updated_at));
          totalDays += daysInStage;
        });

        return {
          ...stage,
          count: stageLeads.length,
          amount: totalAmount,
          fees: totalFees,
          avgDays: stageLeads.length > 0 ? Math.round(totalDays / stageLeads.length) : 0,
        };
      });

      const totalDeals = leads.filter(l => l.status !== 'won' && l.status !== 'funded').length;
      const totalValue = stageData.reduce((sum, s) => s.status !== 'won' && s.status !== 'funded' ? sum + s.amount : sum, 0);
      const totalWeightedFees = stageData.reduce((sum, s) => {
        if (s.status === 'won' || s.status === 'funded') return sum;
        const weight = stageConfig.findIndex(c => c.status === s.status) / (stageConfig.length - 1);
        return sum + (s.fees * weight);
      }, 0);

      return {
        stages: stageData,
        totalDeals,
        totalValue,
        totalWeightedFees,
      };
    },
    enabled: !!evanId,
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const maxCount = Math.max(...(pipelineData?.stages.map(s => s.count) || [1]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Kanban className="h-5 w-5 text-muted-foreground" />
            My Pipeline
            <DbTableBadge tables={['leads']} />
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary">
              {pipelineData?.totalDeals || 0} deals
            </Badge>
            <Badge variant="outline">
              {formatCurrency(pipelineData?.totalValue || 0)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pipelineData?.stages.map((stage, index) => (
            <div key={stage.status} className="flex items-center gap-4">
              <div className="w-20 text-xs text-muted-foreground truncate">
                {stage.label}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-8 bg-muted/50 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-primary/20 transition-all duration-500"
                      style={{ width: `${(stage.count / maxCount) * 100}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-between px-3">
                      <span className="text-xs font-medium">
                        {stage.count} deals
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(stage.amount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="w-16 text-right">
                <span className="text-xs text-muted-foreground">
                  {stage.avgDays}d avg
                </span>
              </div>
              <div className="w-20 text-right">
                <span className="text-xs font-medium">
                  {formatCurrency(stage.fees)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <div>
            <p className="text-sm text-muted-foreground">Weighted Pipeline Value</p>
          </div>
          <p className="text-xl font-bold">
            {formatCurrency(pipelineData?.totalWeightedFees || 0)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
