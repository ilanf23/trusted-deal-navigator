import { useState } from 'react';
import {
  Navigation,
  Mail,
  ArrowUpCircle,
  ListTodo,
  CheckCircle2,
  FileText,
  Activity,
  Loader2,
  Check,
  X,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ActionStatus = 'proposed' | 'executing' | 'completed' | 'dismissed' | 'failed';

export interface ActionProposal {
  id: string;
  type: string;
  label: string;
  status: ActionStatus;
  params: Record<string, string>;
  result?: string;
  changeId?: string;
}

interface ActionCardProps {
  action: ActionProposal;
  onConfirm: (actionId: string) => void;
  onDismiss: (actionId: string) => void;
  onRetry?: (actionId: string) => void;
}

const actionIcons: Record<string, typeof Navigation> = {
  navigate: Navigation,
  draft_email: Mail,
  update_lead: ArrowUpCircle,
  create_task: ListTodo,
  complete_task: CheckCircle2,
  create_note: FileText,
  log_activity: Activity,
};

const ActionCard = ({ action, onConfirm, onDismiss, onRetry }: ActionCardProps) => {
  const Icon = actionIcons[action.type] || Activity;

  return (
    <div
      className={cn(
        "border rounded-lg p-3 my-2 transition-all duration-200",
        action.status === 'proposed' && "border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20",
        action.status === 'executing' && "border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20",
        action.status === 'completed' && "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
        action.status === 'dismissed' && "border-muted bg-muted/30 opacity-60",
        action.status === 'failed' && "border-red-500/30 bg-red-50/50 dark:bg-red-950/20"
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          "p-1.5 rounded-md mt-0.5",
          action.status === 'completed' && "bg-green-100 dark:bg-green-900/40",
          action.status === 'failed' && "bg-red-100 dark:bg-red-900/40",
          action.status === 'executing' && "bg-blue-100 dark:bg-blue-900/40",
          (action.status === 'proposed' || action.status === 'dismissed') && "bg-muted"
        )}>
          {action.status === 'executing' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          ) : action.status === 'completed' ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : action.status === 'failed' ? (
            <X className="h-3.5 w-3.5 text-red-600" />
          ) : (
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">{action.label}</p>
          {action.result && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{action.result}</p>
          )}
        </div>
      </div>

      {action.status === 'proposed' && (
        <div className="flex gap-2 mt-2 ml-8">
          <Button
            size="sm"
            className="h-7 text-xs px-3"
            onClick={() => onConfirm(action.id)}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={() => onDismiss(action.id)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {action.status === 'failed' && onRetry && (
        <div className="flex gap-2 mt-2 ml-8">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={() => onRetry(action.id)}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}
    </div>
  );
};

export default ActionCard;
