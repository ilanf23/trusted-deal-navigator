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

// Gradient per icon — white icon on gradient bg
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

// Status dot color for pill
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

// Portal badge colors
const PORTAL_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  evan:    { bg: 'bg-indigo-50',  text: 'text-indigo-600',  dot: 'bg-indigo-400'  },
  brad:    { bg: 'bg-blue-50',    text: 'text-blue-600',    dot: 'bg-blue-400'    },
  adam:    { bg: 'bg-violet-50',  text: 'text-violet-600',  dot: 'bg-violet-400'  },
  maura:   { bg: 'bg-pink-50',    text: 'text-pink-600',    dot: 'bg-pink-400'    },
  wendy:   { bg: 'bg-rose-50',    text: 'text-rose-600',    dot: 'bg-rose-400'    },
  shared:  { bg: 'bg-gray-100',   text: 'text-gray-600',    dot: 'bg-gray-400'    },
  partner: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
  client:  { bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400'   },
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
  showFeatures?: boolean;
  onToggleFeatures?: () => void;
}

export default function ModuleCard({ module, features = [], onClick, showFeatures = false, onToggleFeatures }: ModuleCardProps) {
  const [checked, setChecked] = useState<Set<string>>(() =>
    loadChecked(module.id, features.map(f => f.id))
  );
  const [barWidth, setBarWidth] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    setChecked(loadChecked(module.id, features.map(f => f.id)));
  }, [module.id, features.length]);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => {
      const checkedNow = loadChecked(module.id, features.map(f => f.id));
      const pct = features.length > 0 ? Math.round(checkedNow.size / features.length * 100) : 0;
      setBarWidth(pct);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const checkedCount = features.filter(f => checked.has(f.id)).length;
  const featureProgress = features.length > 0 ? Math.round(checkedCount / features.length * 100) : 0;

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

  // Owner initial
  const ownerInitial = module.business_owner ? module.business_owner.charAt(0).toUpperCase() : 'I';

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
      className="rounded-2xl border border-gray-100 bg-white shadow-sm cursor-pointer overflow-hidden transition-all duration-200"
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
            <h3 className="font-semibold text-gray-900 leading-snug text-[15px]">
              {module.name}
            </h3>
            {/* Business owner with avatar */}
            {module.business_owner && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {/* Tiny avatar */}
                <div
                  className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #a855f7)', fontSize: '9px', fontWeight: 700 }}
                >
                  {ownerInitial}
                </div>
                <p className="text-xs text-gray-400 font-medium">{module.business_owner}</p>
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
              <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-0.5 rounded-full">
                <span className={`w-[5px] h-[5px] rounded-full flex-shrink-0 ${statusDot}`} />
                <span className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
                  {STATUS_LABEL[module.status] ?? module.status}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {module.description && (
          <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
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
            <p className="text-[11px] text-gray-400 font-medium mt-1">
              {checkedCount}/{features.length} features · {featureProgress}%
            </p>
          </div>
        )}

        {/* Features section */}
        {features.length > 0 && (
          <div onClick={e => e.stopPropagation()}>
            {/* Minimal text toggle */}
            <button
              className="flex items-center gap-1 text-[12px] text-indigo-500 font-medium hover:text-indigo-700 transition-colors"
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

            {/* Feature list */}
            {showFeatures && (
              <ul className="mt-2">
                {features.map((f, i) => {
                  const isChecked = checked.has(f.id);
                  const isLast = i === features.length - 1;
                  return (
                    <li
                      key={f.id}
                      className={`flex items-center gap-3 py-2 cursor-pointer group/item ${!isLast ? 'border-b border-gray-50' : ''}`}
                      onClick={e => toggleFeature(e, f.id)}
                    >
                      {/* Custom checkbox */}
                      <div
                        className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all duration-150 ${
                          isChecked
                            ? 'bg-indigo-500 border-indigo-500'
                            : 'border-gray-200 group-hover/item:border-indigo-300 bg-white'
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Req ID badge */}
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                        {f.requirement_id}
                      </span>

                      {/* Feature title */}
                      <span
                        className="text-[13px] leading-snug transition-all duration-150 flex-1 min-w-0"
                        style={{
                          color: isChecked ? '#9CA3AF' : '#374151',
                          textDecoration: isChecked ? 'line-through' : 'none',
                        }}
                      >
                        {f.title}
                      </span>
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
