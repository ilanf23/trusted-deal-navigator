import { Bot, History, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface CLXAssistantHistoryProps {
  conversations: Conversation[];
  isLoading: boolean;
  currentConversationId: string | null;
  onLoad: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
}

const CLXAssistantHistory = ({
  conversations,
  isLoading,
  currentConversationId,
  onLoad,
  onDelete,
}: CLXAssistantHistoryProps) => {
  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 200, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="border-r bg-muted/30 overflow-hidden flex-shrink-0"
    >
      <ScrollArea className="h-full">
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1 mb-2">
            <div className="p-1 rounded bg-primary/10">
              <Bot className="h-3 w-3 text-primary" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              History ({conversations.length})
            </p>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center">
              <History className="h-5 w-5 text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">No history</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => onLoad(conv.id)}
                  className={cn(
                    "p-2 rounded-md cursor-pointer hover:bg-muted transition-colors group text-left",
                    currentConversationId === conv.id && "bg-primary/10 border border-primary/20"
                  )}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{conv.title || 'Untitled'}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(conv.updated_at), 'MMM d')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => onDelete(e, conv.id)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.div>
  );
};

export default CLXAssistantHistory;
