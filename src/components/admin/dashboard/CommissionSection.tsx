import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';

interface CommissionSectionProps {
  calcLoanAmount: string;
  setCalcLoanAmount: (v: string) => void;
  calcExtraDeals: string;
  setCalcExtraDeals: (v: string) => void;
}

export const CommissionSection = ({
  calcLoanAmount,
  setCalcLoanAmount,
  calcExtraDeals,
  setCalcExtraDeals,
}: CommissionSectionProps) => {
  const formatCurrencyFull = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

  const commissionCalc = useMemo(() => {
    const loanAmount = parseFloat(calcLoanAmount) || 0;
    const extraDeals = parseInt(calcExtraDeals) || 0;
    const baseCommission = loanAmount * 0.02;
    const bonusMultiplier = 1 + (extraDeals * 0.10);
    const totalCommission = baseCommission * bonusMultiplier;
    const bonusAmount = totalCommission - baseCommission;

    return { baseCommission, bonusAmount, totalCommission, bonusPercentage: extraDeals * 10 };
  }, [calcLoanAmount, calcExtraDeals]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">Commission Calculator</CardTitle>
            <CardDescription>Estimate your earnings with bonus for extra deals</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="loanAmount">Loan Amount</Label>
              <Input
                id="loanAmount"
                type="number"
                value={calcLoanAmount}
                onChange={(e) => setCalcLoanAmount(e.target.value)}
                placeholder="500000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extraDeals">Extra Deals Closed This Period</Label>
              <Input
                id="extraDeals"
                type="number"
                min="0"
                max="10"
                value={calcExtraDeals}
                onChange={(e) => setCalcExtraDeals(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">+10% commission bonus per extra deal</p>
            </div>
          </div>
          <div className="md:col-span-2 grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-muted/50 text-center">
              <p className="text-xs text-muted-foreground mb-1">Base Commission (2%)</p>
              <p className="text-xl font-bold">{formatCurrencyFull(commissionCalc.baseCommission)}</p>
            </div>
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 text-center">
              <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                Bonus (+{commissionCalc.bonusPercentage}%)
              </p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                +{formatCurrencyFull(commissionCalc.bonusAmount)}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 text-center">
              <p className="text-xs text-primary mb-1">Total Commission</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrencyFull(commissionCalc.totalCommission)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
