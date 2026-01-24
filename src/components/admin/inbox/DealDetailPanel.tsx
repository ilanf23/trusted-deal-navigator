import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Mail, 
  Phone, 
  Clock, 
  Tag, 
  FileText,
  Building2,
  User,
  DollarSign,
  Target,
  AlertTriangle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DealDetailPanelProps {
  deal: {
    id: string;
    companyName: string;
    contactName: string;
    contactTitle?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    avatarUrl?: string | null;
    stage: string;
    stageLabel: string;
    loanAmount?: number | null;
    purpose?: string | null;
    urgency?: 'low' | 'medium' | 'high';
    urgencyDays?: number;
    confidence?: number;
    source?: string | null;
    lastTouchDate?: string | null;
    tags?: string[];
    notes?: string | null;
    nextAction?: string | null;
  };
  onActionClick: (action: string) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const getUrgencyColor = (urgency: 'low' | 'medium' | 'high') => {
  switch (urgency) {
    case 'high': return 'text-red-600 dark:text-red-400';
    case 'medium': return 'text-amber-600 dark:text-amber-400';
    default: return 'text-green-600 dark:text-green-400';
  }
};

export function DealDetailPanel({ deal, onActionClick }: DealDetailPanelProps) {
  const lastTouchFormatted = useMemo(() => {
    if (!deal.lastTouchDate) return null;
    try {
      return formatDistanceToNow(new Date(deal.lastTouchDate), { addSuffix: true });
    } catch {
      return null;
    }
  }, [deal.lastTouchDate]);

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-6">
        {/* Header */}
        <div>
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Deal Summary
          </p>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight mb-3">
            {deal.companyName}
          </h2>
          
          {/* Stage badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-0 rounded">
              {deal.stage.toUpperCase().replace(/_/g, ' ').slice(0, 3)}
            </Badge>
            <Badge variant="secondary" className="text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-0 rounded">
              {deal.stageLabel}
            </Badge>
          </div>
        </div>
        
        {/* Deal Metrics */}
        <div className="space-y-3">
          {deal.loanAmount && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Loan Amount</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {formatCurrency(deal.loanAmount)}
              </span>
            </div>
          )}
          
          {deal.purpose && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Purpose</span>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 text-right max-w-[160px] truncate">
                {deal.purpose}
              </span>
            </div>
          )}
          
          {deal.urgency && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">Urgency</span>
              <span className={`text-sm font-semibold ${getUrgencyColor(deal.urgency)}`}>
                {deal.urgency.charAt(0).toUpperCase() + deal.urgency.slice(1)}
                {deal.urgencyDays !== undefined && ` - ${deal.urgencyDays} days`}
              </span>
            </div>
          )}
          
          {deal.confidence !== undefined && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Confidence</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {deal.confidence}%
                </span>
              </div>
              <Progress value={deal.confidence} className="h-2" />
            </div>
          )}
        </div>
        
        {/* CTA Button */}
        {deal.nextAction && (
          <Button
            onClick={() => onActionClick(deal.nextAction!)}
            className="w-full h-11 text-sm font-semibold bg-primary hover:bg-primary/90 rounded-lg shadow-sm"
          >
            {deal.nextAction}
          </Button>
        )}
        
        {/* Primary Contact */}
        <div className="pt-2">
          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Primary Contact
          </p>
          
          <div className="flex items-start gap-3 mb-4">
            <Avatar className="w-11 h-11 border border-slate-200 dark:border-slate-700">
              {deal.avatarUrl && <AvatarImage src={deal.avatarUrl} alt={deal.contactName} />}
              <AvatarFallback className="text-sm font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                {deal.contactName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {deal.contactName}
              </p>
              {deal.contactTitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {deal.contactTitle}, {deal.companyName}
                </p>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            {deal.contactEmail && (
              <a 
                href={`mailto:${deal.contactEmail}`}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                {deal.contactEmail}
              </a>
            )}
            
            {deal.contactPhone && (
              <a 
                href={`tel:${deal.contactPhone}`}
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                {deal.contactPhone}
              </a>
            )}
            
            {lastTouchFormatted && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                Last touch: {lastTouchFormatted}
              </div>
            )}
            
            {deal.source && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Tag className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                Source: {deal.source}
              </div>
            )}
          </div>
        </div>
        
        {/* Tags */}
        {deal.tags && deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {deal.tags.map((tag, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 rounded"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Quick Notes */}
        {deal.notes && (
          <div className="pt-2">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-100 dark:border-slate-700">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Quick Notes</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {deal.notes}
              </p>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
