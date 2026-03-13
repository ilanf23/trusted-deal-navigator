import { Bot, MessageCircle, Zap, Plus, PanelLeftClose, PanelLeft, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AIMode = 'chat' | 'assist' | 'agent';

interface CLXAssistantHeaderProps {
  activeMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  showHistorySidebar: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
  onClose: () => void;
}

const modeConfig = {
  chat: { label: 'Chat', icon: MessageCircle, subtitle: 'Ask anything' },
  assist: { label: 'Assist', icon: Zap, subtitle: 'Guided actions' },
  agent: { label: 'Agent', icon: Bot, subtitle: 'Autonomous' },
} as const;

const CLXAssistantHeader = ({
  activeMode,
  onModeChange,
  showHistorySidebar,
  onToggleHistory,
  onNewChat,
  onClose,
}: CLXAssistantHeaderProps) => {
  return (
    <div className="border-b bg-gradient-to-r from-primary/5 to-transparent">
      {/* Top row: branding + actions */}
      <div className="flex items-center justify-between px-4 py-2.5 cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <div className="p-1 text-muted-foreground/50">
            <GripVertical className="h-4 w-4" />
          </div>
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">CLX Assistant</h3>
            <p className="text-[10px] text-muted-foreground">{modeConfig[activeMode].subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat} title="New Chat">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", showHistorySidebar && "bg-muted")}
            onClick={onToggleHistory}
            title="Toggle History"
          >
            {showHistorySidebar ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeft className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="px-4 pb-2">
        <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
          {(Object.keys(modeConfig) as AIMode[]).map((mode) => {
            const config = modeConfig[mode];
            const Icon = config.icon;
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all duration-200",
                  isActive
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CLXAssistantHeader;
