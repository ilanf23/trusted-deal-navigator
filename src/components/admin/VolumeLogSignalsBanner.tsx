import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { VolumeLogSignal } from '@/hooks/useLoanVolumeLog';

interface VolumeLogSignalsBannerProps {
  signals: VolumeLogSignal[];
  compact?: boolean;
}

const severityConfig = {
  critical: {
    icon: AlertCircle,
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    dot: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
};

export function SignalCountBadge({ signals }: { signals: VolumeLogSignal[] }) {
  if (signals.length === 0) return <span className="text-muted-foreground text-xs">—</span>;

  const critical = signals.filter(s => s.severity === 'critical').length;
  const warning = signals.filter(s => s.severity === 'warning').length;
  const info = signals.filter(s => s.severity === 'info').length;

  return (
    <div className="flex items-center gap-1">
      {critical > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-[11px] font-medium text-red-600 dark:text-red-400">{critical}</span>
        </span>
      )}
      {warning > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">{warning}</span>
        </span>
      )}
      {info > 0 && (
        <span className="flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{info}</span>
        </span>
      )}
    </div>
  );
}

export default function VolumeLogSignalsBanner({ signals, compact }: VolumeLogSignalsBannerProps) {
  if (signals.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground">
        <CheckCircle className="w-4 h-4 text-emerald-500" />
        <span className="text-sm">No active signals</span>
      </div>
    );
  }

  // Sort: critical first, then warning, then info
  const sorted = [...signals].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  if (compact) {
    return <SignalCountBadge signals={signals} />;
  }

  return (
    <div className="space-y-1.5">
      {sorted.map((signal, i) => {
        const config = severityConfig[signal.severity] || severityConfig.info;
        const Icon = config.icon;
        return (
          <div
            key={`${signal.type}-${i}`}
            className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border ${config.bg} ${config.border}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${config.text}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[13px] font-medium ${config.text}`}>{signal.title}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.badge}`}>
                  {signal.severity}
                </Badge>
              </div>
              {signal.description && (
                <p className="text-[12px] text-muted-foreground mt-0.5">{signal.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
