import { Bot, MessageCircle, Zap, CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIMode } from './CLXAssistantHeader';

interface CLXAssistantEmptyStateProps {
  mode: AIMode;
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

const assistPrompts: Record<string, string[]> = {
  pipeline: [
    'Help me follow up with stale leads',
    'Draft emails for leads awaiting documents',
    'Update all discovery leads that are ready',
    'Create check-in tasks for warm opportunities',
  ],
  general: [
    'Help me follow up with a lead',
    'Create tasks for my pending deals',
    'Draft a follow-up email for a client',
    'Plan my outreach for this week',
  ],
  leads: [
    'Help me follow up with this lead',
    'Create a task for lead outreach',
    'Update lead statuses in bulk',
    'Draft an intro email for new leads',
  ],
  tasks: [
    'Help me clear my overdue tasks',
    'Create follow-up tasks for my leads',
    'Reorganize my task priorities',
    'Break down a big task into steps',
  ],
  email: [
    'Draft a follow-up email',
    'Help me respond to this email',
    'Create email templates for common responses',
    'Write a check-in email to a quiet lead',
  ],
  dashboard: [
    'Set up my day with tasks and follow-ups',
    'Help me prioritize my morning workflow',
    'Draft check-in emails for active deals',
    'Plan a focused 90-minute block',
  ],
  calls: [
    'Log notes from my last call',
    'Create follow-up tasks from recent calls',
    'Draft a recap email for a call',
    'Schedule a callback for missed calls',
  ],
  calendar: [
    'Schedule a follow-up meeting',
    'Create tasks from today\'s meetings',
    'Help me prepare for upcoming meetings',
    'Block focus time on my calendar',
  ],
};

const agentPrompts = [
  'Update all stale leads to review status',
  'Create follow-up tasks for all active deals',
  'Log activity on all leads contacted today',
  'Move qualified discovery leads to underwriting',
];

const modeMeta: Record<AIMode, { eyebrow: string; title: string; subtitle: string; icon: typeof MessageCircle; tint: string; iconBg: string }> = {
  chat: {
    eyebrow: 'Chat',
    title: 'How can I help today?',
    subtitle: 'Ask anything about your pipeline, leads, tasks, or calendar. I have read access to your data.',
    icon: MessageCircle,
    tint: 'text-primary',
    iconBg: 'from-primary/15 to-primary/5',
  },
  assist: {
    eyebrow: 'Assist',
    title: 'What should we tackle?',
    subtitle: 'I\'ll propose concrete actions for you to confirm before anything happens.',
    icon: Zap,
    tint: 'text-amber-600 dark:text-amber-400',
    iconBg: 'from-amber-400/15 to-amber-400/5',
  },
  agent: {
    eyebrow: 'Agent',
    title: 'Hand me the work',
    subtitle: "I'll make changes autonomously. Everything is logged and reversible from the AI Changes page.",
    icon: Bot,
    tint: 'text-violet-600 dark:text-violet-400',
    iconBg: 'from-violet-500/15 to-violet-500/5',
  },
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

const CLXAssistantEmptyState = ({ mode, currentPage, suggestedTasks, onSubmit, greetingName }: CLXAssistantEmptyStateProps) => {
  const pageCtx = getPageContext(currentPage);
  const meta = modeMeta[mode];
  const Icon = meta.icon;

  const prompts =
    mode === 'chat'
      ? chatPrompts[pageCtx] || chatPrompts.general
      : mode === 'assist'
      ? assistPrompts[pageCtx] || assistPrompts.general
      : agentPrompts;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-8 pt-10 md:pt-16">
      <div className={cn('mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-sm', meta.iconBg)}>
        <Icon className={cn('h-7 w-7', meta.tint)} strokeWidth={1.75} />
      </div>

      <div className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        {meta.eyebrow} mode
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        {mode === 'chat' ? getGreeting(greetingName) : meta.title}
      </h1>
      <p className="mt-2 max-w-xl text-center text-sm text-muted-foreground">
        {meta.subtitle}
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <PromptCard key={prompt} prompt={prompt} onSubmit={onSubmit} icon={Icon} iconClass={cn(meta.tint, 'opacity-70 group-hover:opacity-100')} />
        ))}
      </div>

      {mode === 'chat' && suggestedTasks.length > 0 && (
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
