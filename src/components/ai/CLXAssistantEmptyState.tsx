import { Bot, MessageCircle, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AIMode } from './CLXAssistantHeader';

interface CLXAssistantEmptyStateProps {
  mode: AIMode;
  currentPage: string;
  suggestedTasks: Array<{ id: string; title: string; priority: string | null; due_date: string | null }>;
  onSubmit: (text: string) => void;
}

const getPageContext = (path: string): string => {
  if (path.includes('/pipeline')) return 'pipeline';
  if (path.includes('/leads')) return 'leads';
  if (path.includes('/tasks')) return 'tasks';
  if (path.includes('/gmail')) return 'email';
  if (path.includes('/calls')) return 'calls';
  if (path.includes('/calendar')) return 'calendar';
  if (path.includes('/dashboard')) return 'dashboard';
  return 'general';
};

const chatPrompts: Record<string, string[]> = {
  pipeline: [
    "What leads need follow-up today?",
    "Summarize my pipeline status",
    "Which deals are closest to closing?",
  ],
  leads: [
    "Which leads haven't been contacted recently?",
    "Show me high-priority leads",
    "Summarize lead activity this week",
  ],
  tasks: [
    "What are my overdue tasks?",
    "Prioritize my tasks for today",
    "What tasks are due this week?",
  ],
  email: [
    "Any emails that need urgent replies?",
    "Summarize my unread emails",
    "Draft a follow-up email template",
  ],
  general: [
    "What leads need follow-up today?",
    "Summarize my pipeline status",
    "What are my overdue tasks?",
  ],
  dashboard: [
    "Give me a morning briefing",
    "What's my top priority today?",
    "Summarize activity this week",
  ],
  calls: [
    "Summarize my recent calls",
    "Who should I call today?",
    "Any missed calls to return?",
  ],
  calendar: [
    "What meetings do I have today?",
    "Any scheduling conflicts this week?",
    "Suggest meeting times for a client call",
  ],
};

const assistPrompts: Record<string, string[]> = {
  pipeline: [
    "Help me follow up with stale leads",
    "Draft emails for leads awaiting documents",
    "Update all discovery leads that are ready",
  ],
  general: [
    "Help me follow up with a lead",
    "Create tasks for my pending deals",
    "Draft a follow-up email for a client",
  ],
  leads: [
    "Help me follow up with this lead",
    "Create a task for lead outreach",
    "Update lead statuses in bulk",
  ],
  tasks: [
    "Help me clear my overdue tasks",
    "Create follow-up tasks for my leads",
    "Reorganize my task priorities",
  ],
  email: [
    "Draft a follow-up email",
    "Help me respond to this email",
    "Create email templates for common responses",
  ],
  dashboard: [
    "Set up my day with tasks and follow-ups",
    "Help me prioritize my morning workflow",
    "Draft check-in emails for active deals",
  ],
  calls: [
    "Log notes from my last call",
    "Create follow-up tasks from recent calls",
    "Draft a recap email for a call",
  ],
  calendar: [
    "Schedule a follow-up meeting",
    "Create tasks from today's meetings",
    "Help me prepare for upcoming meetings",
  ],
};

const agentPrompts = [
  "Update all stale leads to review status",
  "Create follow-up tasks for all active deals",
  "Log activity on all leads contacted today",
];

const CLXAssistantEmptyState = ({ mode, currentPage, suggestedTasks, onSubmit }: CLXAssistantEmptyStateProps) => {
  const pageCtx = getPageContext(currentPage);

  if (mode === 'chat') {
    const prompts = chatPrompts[pageCtx] || chatPrompts.general;
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <div className="p-3 rounded-full bg-primary/10 mb-3">
          <MessageCircle className="h-6 w-6 text-primary" />
        </div>
        <h4 className="text-sm font-medium mb-1">How can I help?</h4>
        <p className="text-xs text-muted-foreground max-w-[250px] mb-4">
          I have access to your leads, tasks, and pipeline data.
        </p>
        <div className="w-full px-2 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Quick prompts:
            </p>
            <div className="flex flex-col gap-1.5">
              {prompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 px-3 justify-start text-left"
                  onClick={() => onSubmit(prompt)}
                >
                  <span className="truncate">{prompt}</span>
                </Button>
              ))}
            </div>
          </div>
          {suggestedTasks.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Help with your tasks:
              </p>
              <div className="flex flex-col gap-1.5">
                {suggestedTasks.map((task) => (
                  <Button
                    key={task.id}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2 px-3 justify-start text-left"
                    onClick={() => onSubmit(`Help me with this task: "${task.title}"`)}
                  >
                    <div className="flex items-start gap-2 w-full">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                      <span className="truncate">{task.title}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'assist') {
    const prompts = assistPrompts[pageCtx] || assistPrompts.general;
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-4">
        <div className="p-3 rounded-full bg-amber-500/10 mb-3">
          <Zap className="h-6 w-6 text-amber-500" />
        </div>
        <h4 className="text-sm font-medium mb-1">Assist Mode</h4>
        <p className="text-xs text-muted-foreground max-w-[250px] mb-4">
          I'll suggest actions you can confirm before they execute.
        </p>
        <div className="w-full px-2">
          <div className="flex flex-col gap-1.5">
            {prompts.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 px-3 justify-start text-left"
                onClick={() => onSubmit(prompt)}
              >
                <span className="truncate">{prompt}</span>
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Agent mode
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-4">
      <div className="p-3 rounded-full bg-violet-500/10 mb-3">
        <Bot className="h-6 w-6 text-violet-500" />
      </div>
      <h4 className="text-sm font-medium mb-1">Agent Mode</h4>
      <p className="text-xs text-muted-foreground max-w-[250px] mb-4">
        I'll make changes autonomously. All changes are logged and reversible.
      </p>
      <div className="w-full px-2">
        <div className="flex flex-col gap-1.5">
          {agentPrompts.map((prompt) => (
            <Button
              key={prompt}
              variant="outline"
              size="sm"
              className="text-xs h-auto py-2 px-3 justify-start text-left"
              onClick={() => onSubmit(prompt)}
            >
              <span className="truncate">{prompt}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CLXAssistantEmptyState;
