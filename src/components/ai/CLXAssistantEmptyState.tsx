import { MessageCircle, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CLXAssistantEmptyStateProps {
  currentPage: string;
  suggestedTasks: Array<{ id: string; title: string; priority: string | null; due_date: string | null }>;
  onSubmit: (text: string) => void;
  greetingName?: string | null;
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
    'What leads need follow-up today?',
    'Summarize my pipeline status',
    'Which deals are closest to closing?',
    'Find stale opportunities worth re-engaging',
  ],
  leads: [
    "Which leads haven't been contacted recently?",
    'Show me high-priority leads',
    'Summarize lead activity this week',
    'Group my leads by deal stage',
  ],
  tasks: [
    'What are my overdue tasks?',
    'Prioritize my tasks for today',
    'What tasks are due this week?',
    'Suggest tasks I should delegate',
  ],
  email: [
    'Any emails that need urgent replies?',
    'Summarize my unread emails',
    'Draft a follow-up email template',
    'Find threads waiting on me',
  ],
  general: [
    'What leads need follow-up today?',
    'Summarize my pipeline status',
    'What are my overdue tasks?',
    'Give me a quick morning briefing',
  ],
  dashboard: [
    'Give me a morning briefing',
    "What's my top priority today?",
    'Summarize activity this week',
    'Where am I against my targets?',
  ],
  calls: [
    'Summarize my recent calls',
    'Who should I call today?',
    'Any missed calls to return?',
    'Pull notes from yesterday\'s calls',
  ],
  calendar: [
    'What meetings do I have today?',
    'Any scheduling conflicts this week?',
    'Suggest meeting times for a client call',
    'Prep notes for my next meeting',
  ],
};

const getGreeting = (name?: string | null) => {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  const firstName = name?.split(' ')[0];
  return firstName ? `Good ${part}, ${firstName}` : `Good ${part}`;
};

const PromptCard = ({
  prompt,
  onSubmit,
  icon: Icon,
  iconClass,
}: {
  prompt: string;
  onSubmit: (p: string) => void;
  icon?: typeof MessageCircle;
  iconClass?: string;
}) => (
  <button
    type="button"
    onClick={() => onSubmit(prompt)}
    className={cn(
      'group relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-sm transition-all duration-200',
      'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
    )}
  >
    {Icon && (
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0 transition-colors', iconClass ?? 'text-primary/70 group-hover:text-primary')} />
    )}
    <span className="flex-1 leading-snug text-foreground/90">{prompt}</span>
    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
  </button>
);

const CLXAssistantEmptyState = ({ currentPage, suggestedTasks, onSubmit, greetingName }: CLXAssistantEmptyStateProps) => {
  const pageCtx = getPageContext(currentPage);
  const prompts = chatPrompts[pageCtx] || chatPrompts.general;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-8 pt-10 md:pt-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm">
        <MessageCircle className="h-7 w-7 text-primary" strokeWidth={1.75} />
      </div>

      <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        Chat
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        {getGreeting(greetingName)}
      </h1>
      <p className="mt-2 max-w-xl text-center text-sm text-muted-foreground">
        Ask anything about your pipeline, leads, tasks, or calendar. I have read access to your data.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt}
            prompt={prompt}
            onSubmit={onSubmit}
            icon={MessageCircle}
            iconClass="text-primary opacity-70 group-hover:opacity-100"
          />
        ))}
      </div>

      {suggestedTasks.length > 0 && (
        <div className="mt-8 w-full">
          <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
            Help with your tasks
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            {suggestedTasks.map((task) => (
              <PromptCard
                key={task.id}
                prompt={`Help me with this task: "${task.title}"`}
                onSubmit={onSubmit}
                icon={CheckCircle2}
                iconClass="text-emerald-600 dark:text-emerald-400 opacity-80"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CLXAssistantEmptyState;
