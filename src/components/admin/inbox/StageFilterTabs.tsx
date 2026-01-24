import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Stage {
  id: string;
  label: string;
  count: number;
  color: string;
}

interface StageFilterTabsProps {
  stages: Stage[];
  activeStage: string;
  onStageChange: (stageId: string) => void;
}

export const StageFilterTabs = memo(function StageFilterTabs({
  stages,
  activeStage,
  onStageChange,
}: StageFilterTabsProps) {
  const allCount = stages.reduce((sum, s) => sum + s.count, 0);
  
  return (
    <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <ScrollArea className="w-full">
        <div className="flex gap-0.5 px-4 py-2">
          {/* All tab */}
          <button
            onClick={() => onStageChange('all')}
            className={`
              flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap
              ${activeStage === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }
            `}
          >
            All
            <Badge 
              variant="secondary" 
              className={`
                text-[10px] px-1.5 py-0 h-4 font-medium rounded
                ${activeStage === 'all'
                  ? 'bg-slate-700 text-slate-200 dark:bg-slate-300 dark:text-slate-700'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                }
              `}
            >
              {allCount}
            </Badge>
          </button>
          
          {/* Stage tabs */}
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => onStageChange(stage.id)}
              className={`
                flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap
                ${activeStage === stage.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }
              `}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              {stage.label}
              {stage.count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={`
                    text-[10px] px-1.5 py-0 h-4 font-medium rounded
                    ${activeStage === stage.id
                      ? 'bg-slate-700 text-slate-200 dark:bg-slate-300 dark:text-slate-700'
                      : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }
                  `}
                >
                  {stage.count}
                </Badge>
              )}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
});
