import { useState, useEffect, useRef } from 'react';
import { ChevronDown,
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3,
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp, type LucideIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const ICON_MAP: Record<string, LucideIcon> = {
  Box, LayoutDashboard, Mail, Phone, FileText, Users, Kanban, BarChart3,
  Settings, Shield, Bell, Search, Star, Zap, Globe, Database,
  ClipboardList, Bug, Calendar, MessageSquare, TrendingUp,
};

const ICON_GRADIENT: Record<string, string> = {
  Box:             'from-indigo-500 to-indigo-600',
  LayoutDashboard: 'from-blue-500 to-blue-600',
  BarChart3:       'from-violet-500 to-violet-600',
  ClipboardList:   'from-emerald-500 to-emerald-600',
  Mail:            'from-sky-500 to-sky-600',
  Phone:           'from-green-500 to-green-600',
  FileText:        'from-orange-500 to-orange-600',
  Users:           'from-pink-500 to-pink-600',
  Kanban:          'from-purple-500 to-purple-600',
  Settings:        'from-slate-500 to-slate-600',
  Shield:          'from-red-500 to-red-600',
  Bell:            'from-yellow-500 to-yellow-600',
  Star:            'from-amber-500 to-amber-600',
  Zap:             'from-lime-500 to-lime-600',
  Globe:           'from-teal-500 to-teal-600',
  Database:        'from-cyan-500 to-cyan-600',
  Bug:             'from-rose-500 to-rose-600',
  Calendar:        'from-fuchsia-500 to-fuchsia-600',
  MessageSquare:   'from-blue-400 to-blue-500',
  TrendingUp:      'from-emerald-400 to-emerald-500',
  Search:          'from-indigo-400 to-indigo-500',
};

const STATUS_DOT_COLOR: Record<string, string> = {
  planned:     'bg-gray-400',
  in_progress: 'bg-blue-500',
  in_review:   'bg-amber-500',
  complete:    'bg-emerald-500',
  on_hold:     'bg-red-400',
};

const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned', in_progress: 'In Progress', in_review: 'In Review',
  complete: 'Complete', on_hold: 'On Hold',
};

const PORTAL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  evan:    { bg: 'bg-indigo-50 dark:bg-indigo-900/30',  text: 'text-indigo-600 dark:text-indigo-400',  dot: 'bg-indigo-400'  },
  brad:    { bg: 'bg-blue-50 dark:bg-blue-900/30',    text: 'text-blue-600 dark:text-blue-400',    dot: 'bg-blue-400'    },
  adam:    { bg: 'bg-violet-50 dark:bg-violet-900/30',  text: 'text-violet-600 dark:text-violet-400',  dot: 'bg-violet-400'  },
  maura:   { bg: 'bg-pink-50 dark:bg-pink-900/30',    text: 'text-pink-600 dark:text-pink-400',    dot: 'bg-pink-400'    },
  wendy:   { bg: 'bg-rose-50 dark:bg-rose-900/30',    text: 'text-rose-600 dark:text-rose-400',    dot: 'bg-rose-400'    },
  shared:  { bg: 'bg-gray-100 dark:bg-gray-800',   text: 'text-gray-600 dark:text-gray-400',    dot: 'bg-gray-400'    },
  partner: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-400' },
  client:  { bg: 'bg-amber-50 dark:bg-amber-900/30',   text: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-400'   },
};

export interface Module {
  id: string;
  name: string;
  description?: string;
  business_owner?: string;
  priority: string;
  status: string;
  icon?: string;
  portal?: string;
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
  showFeatures?: boolean;
  onToggleFeatures?: () => void;
  onFeatureStatusChange?: (featureId: string, newStatus: string) => void;
}

export default function ModuleCard({
  module,
  features = [],
  onClick,
  showFeatures = false,
  onToggleFeatures,
  onFeatureStatusChange,
}: ModuleCardProps) {
  const [localStatuses, setLocalStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(features.map(f => [f.id, f.status]))
  );
  const [barWidth, setBarWidth] = useState(0);
  const hasAnimated = useRef(false);

  // Sync when features prop changes (e.g. after refetch)
  useEffect(() => {
    setLocalStatuses(Object.fromEntries(features.map(f => [f.id, f.status])));
  }, [features.length, features.map(f => f.status).join(',')]);

  const completedCount = features.filter(f => (localStatuses[f.id] ?? f.status) === 'verified').length;
  const featureProgress = features.length > 0 ? Math.round(completedCount / features.length * 100) : 0;

  // Animate bar on mount
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => setBarWidth(featureProgress), 80);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setBarWidth(featureProgress);
  }, [featureProgress]);

  const iconKey = module.icon || 'Box';
  const IconComponent = ICON_MAP[iconKey] ?? Box;
  const iconGradient = ICON_GRADIENT[iconKey] ?? 'from-indigo-500 to-indigo-600';
  const statusDot = STATUS_DOT_COLOR[module.status] ?? STATUS_DOT_COLOR.planned;
  const portalKey = (module.portal ?? 'evan').toLowerCase();
  const portalStyle = PORTAL_STYLES[portalKey] ?? PORTAL_STYLES.evan;
  const portalLabel = portalKey.charAt(0).toUpperCase() + portalKey.slice(1);
  const ownerInitial = module.business_owner ? module.business_owner.charAt(0).toUpperCase() : 'I';

  const toggleFeature = async (e: React.MouseEvent, feature: ModuleFeature) => {
    e.stopPropagation();
    const currentStatus = localStatuses[feature.id] ?? feature.status;
    const newStatus = currentStatus === 'verified' ? 'draft' : 'verified';

    // Optimistic update
    setLocalStatuses(prev => ({ ...prev, [feature.id]: newStatus }));

    const { error } = await supabase
      .from('business_requirements')
      .update({ status: newStatus })
      .eq('id', feature.id);

    if (error) {
      // Revert on error
      setLocalStatuses(prev => ({ ...prev, [feature.id]: currentStatus }));
      return;
    }

    onFeatureStatusChange?.(feature.id, newStatus);
  };

  return (
    <div
      className="rounded-2xl border border-border bg-card shadow-sm cursor-pointer overflow-hidden transition-all duration-200"
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
      onClick={() => onClick(module)}
    >
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          {/* Gradient icon */}
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm`}>
            <IconComponent className="w-[17px] h-[17px] text-white" strokeWidth={1.8} />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground leading-snug text-[15px]">
              {module.name}
            </h3>
            {module.business_owner && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', fontSize: '9px', fontWeight: 700 }}
                >
                  {ownerInitial}
                </div>
                <p className="text-xs text-muted-foreground font-medium">{module.business_owner}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0 mt-0.5">
            {/* Portal badge */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${portalStyle.bg}`}>
              <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${portalStyle.dot}`} />
              <span className={`text-[10px] font-semibold whitespace-nowrap ${portalStyle.text}`}>
                {portalLabel}
              </span>
            </div>
            {/* Status pill — hidden for 'planned' */}
            {module.status !== 'planned' && (
              <div className="flex items-center gap-1.5 bg-muted px-2 py-0.5 rounded-full">
                <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${statusDot}`} />
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                  {STATUS_LABEL[module.status] ?? module.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {module.description && (
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
            {module.description}
          </p>
        )}

        {/* Animated feature progress bar */}
        {features.length > 0 && (
          <div className="mb-4">
            <div
              className="w-full rounded-full overflow-hidden bg-muted"
              style={{ height: '6px' }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${barWidth}%`,
                  background: featureProgress === 100
                    ? 'linear-gradient(90deg, #10b981, #059669)'
                    : '#6366f1',
                  borderRadius: '9999px',
                  transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-muted-foreground font-medium">
                {completedCount}/{features.length} built · {featureProgress}%
              </p>
              {featureProgress === 100 && (
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                  ✓ Complete
                </span>
              )}
            </div>
          </div>
        )}

        {/* Features section */}
        {features.length > 0 && (
          <div onClick={e => e.stopPropagation()}>
            <button
              className="flex items-center gap-1 text-[12px] text-indigo-500 dark:text-indigo-400 font-medium hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              onClick={e => { e.stopPropagation(); onToggleFeatures?.(); }}
            >
              <span>{showFeatures ? 'Hide features' : 'Show features'}</span>
              <ChevronDown
                className="w-3.5 h-3.5"
                style={{
                  transition: 'transform 0.2s ease',
                  transform: showFeatures ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {showFeatures && (
              <ul className="mt-2">
                {features.map((f, i) => {
                  const currentStatus = localStatuses[f.id] ?? f.status;
                  const isComplete = currentStatus === 'verified';
                  const isLast = i === features.length - 1;
                  return (
                    <li
                      key={f.id}
                      className={`flex items-center gap-3 py-2 cursor-pointer group/item ${!isLast ? 'border-b border-border/30' : ''}`}
                      onClick={e => toggleFeature(e, f)}
                    >
                      {/* Custom checkbox */}
                      <div
                        className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all duration-150 ${
                          isComplete
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-border group-hover/item:border-indigo-300 bg-card'
                        }`}
                      >
                        {isComplete && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Req ID badge */}
                      <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        {f.requirement_id}
                      </span>

                      {/* Feature title */}
                      <span
                        className={`text-[13px] leading-snug transition-all duration-150 flex-1 min-w-0 ${
                          isComplete ? 'text-muted-foreground line-through' : 'text-foreground'
                        }`}
                      >
                        {f.title}
                      </span>

                      {/* Verified badge */}
                      {isComplete && (
                        <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                          Built ✓
                        </span>
                      )}
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
