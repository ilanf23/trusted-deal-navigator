import { useState, useEffect, useRef } from 'react';
import { ChevronDown,
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

function getStorageKey(moduleId: string) {
  return `module-checked-${moduleId}`;
}

function loadChecked(moduleId: string, featureIds: string[]): Set<string> {
  try {
    const raw = localStorage.getItem(getStorageKey(moduleId));
    if (!raw) return new Set();
    const parsed: string[] = JSON.parse(raw);
    return new Set(parsed.filter(id => featureIds.includes(id)));
  } catch {
    return new Set();
  }
}

function saveChecked(moduleId: string, checked: Set<string>) {
  localStorage.setItem(getStorageKey(moduleId), JSON.stringify([...checked]));
}

interface ModuleCardProps {
  module: Module;
  features?: ModuleFeature[];
  onClick: (module: Module) => void;
}

export default function ModuleCard({ module, features = [], onClick }: ModuleCardProps) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(() =>
    loadChecked(module.id, features.map(f => f.id))
  );
  // Animated progress bar width
  const [barWidth, setBarWidth] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    setChecked(loadChecked(module.id, features.map(f => f.id)));
  }, [module.id, features.length]);

  // Animate bar from 0 → completion on mount
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => {
      const checkedNow = loadChecked(module.id, features.map(f => f.id));
      const pct = features.length > 0 ? Math.round(checkedNow.size / features.length * 100) : 0;
      setBarWidth(pct);
    }, 80); // slight delay so animation is visible
    return () => clearTimeout(timer);
  }, []);

  // Keep bar in sync with checkbox changes
  const checkedCount = features.filter(f => checked.has(f.id)).length;
  const featureProgress = features.length > 0 ? Math.round(checkedCount / features.length * 100) : 0;

  useEffect(() => {
    setBarWidth(featureProgress);
  }, [featureProgress]);

  const IconComponent = ICON_MAP[module.icon || 'Box'] ?? Box;
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
      className="rounded-2xl border border-border/60 bg-card cursor-pointer overflow-hidden"
      style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = '0 16px 40px -10px rgba(0,0,0,0.18)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
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
            <h3 className="font-semibold text-foreground leading-snug" style={{ fontSize: '17px' }}>
              {module.name}
            </h3>
            {module.business_owner && (
              <p className="text-xs text-muted-foreground mt-0.5">{module.business_owner}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              {STATUS_LABEL[module.status] ?? module.status}
            </span>
          </div>
        </div>

        {/* Description */}
        {module.description && (
          <p className="leading-relaxed mb-4" style={{ fontSize: '14px', color: '#6B7280' }}>
            {module.description}
          </p>
        )}

        {/* Animated feature progress bar */}
        {features.length > 0 && (
          <div className="mb-4">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: '6px', backgroundColor: '#F3F4F6' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidth}%`,
                  backgroundColor: '#007AFF',
                  borderRadius: '9999px',
                  transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {checkedCount}/{features.length} features · {featureProgress}%
            </p>
          </div>
        )}

        {/* Features section */}
        {features.length > 0 && (
          <div onClick={e => e.stopPropagation()}>
            {/* Pill toggle button */}
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-background hover:bg-muted/60 transition-colors"
              style={{ fontSize: '14px', color: '#374151' }}
              onClick={e => { e.stopPropagation(); setShowFeatures(v => !v); }}
            >
              <span className="font-medium">{showFeatures ? 'Hide features' : 'Show features'}</span>
              <ChevronDown
                className="w-3.5 h-3.5 text-muted-foreground"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: showFeatures ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {/* Feature list */}
            {showFeatures && (
              <ul className="mt-3 space-y-2">
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
                        <span className="text-[10.5px] font-mono text-muted-foreground/50 mt-px w-12 flex-shrink-0">
                          {f.requirement_id}
                        </span>
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
