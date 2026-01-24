import { differenceInDays } from 'date-fns';
import { Clock, UserCheck, Building2, Users, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WaitingOnBadgeProps {
  waitingOn: 'borrower' | 'lender' | 'internal' | 'none' | null;
  lastActivityDate?: string | null;
  slaThresholdDays?: number;
  onWaitingOnChange: (value: 'borrower' | 'lender' | 'internal' | 'none') => void;
  showDays?: boolean;
  compact?: boolean;
}

export function WaitingOnBadge({
  waitingOn,
  lastActivityDate,
  slaThresholdDays = 3,
  onWaitingOnChange,
  showDays = true,
  compact = false,
}: WaitingOnBadgeProps) {
  const daysSinceActivity = lastActivityDate
    ? differenceInDays(new Date(), new Date(lastActivityDate))
    : 0;
  
  const isOverdue = daysSinceActivity > slaThresholdDays;
  
  const getConfig = () => {
    switch (waitingOn) {
      case 'borrower':
        return {
          icon: UserCheck,
          label: 'Borrower',
          bgColor: isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30',
          textColor: isOverdue ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300',
        };
      case 'lender':
        return {
          icon: Building2,
          label: 'Lender',
          bgColor: isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30',
          textColor: isOverdue ? 'text-red-700 dark:text-red-300' : 'text-purple-700 dark:text-purple-300',
        };
      case 'internal':
        return {
          icon: Users,
          label: 'Internal',
          bgColor: isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-700',
          textColor: isOverdue ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300',
        };
      default:
        return {
          icon: Clock,
          label: 'Set status',
          bgColor: 'bg-slate-100 dark:bg-slate-700',
          textColor: 'text-slate-500 dark:text-slate-400',
        };
    }
  };
  
  const config = getConfig();
  const Icon = config.icon;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
        >
          <Badge 
            variant="secondary"
            className={`${config.bgColor} ${config.textColor} border-0 text-[10px] px-1.5 py-0 h-5 gap-1 cursor-pointer hover:opacity-80 transition-opacity`}
          >
            <Icon className="w-3 h-3" />
            {!compact && <span>{config.label}</span>}
            {showDays && waitingOn && waitingOn !== 'none' && (
              <>
                {isOverdue ? (
                  <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 font-semibold">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    {daysSinceActivity}d
                  </span>
                ) : (
                  <span className="opacity-70">{daysSinceActivity}d</span>
                )}
              </>
            )}
          </Badge>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-40">
        <DropdownMenuItem onClick={() => onWaitingOnChange('borrower')}>
          <UserCheck className="w-4 h-4 mr-2 text-blue-600" />
          Borrower
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWaitingOnChange('lender')}>
          <Building2 className="w-4 h-4 mr-2 text-purple-600" />
          Lender
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWaitingOnChange('internal')}>
          <Users className="w-4 h-4 mr-2 text-slate-600" />
          Internal
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onWaitingOnChange('none')}>
          <Clock className="w-4 h-4 mr-2 text-slate-400" />
          Clear status
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
