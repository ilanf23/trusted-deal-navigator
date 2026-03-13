import { Bot, User, Check, X, Loader2, ExternalLink, Undo2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export interface AgentLogEntry {
  type: 'text' | 'tool_start' | 'tool_result' | 'batch_complete' | 'error';
  content?: string;
  tool?: string;
  description?: string;
  success?: boolean;
  changeId?: string;
  batchId?: string;
  totalChanges?: number;
}

interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  agentLog?: AgentLogEntry[];
  batchId?: string;
  totalChanges?: number;
}

interface AgentMessagesProps {
  messages: AgentMessage[];
  isLoading: boolean;
  userAvatarUrl?: string | null;
  userName?: string;
  onUndoBatch?: (batchId: string) => void;
  onViewChanges?: (batchId: string) => void;
}

const AgentMessages = ({
  messages,
  isLoading,
  userAvatarUrl,
  userName,
  onUndoBatch,
  onViewChanges,
}: AgentMessagesProps) => {
  return (
    <div className="space-y-3">
      {messages.map((msg, i) => (
        <div key={i}>
          <div
            className={cn(
              "flex gap-2",
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="bg-violet-500/10 text-violet-600 text-xs">
                  <Bot className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {msg.role === 'assistant' && msg.agentLog && msg.agentLog.length > 0 ? (
                <div className="space-y-1.5">
                  {msg.agentLog.map((entry, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs">
                      {entry.type === 'text' && (
                        <span className="text-muted-foreground">{entry.content}</span>
                      )}
                      {entry.type === 'tool_start' && (
                        <>
                          <Loader2 className="h-3 w-3 mt-0.5 shrink-0 animate-spin text-violet-500" />
                          <span>{entry.description}</span>
                        </>
                      )}
                      {entry.type === 'tool_result' && (
                        <>
                          {entry.success ? (
                            <Check className="h-3 w-3 mt-0.5 shrink-0 text-green-600" />
                          ) : (
                            <X className="h-3 w-3 mt-0.5 shrink-0 text-red-600" />
                          )}
                          <span>{entry.description}</span>
                        </>
                      )}
                      {entry.type === 'error' && (
                        <>
                          <X className="h-3 w-3 mt-0.5 shrink-0 text-red-600" />
                          <span className="text-red-600">{entry.content}</span>
                        </>
                      )}
                      {entry.type === 'batch_complete' && (
                        <span className="font-medium">
                          Done! Made {entry.totalChanges} change{entry.totalChanges !== 1 ? 's' : ''}.
                        </span>
                      )}
                    </div>
                  ))}
                  {/* Batch actions */}
                  {msg.batchId && msg.totalChanges && msg.totalChanges > 0 && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-border/50">
                      {onViewChanges && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2"
                          onClick={() => onViewChanges(msg.batchId!)}
                        >
                          <ExternalLink className="h-2.5 w-2.5 mr-1" />
                          View changes
                        </Button>
                      )}
                      {onUndoBatch && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                          onClick={() => onUndoBatch(msg.batchId!)}
                        >
                          <Undo2 className="h-2.5 w-2.5 mr-1" />
                          Undo all
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <Avatar className="h-6 w-6 shrink-0">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt={userName || 'User'} className="h-full w-full object-cover" />
                ) : (
                  <AvatarFallback className="bg-muted text-xs">
                    <User className="h-3 w-3" />
                  </AvatarFallback>
                )}
              </Avatar>
            )}
          </div>
        </div>
      ))}
      {isLoading && messages[messages.length - 1]?.content === '' && (
        <div className="flex gap-2">
          <Avatar className="h-6 w-6 shrink-0">
            <AvatarFallback className="bg-violet-500/10 text-violet-600 text-xs">
              <Bot className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <div className="bg-muted rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce [animation-delay:0.1s]" />
              <div className="w-1.5 h-1.5 bg-violet-500/60 rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentMessages;
