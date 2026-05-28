import { Plus, PanelLeftClose, PanelLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CLXAssistantHeaderProps {
  showHistorySidebar: boolean;
  onToggleHistory: () => void;
  onNewChat: () => void;
}

const CLXAssistantHeader = ({
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
