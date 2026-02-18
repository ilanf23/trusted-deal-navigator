import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronUp,
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3, 
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp, type LucideIcon
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3,
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp,
};

const STATUS_DOT: Record<string, string> = {
  planned:     'bg-slate-400',
  in_progress: 'bg-blue-500',
  in_review:   'bg-amber-500',
  complete:    'bg-green-500',
  on_hold:     'bg-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned', in_progress: 'In Progress', in_review: 'In Review',
  complete: 'Complete', on_hold: 'On Hold',
};

const STATUS_BG: Record<string, string> = {
  planned:     'bg-slate-50 border-slate-200 dark:bg-slate-900/40 dark:border-slate-700',
  in_progress: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800',
  in_review:   'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800',
  complete:    'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
  on_hold:     'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
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

export interface ModuleFeature {
  id: string;
  title: string;
  requirement_id: string;
  status: string;
}

interface ModuleCardProps {
  module: Module;
  features?: ModuleFeature[];
  onClick: (module: Module) => void;
}

export default function ModuleCard({ module, features = [], onClick }: ModuleCardProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const IconComponent = ICON_MAP[module.icon || 'Box'] ?? Box;
  const progress = module.taskCount && module.taskCount > 0
    ? Math.round((module.doneCount ?? 0) / module.taskCount * 100)
    : 0;

  const statusBg = STATUS_BG[module.status] ?? STATUS_BG.planned;
  const statusDot = STATUS_DOT[module.status] ?? STATUS_DOT.planned;

  return (
    <div
      className={`rounded-2xl border cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-card ${statusBg.split(' ').slice(0,1).join(' ')} border-border/60 overflow-hidden group`}
      onClick={() => onClick(module)}
    >
      {/* Top accent bar */}
      <div className={`h-0.5 w-full ${statusDot}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
            <IconComponent className="w-4.5 h-4.5 text-primary" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-foreground leading-snug truncate"
              style={{ fontSize: '17px' }}
            >
              {module.name}
            </h3>
            {module.business_owner && (
              <p className="text-xs text-muted-foreground mt-0.5">{module.business_owner}</p>
            )}
          </div>
          {/* Status pill */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[11px] font-medium text-muted-foreground">
              {STATUS_LABEL[module.status] ?? module.status}
            </span>
          </div>
        </div>

        {/* Description */}
        {module.description && (
          <p
            className="leading-relaxed mb-3 text-muted-foreground"
            style={{ fontSize: '14px', color: 'hsl(var(--muted-foreground))' }}
          >
            {module.description}
          </p>
        )}

        {/* Progress bar */}
        {module.taskCount !== undefined && module.taskCount > 0 && (
          <div className="mb-3 space-y-1">
            <Progress value={progress} className="h-1" />
            <p className="text-[11px] text-muted-foreground">
              {module.doneCount}/{module.taskCount} tasks · {progress}%
            </p>
          </div>
        )}

        {/* Features toggle */}
        {features.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80 transition-colors"
              style={{ color: 'hsl(var(--primary))' }}
              onClick={e => { e.stopPropagation(); setShowFeatures(v => !v); }}
            >
              {showFeatures ? (
                <><ChevronUp className="w-3.5 h-3.5" />Hide features ↑</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" />Show features ↓</>
              )}
              <span className="ml-1 text-muted-foreground font-normal">({features.length})</span>
            </button>

            {showFeatures && (
              <ul className="mt-2.5 space-y-1.5" onClick={e => e.stopPropagation()}>
                {features.map(f => (
                  <li key={f.id} className="flex items-start gap-2">
                    <span className="text-[11px] font-mono text-muted-foreground/60 mt-px w-14 flex-shrink-0">{f.requirement_id}</span>
                    <span
                      className="leading-snug"
                      style={{ fontSize: '13px', color: '#374151' }}
                    >
                      {f.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
