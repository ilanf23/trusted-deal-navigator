import { Bot, MessageCircle, Zap, Plus, PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AIMode = 'chat' | 'assist' | 'agent';

interface CLXAssistantHeaderProps {
  activeMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  showHistorySidebar: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
}

const modeConfig: Record<AIMode, { label: string; icon: typeof MessageCircle; tint: string; ring: string }> = {
  chat: {
    label: 'Chat',
    icon: MessageCircle,
    tint: 'text-primary',
    ring: 'bg-card shadow-sm ring-1 ring-border',
  },
  assist: {
    label: 'Assist',
    icon: Zap,
    tint: 'text-amber-600 dark:text-amber-400',
    ring: 'bg-card shadow-sm ring-1 ring-amber-200/70 dark:ring-amber-500/30',
  },
  agent: {
    label: 'Agent',
    icon: Bot,
    tint: 'text-violet-600 dark:text-violet-400',
    ring: 'bg-card shadow-sm ring-1 ring-violet-200/70 dark:ring-violet-500/30',
  },
};

const CLXAssistantHeader = ({
  activeMode,
  onModeChange,
  showHistorySidebar,
  onToggleHistory,
  onNewChat,
}: CLXAssistantHeaderProps) => {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={onToggleHistory}
          aria-pressed={showHistorySidebar}
          title={showHistorySidebar ? 'Hide history' : 'Show history'}
        >
          {showHistorySidebar ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>

        <div className="flex items-center gap-1 rounded-xl border bg-muted/40 p-1">
          {(Object.keys(modeConfig) as AIMode[]).map((mode) => {
            const cfg = modeConfig[mode];
            const Icon = cfg.icon;
            const active = mode === activeMode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                aria-pressed={active}
                className={cn(
                  'group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  active
                    ? cfg.ring
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 transition-colors',
                    active ? cfg.tint : 'text-muted-foreground group-hover:text-foreground',
                  )}
                  strokeWidth={2}
                />
                <span className={cn(active && 'text-foreground')}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <div className="mr-2 hidden items-center gap-1.5 text-[11px] text-muted-foreground md:flex">
          <Sparkles className="h-3 w-3" />
          <span>CLX Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={onNewChat}
          title="New chat"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New chat</span>
        </Button>
      </div>
    </div>
  );
};

export default CLXAssistantHeader;
