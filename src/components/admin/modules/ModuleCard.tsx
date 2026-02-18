import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3, 
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp, type LucideIcon
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3,
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp,
};

const STATUS_STYLES: Record<string, string> = {
  planned:     'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_review:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  complete:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  on_hold:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high:     'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  low:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned', in_progress: 'In Progress', in_review: 'In Review',
  complete: 'Complete', on_hold: 'On Hold',
};

export interface Module {
  id: string;
  name: string;
  description?: string;
  business_owner?: string;
  priority: string;
  status: string;
  icon?: string;
  created_at: string;
  updated_at: string;
  taskCount?: number;
  doneCount?: number;
}

interface ModuleCardProps {
  module: Module;
  onClick: (module: Module) => void;
}

export default function ModuleCard({ module, onClick }: ModuleCardProps) {
  const IconComponent = ICON_MAP[module.icon || 'Box'] ?? Box;
  const progress = module.taskCount && module.taskCount > 0
    ? Math.round((module.doneCount ?? 0) / module.taskCount * 100)
    : 0;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-border/60"
      onClick={() => onClick(module)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <IconComponent className="w-4 h-4 text-primary" strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground leading-tight">{module.name}</h3>
              {module.business_owner && (
                <p className="text-xs text-muted-foreground">{module.business_owner}</p>
              )}
            </div>
          </div>
          <Badge className={`text-[10px] px-1.5 py-0.5 font-medium rounded-sm border-0 ${PRIORITY_STYLES[module.priority]}`}>
            {module.priority}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {module.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {module.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Badge className={`text-[10px] px-1.5 py-0.5 font-medium rounded-sm border-0 ${STATUS_STYLES[module.status]}`}>
            {STATUS_LABEL[module.status] ?? module.status}
          </Badge>
          {module.taskCount !== undefined && module.taskCount > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {module.doneCount}/{module.taskCount} tasks
            </span>
          )}
        </div>

        {module.taskCount !== undefined && module.taskCount > 0 && (
          <div className="space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-right">{progress}% complete</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
