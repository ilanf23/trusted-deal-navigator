import { useState, useEffect } from 'react';
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

function getStorageKey(moduleId: string) {
  return `module-checked-${moduleId}`;
}

function loadChecked(moduleId: string, featureIds: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(moduleId));
    if (!raw) return new Set();
    const parsed: string[] = JSON.parse(raw);
    // only keep IDs that still exist
    return new Set(parsed.filter(id => featureIds.includes(id)));
  } catch {
    return new Set();
  }
}

function saveChecked(moduleId: string, checked: Set<string>) {
  localStorage.setItem(getStorageKey(moduleId), JSON.stringify([...checked]));
}

export default function ModuleCard({ module, features = [], onClick }: ModuleCardProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() =>
    loadChecked(module.id, features.map(f => f.id))
  );

  // Reload checked state when features change
  useEffect(() => {
    setChecked(loadChecked(module.id, features.map(f => f.id)));
  }, [module.id, features.length]);

  const IconComponent = ICON_MAP[module.icon || 'Box'] ?? Box;
  const taskProgress = module.taskCount && module.taskCount > 0
    ? Math.round((module.doneCount ?? 0) / module.taskCount * 100)
    : 0;

  const checkedCount = features.filter(f => checked.has(f.id)).length;
  const featureProgress = features.length > 0 ? Math.round(checkedCount / features.length * 100) : 0;

  const statusDot = STATUS_DOT[module.status] ?? STATUS_DOT.planned;

  const toggleFeature = (e: React.MouseEvent, featureId: string) => {
    e.stopPropagation();
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(featureId)) next.delete(featureId);
      else next.add(featureId);
      saveChecked(module.id, next);
      return next;
    });
  };

  return (
    <div
      className="rounded-2xl border border-border/60 bg-card cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
      style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
      onClick={() => onClick(module)}
    >
      {/* Top accent bar */}
      <div className={`h-0.5 w-full ${statusDot}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <IconComponent className="w-[18px] h-[18px] text-primary" strokeWidth={1.6} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="font-semibold text-foreground leading-snug"
              style={{ fontSize: '17px' }}
            >
              {module.name}
            </h3>
            {module.business_owner && (
              <p className="text-xs text-muted-foreground mt-0.5">{module.business_owner}</p>
            )}
          </div>
          {/* Status pill */}
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              {STATUS_LABEL[module.status] ?? module.status}
            </span>
          </div>
        </div>

        {/* Description */}
        {module.description && (
          <p
            className="leading-relaxed mb-3"
            style={{ fontSize: '14px', color: '#6B7280' }}
          >
            {module.description}
          </p>
        )}

        {/* Task progress bar */}
        {module.taskCount !== undefined && module.taskCount > 0 && (
          <div className="mb-3 space-y-1">
            <Progress value={taskProgress} className="h-1" />
            <p className="text-[11px] text-muted-foreground">
              {module.doneCount}/{module.taskCount} tasks · {taskProgress}%
            </p>
          </div>
        )}

        {/* Features section */}
        {features.length > 0 && (
          <div onClick={e => e.stopPropagation()}>
            {/* Feature progress bar — always visible */}
            <div className="mb-2 space-y-1">
              <div className="w-full bg-muted/50 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${featureProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {checkedCount}/{features.length} features · {featureProgress}%
              </p>
            </div>

            {/* Toggle button */}
            <button
              className="flex items-center gap-1 text-[13px] font-medium text-primary hover:opacity-70 transition-opacity mb-0"
              onClick={e => { e.stopPropagation(); setShowFeatures(v => !v); }}
            >
              {showFeatures ? (
                <><ChevronUp className="w-3.5 h-3.5" />Hide features ↑</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" />Show features ↓</>
              )}
            </button>

            {/* Feature list */}
            {showFeatures && (
              <ul className="mt-2.5 space-y-2">
                {features.map(f => {
                  const isChecked = checked.has(f.id);
                  return (
                    <li
                      key={f.id}
                      className="flex items-start gap-2.5 cursor-pointer group/item"
                      onClick={e => toggleFeature(e, f.id)}
                    >
                      {/* Custom checkbox */}
                      <div
                        className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all duration-150 ${
                          isChecked
                            ? 'bg-primary border-primary'
                            : 'border-border group-hover/item:border-primary/60 bg-background'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex items-start gap-1.5 flex-1 min-w-0">
                        <span className="text-[10.5px] font-mono text-muted-foreground/50 mt-px w-12 flex-shrink-0">{f.requirement_id}</span>
                        <span
                          className="leading-snug transition-all duration-150"
                          style={{
                            fontSize: '13px',
                            color: isChecked ? '#9CA3AF' : '#374151',
                            textDecoration: isChecked ? 'line-through' : 'none',
                          }}
                        >
                          {f.title}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
