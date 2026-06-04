import { useState } from 'react';
import { History, Loader2, Trash2, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
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
  onDelete: (id: string) => void;
  onNewChat?: () => void;
}

type Bucket = { label: string; items: Conversation[] };

const startOfDay = (d: Date) => {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
};

const groupByDate = (convs: Conversation[]): Bucket[] => {
  const now = new Date();
  const today = startOfDay(now).getTime();
  const yesterday = today - 86_400_000;
  const last7 = today - 7 * 86_400_000;
  const last30 = today - 30 * 86_400_000;

  const buckets: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 days': [],
    'Last 30 days': [],
    Older: [],
  };

  for (const c of convs) {
    const t = new Date(c.updated_at).getTime();
    if (t >= today) buckets.Today.push(c);
    else if (t >= yesterday) buckets.Yesterday.push(c);
    else if (t >= last7) buckets['Last 7 days'].push(c);
    else if (t >= last30) buckets['Last 30 days'].push(c);
    else buckets.Older.push(c);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
};

const CLXAssistantHistory = ({
  conversations,
  isLoading,
  currentConversationId,
  onLoad,
  onDelete,
  onNewChat,
}: CLXAssistantHistoryProps) => {
  const buckets = groupByDate(conversations);
  const [pendingDelete, setPendingDelete] = useState<Conversation | null>(null);

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 264, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex-shrink-0 overflow-hidden border-r bg-muted/30"
    >
      <div className="flex h-full w-[264px] flex-col">
        <div className="px-3 pt-3">
          {onNewChat && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full justify-start gap-2 rounded-xl bg-card text-sm font-medium shadow-sm"
              onClick={onNewChat}
            >
              <Plus className="h-3.5 w-3.5" />
              New chat
            </Button>
          )}
          <div className="mt-4 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            History
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 pb-3 pt-1">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center px-4 text-center">
              <History className="mb-2 h-5 w-5 text-muted-foreground/60" />
              <p className="text-xs text-muted-foreground">No conversations yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">
                Your chats will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {buckets.map((bucket) => (
                <div key={bucket.label}>
                  <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {bucket.label}
                  </div>
                  <div className="space-y-0.5">
                    {bucket.items.map((conv) => {
                      const active = currentConversationId === conv.id;
                      return (
                        <div
                          key={conv.id}
                          onClick={() => onLoad(conv.id)}
                          className={cn(
                            'group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                            active
                              ? 'bg-card shadow-sm ring-1 ring-border'
                              : 'hover:bg-card/60',
                          )}
                        >
                          <MessageSquare
                            className={cn(
                              'h-3.5 w-3.5 shrink-0',
                              active ? 'text-primary' : 'text-muted-foreground/70',
                            )}
                          />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate text-xs',
                              active ? 'font-medium text-foreground' : 'text-foreground/80',
                            )}
                          >
                            {conv.title || 'Untitled'}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(conv);
                            }}
                            aria-label="Delete conversation"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              "{pendingDelete?.title || 'Untitled'}" and all of its messages will be
              permanently deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) onDelete(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.aside>
  );
};

export default CLXAssistantHistory;
