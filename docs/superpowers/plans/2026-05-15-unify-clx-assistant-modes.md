# Unify CLX Assistant Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the Chat/Assist/Agent mode picker into a single unified chat that proposes actions inline (today's Assist behavior, always on), with a per-message "Auto-run" toggle on the composer that escalates that single send into autonomous (Agent) execution.

**Architecture:** Client-side only. The two edge functions stay split (`ai-assistant-chat` handles `mode: 'assist'`, `ai-assistant-agent` handles autonomous runs). We remove the mode segmented control; every normal send hits `ai-assistant-chat` in assist mode, and toggling Auto-run for a send routes that one message to `ai-assistant-agent`. State is unified into one `messages: UnifiedMessage[]` array where each message carries a `kind` (`text` | `actions` | `agent_log`) discriminator that controls rendering.

**Tech Stack:** React + TypeScript, Tailwind, Vite, Supabase edge functions, existing `useActionParser` / `useActionExecutor` hooks, framer-motion for the toggle pulse.

**Conventions for this repo:** No automated tests exist (per `CLAUDE.md`). Verification is `npx tsc --noEmit` + `npm run build` + manual smoke test in the dev server. Every task ends with a typecheck + commit. No "TDD" steps because there's no test runner.

---

## File Structure

**Create:**
- `src/components/ai/types.ts` — `UnifiedMessage` discriminated union + `AgentLogEntry` re-export
- `src/components/ai/modes/UnifiedMessages.tsx` — single renderer for all three message kinds (per-message switch on `kind`)
- `src/components/ai/AutoRunToggle.tsx` — small pill toggle component used inside the composer

**Modify:**
- `src/components/ai/CLXAssistant.tsx` — collapse to one `messages` array + one `handleSubmit({ autoRun })`; drop `assistMessages` / `agentMessages` state and the three separate submit handlers
- `src/components/ai/CLXAssistantHeader.tsx` — remove segmented mode switcher; keep history toggle + wordmark + new chat button
- `src/components/ai/CLXAssistantInput.tsx` — add `autoRun` + `onAutoRunChange` props; render `AutoRunToggle` left of send; expose `autoRun` state to parent so the parent decides routing; remove `mode` prop
- `src/components/ai/CLXAssistantEmptyState.tsx` — collapse three mode variants into one unified empty state; add small explainer chip about Auto-run; remove `mode` prop

**Delete (after migration confirmed working):**
- `src/components/ai/modes/ChatMessages.tsx`
- `src/components/ai/modes/AssistMessages.tsx`
- `src/components/ai/modes/AgentMessages.tsx`

**Unchanged (verify no callers break):**
- `src/hooks/useActionParser.ts`, `src/hooks/useActionExecutor.ts` — keep as-is, called by the new unified handler
- `src/lib/aiAssistantRouter.ts` — still routes by `body.action`
- `src/contexts/AIAssistantContext.tsx` — DB-persisted shape stays `{ role, content }`; the rich `UnifiedMessage` extras (actions, agent log) are ephemeral client-state only
- `src/components/ai/actions/ActionCard.tsx` — still used by the `actions` kind
- `supabase/functions/ai-assistant-chat/index.ts`, `supabase/functions/ai-assistant-agent/index.ts` — no backend changes
- `src/pages/admin/AIAssistant.tsx` — still imports `CLXAssistant` (no signature change)
- `src/App.tsx` — no change

**Key invariant:** The DB schema (`ai_conversation_messages`) only stores `{ role, content }`. Action proposals and agent logs are ephemeral and live only in the current session's client state. Loading an old conversation hydrates every message as `kind: 'text'`.

---

## Task 1: Define unified message types

**Files:**
- Create: `src/components/ai/types.ts`

- [ ] **Step 1: Create the types module**

Create `src/components/ai/types.ts`:

```ts
import type { ActionProposal } from './actions/ActionCard';

export type AgentLogEntry =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; tool: string; description: string }
  | { type: 'tool_result'; success: boolean; description: string; changeId?: string }
  | { type: 'batch_complete'; batchId?: string; totalChanges?: number }
  | { type: 'error'; content: string };

interface BaseMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface TextMessage extends BaseMessage {
  kind: 'text';
}

export interface ActionsMessage extends BaseMessage {
  kind: 'actions';
  actions: ActionProposal[];
}

export interface AgentLogMessage extends BaseMessage {
  kind: 'agent_log';
  agentLog: AgentLogEntry[];
  batchId?: string;
  totalChanges?: number;
}

export type UnifiedMessage = TextMessage | ActionsMessage | AgentLogMessage;

/**
 * Strip rich metadata before saving to DB. The persisted shape is
 * just `{ role, content }` (per `ai_conversation_messages` schema).
 * For agent_log messages we serialize the log summary as plain text so
 * reload still shows something useful even though tool buttons are gone.
 */
export const toPersistedMessage = (msg: UnifiedMessage): { role: 'user' | 'assistant'; content: string } => {
  if (msg.kind === 'agent_log') {
    const summary = msg.agentLog
      .map((e) => {
        if (e.type === 'text') return e.content;
        if (e.type === 'tool_result') return `• ${e.description}`;
        if (e.type === 'error') return `Error: ${e.content}`;
        return '';
      })
      .filter(Boolean)
      .join('\n');
    return { role: msg.role, content: summary || msg.content };
  }
  return { role: msg.role, content: msg.content };
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit (no errors). The file is self-contained so this passes as long as imports resolve.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/types.ts
git commit -m "feat(ai-assistant): add UnifiedMessage discriminated union"
```

---

## Task 2: Build the AutoRunToggle component

**Files:**
- Create: `src/components/ai/AutoRunToggle.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ai/AutoRunToggle.tsx`:

```tsx
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AutoRunToggleProps {
  active: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}

const AutoRunToggle = ({ active, onChange, disabled }: AutoRunToggleProps) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label="Auto-run: let the assistant make changes autonomously"
      disabled={disabled}
      onClick={() => onChange(!active)}
      title={
        active
          ? 'Auto-run on — the assistant will make changes and you can undo them.'
          : 'Auto-run off — the assistant will propose actions for you to confirm.'
      }
      className={cn(
        'group flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-medium transition-all duration-200',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active
          ? 'bg-violet-500/10 text-violet-700 ring-1 ring-violet-400/40 dark:text-violet-300 dark:ring-violet-500/40'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Zap
        className={cn('h-3.5 w-3.5 transition-transform', active && 'fill-current')}
        strokeWidth={2}
      />
      <span className="hidden sm:inline">Auto-run</span>
    </button>
  );
};

export default AutoRunToggle;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/AutoRunToggle.tsx
git commit -m "feat(ai-assistant): add AutoRunToggle composer pill"
```

---

## Task 3: Build the unified message renderer

This task folds the three existing mode renderers (`ChatMessages`, `AssistMessages`, `AgentMessages`) into one component that switches per-message on `kind`. We do NOT delete the old files yet — that comes after we cut over consumers.

**Files:**
- Create: `src/components/ai/modes/UnifiedMessages.tsx`

- [ ] **Step 1: Inspect the existing renderers**

Read these three files to copy their exact rendering logic into `UnifiedMessages`:

```bash
cat src/components/ai/modes/ChatMessages.tsx
cat src/components/ai/modes/AssistMessages.tsx
cat src/components/ai/modes/AgentMessages.tsx
```

You're going to merge the rendering branches. **Do not invent new visuals** — the three modes already have shipped UI; preserve it per `kind`.

- [ ] **Step 2: Write the unified renderer**

Create `src/components/ai/modes/UnifiedMessages.tsx`:

```tsx
import { Bot, User, CheckCircle2, AlertCircle, Loader2, Undo2, ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import ActionCard from '../actions/ActionCard';
import type { UnifiedMessage, AgentLogEntry } from '../types';

interface UnifiedMessagesProps {
  messages: UnifiedMessage[];
  isLoading: boolean;
  userAvatarUrl?: string | null;
  userName?: string;
  onConfirmAction: (actionId: string) => void;
  onDismissAction: (actionId: string) => void;
  onUndoBatch: (batchId: string) => void;
  onViewChanges: (batchId: string) => void;
}

const AssistantAvatar = () => (
  <Avatar className="h-7 w-7 shrink-0 ring-1 ring-primary/15">
    <AvatarFallback className="bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
      <Bot className="h-3.5 w-3.5" />
    </AvatarFallback>
  </Avatar>
);

const UserAvatar = ({ url, name }: { url?: string | null; name?: string }) => (
  <Avatar className="h-7 w-7 shrink-0">
    {url ? (
      <img src={url} alt={name || 'You'} className="h-full w-full object-cover" />
    ) : (
      <AvatarFallback className="bg-muted text-foreground/70">
        <User className="h-3.5 w-3.5" />
      </AvatarFallback>
    )}
  </Avatar>
);

const TypingDots = () => (
  <div className="flex items-center gap-1 py-2">
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:120ms]" />
    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:240ms]" />
  </div>
);

const AgentLogLine = ({ entry }: { entry: AgentLogEntry }) => {
  if (entry.type === 'text') {
    return <p className="text-sm text-muted-foreground">{entry.content}</p>;
  }
  if (entry.type === 'tool_start') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
        <span>{entry.description}</span>
      </div>
    );
  }
  if (entry.type === 'tool_result') {
    return (
      <div className="flex items-start gap-2 text-sm">
        {entry.success ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
        ) : (
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        )}
        <span className={cn(entry.success ? 'text-foreground/90' : 'text-destructive')}>
          {entry.description}
        </span>
      </div>
    );
  }
  if (entry.type === 'error') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{entry.content}</span>
      </div>
    );
  }
  return null;
};

const UnifiedMessages = ({
  messages,
  isLoading,
  userAvatarUrl,
  userName,
  onConfirmAction,
  onDismissAction,
  onUndoBatch,
  onViewChanges,
}: UnifiedMessagesProps) => {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
      {messages.map((msg, i) => {
        const isUser = msg.role === 'user';
        const isLastAssistant = !isUser && i === messages.length - 1;
        const showTyping = isLastAssistant && isLoading && msg.content === '' && msg.kind === 'text';

        return (
          <div
            key={i}
            className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
          >
            {isUser ? <UserAvatar url={userAvatarUrl} name={userName} /> : <AssistantAvatar />}
            <div className={cn('min-w-0 flex-1', isUser && 'flex justify-end')}>
              {isUser ? (
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                </div>
              ) : (
                <div className="space-y-3 pt-0.5">
                  {/* Assistant text/markdown (for text + actions kinds) */}
                  {msg.kind !== 'agent_log' && (
                    showTyping ? (
                      <TypingDots />
                    ) : msg.content ? (
                      <div className="prose prose-sm max-w-none break-words text-foreground dark:prose-invert prose-p:my-2 prose-p:leading-relaxed prose-pre:my-3 prose-pre:rounded-lg prose-pre:bg-muted prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-headings:mt-4 prose-headings:mb-2">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : null
                  )}

                  {/* Action cards (assist kind) */}
                  {msg.kind === 'actions' && msg.actions.length > 0 && (
                    <div className="space-y-2">
                      {msg.actions.map((action) => (
                        <ActionCard
                          key={action.id}
                          action={action}
                          onConfirm={() => onConfirmAction(action.id)}
                          onDismiss={() => onDismissAction(action.id)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Agent live log (agent_log kind) */}
                  {msg.kind === 'agent_log' && (
                    <div className="rounded-xl border border-violet-200/60 bg-violet-50/40 p-3 dark:border-violet-500/20 dark:bg-violet-950/20">
                      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-violet-700 dark:text-violet-300">
                        <Bot className="h-3 w-3" />
                        Auto-run
                      </div>
                      <div className="space-y-1.5">
                        {msg.agentLog.map((entry, idx) => (
                          <AgentLogLine key={idx} entry={entry} />
                        ))}
                      </div>
                      {msg.batchId && (msg.totalChanges ?? 0) > 0 && (
                        <div className="mt-3 flex items-center gap-2 border-t border-violet-200/60 pt-3 dark:border-violet-500/20">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => onUndoBatch(msg.batchId!)}
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            Undo {msg.totalChanges} change{msg.totalChanges === 1 ? '' : 's'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => onViewChanges(msg.batchId!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            View details
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UnifiedMessages;
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit. (`ActionCard` is imported from `../actions/ActionCard` and we re-use its existing `ActionProposal` type via `types.ts`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/modes/UnifiedMessages.tsx
git commit -m "feat(ai-assistant): add UnifiedMessages renderer (text + actions + agent log)"
```

---

## Task 4: Rewrite the composer to expose Auto-run

**Files:**
- Modify: `src/components/ai/CLXAssistantInput.tsx`

- [ ] **Step 1: Replace the whole file**

Overwrite `src/components/ai/CLXAssistantInput.tsx` with:

```tsx
import { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, FileText, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import AutoRunToggle from './AutoRunToggle';

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

interface CLXAssistantInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  uploadedFile: UploadedFile | null;
  onFileUpload: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  autoRun: boolean;
  onAutoRunChange: (next: boolean) => void;
}

const PLACEHOLDER = 'Ask anything — or describe what to do. Toggle Auto-run for autonomous execution.';

const CLXAssistantInput = ({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  uploadedFile,
  onFileUpload,
  onRemoveFile,
  inputRef,
  autoRun,
  onAutoRunChange,
}: CLXAssistantInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(el.scrollHeight, 200);
    el.style.height = `${next}px`;
  }, [input, inputRef]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      onFileUpload({ name: file.name, type: file.type, content: base64 });
      toast.success(`Attached: ${file.name}`);
    };
    reader.onerror = () => toast.error('Failed to read file');
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (input.trim() || uploadedFile)) onSubmit();
    }
  };

  const canSubmit = (input.trim().length > 0 || !!uploadedFile) && !isLoading;
  const focusRingClass = autoRun
    ? 'focus-within:ring-violet-400/30 focus-within:border-violet-400/50'
    : 'focus-within:ring-primary/30 focus-within:border-primary/40';

  return (
    <div className="px-4 pb-4 pt-2 md:px-6 md:pb-6">
      <div className="mx-auto max-w-3xl">
        {uploadedFile && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs shadow-sm">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="max-w-[240px] truncate font-medium">{uploadedFile.name}</span>
            <button
              type="button"
              onClick={onRemoveFile}
              className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Remove attachment"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onSubmit();
          }}
          className={cn(
            'group relative flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm transition-all duration-200',
            'ring-1 ring-transparent focus-within:shadow-md focus-within:ring-2',
            focusRingClass,
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-xl text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach PDF"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDER}
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 outline-none',
              'placeholder:text-muted-foreground/70 disabled:opacity-60',
              'max-h-[200px]',
            )}
          />

          <AutoRunToggle active={autoRun} onChange={onAutoRunChange} disabled={isLoading} />

          {isLoading ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/15"
              onClick={onStop}
              title="Stop generating"
            >
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!canSubmit}
              className={cn(
                'h-9 w-9 shrink-0 rounded-xl transition-all',
                canSubmit
                  ? autoRun
                    ? 'bg-violet-600 text-white shadow-sm hover:scale-[1.03] hover:bg-violet-600/90'
                    : 'bg-primary text-primary-foreground shadow-sm hover:scale-[1.03]'
                  : 'bg-muted text-muted-foreground',
              )}
              title={autoRun ? 'Run autonomously' : 'Send'}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          {autoRun
            ? 'Auto-run on — I\'ll make changes and you can undo them.'
            : 'Enter to send · Shift + Enter for newline'}
        </p>
      </div>
    </div>
  );
};

export default CLXAssistantInput;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `CLXAssistant.tsx` (parent still passes `mode` prop and doesn't pass `autoRun`). That's fine — Task 6 fixes that. We're isolating concerns.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/CLXAssistantInput.tsx src/components/ai/AutoRunToggle.tsx
git commit -m "feat(ai-assistant): replace mode prop with Auto-run toggle on composer"
```

(`AutoRunToggle.tsx` was already committed in Task 2 — this `add` is a no-op if no further changes; the commit will only include the input file. That's fine.)

---

## Task 5: Simplify the header

**Files:**
- Modify: `src/components/ai/CLXAssistantHeader.tsx`

- [ ] **Step 1: Replace the whole file**

Overwrite `src/components/ai/CLXAssistantHeader.tsx` with:

```tsx
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

      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
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
  );
};

export default CLXAssistantHeader;
```

- [ ] **Step 2: Remove the now-orphan AIMode type export**

The old `CLXAssistantHeader.tsx` exported `type AIMode`. Search for remaining consumers:

```bash
grep -rn "AIMode" src/ --include="*.tsx" --include="*.ts"
```

Expected remaining hits: `CLXAssistant.tsx`, `CLXAssistantEmptyState.tsx` (these will be cleaned up in Tasks 6 + 7). The old re-export from the header is now gone — that's correct.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `CLXAssistant.tsx` (still passes `activeMode`, `onModeChange` to the header) and `CLXAssistantEmptyState.tsx` (imports `AIMode`). Fixed in Tasks 6 + 7.

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/CLXAssistantHeader.tsx
git commit -m "refactor(ai-assistant): remove segmented mode switcher from header"
```

---

## Task 6: Collapse the empty state to one variant

**Files:**
- Modify: `src/components/ai/CLXAssistantEmptyState.tsx`

- [ ] **Step 1: Replace the whole file**

Overwrite `src/components/ai/CLXAssistantEmptyState.tsx` with:

```tsx
import { MessageCircle, CheckCircle2, Sparkles, ArrowRight, Zap } from 'lucide-react';
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

// Unified prompt set: mixes read-only ("summarize", "show me") with action prompts
// ("draft", "create", "update") so the user sees both flavors in one place.
const promptsByContext: Record<string, string[]> = {
  pipeline: [
    'What leads need follow-up today?',
    'Summarize my pipeline status',
    'Draft emails for leads awaiting documents',
    'Update all discovery leads that are ready',
  ],
  leads: [
    "Which leads haven't been contacted recently?",
    'Show me high-priority leads',
    'Help me follow up with this lead',
    'Update lead statuses in bulk',
  ],
  tasks: [
    'What are my overdue tasks?',
    'Prioritize my tasks for today',
    'Help me clear my overdue tasks',
    'Create follow-up tasks for my leads',
  ],
  email: [
    'Any emails that need urgent replies?',
    'Summarize my unread emails',
    'Draft a follow-up email',
    'Create email templates for common responses',
  ],
  dashboard: [
    'Give me a morning briefing',
    "What's my top priority today?",
    'Set up my day with tasks and follow-ups',
    'Draft check-in emails for active deals',
  ],
  calls: [
    'Summarize my recent calls',
    'Who should I call today?',
    'Log notes from my last call',
    'Create follow-up tasks from recent calls',
  ],
  calendar: [
    'What meetings do I have today?',
    'Any scheduling conflicts this week?',
    'Schedule a follow-up meeting',
    "Create tasks from today's meetings",
  ],
  general: [
    'What leads need follow-up today?',
    'Summarize my pipeline status',
    'Help me follow up with a lead',
    'Create tasks for my pending deals',
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
}: {
  prompt: string;
  onSubmit: (p: string) => void;
  icon: typeof MessageCircle;
}) => (
  <button
    type="button"
    onClick={() => onSubmit(prompt)}
    className={cn(
      'group relative flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm shadow-sm transition-all duration-200',
      'hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md',
    )}
  >
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary/70 group-hover:text-primary" />
    <span className="flex-1 leading-snug text-foreground/90">{prompt}</span>
    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
  </button>
);

const CLXAssistantEmptyState = ({ currentPage, suggestedTasks, onSubmit, greetingName }: CLXAssistantEmptyStateProps) => {
  const pageCtx = getPageContext(currentPage);
  const prompts = promptsByContext[pageCtx] || promptsByContext.general;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pb-8 pt-10 md:pt-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 shadow-sm">
        <Sparkles className="h-7 w-7 text-primary" strokeWidth={1.75} />
      </div>

      <h1 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">
        {getGreeting(greetingName)}
      </h1>
      <p className="mt-2 max-w-xl text-center text-sm text-muted-foreground">
        Ask anything about your pipeline, leads, tasks, or calendar. I can also propose actions — toggle{' '}
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 align-middle text-xs font-medium text-violet-700 dark:text-violet-300">
          <Zap className="h-3 w-3" />
          Auto-run
        </span>{' '}
        on the composer to let me make changes for you (everything is undoable).
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {prompts.map((prompt) => (
          <PromptCard key={prompt} prompt={prompt} onSubmit={onSubmit} icon={MessageCircle} />
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
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CLXAssistantEmptyState;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors still only in `CLXAssistant.tsx`. The empty-state file no longer references `AIMode`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/CLXAssistantEmptyState.tsx
git commit -m "refactor(ai-assistant): collapse 3-mode empty state into single unified state"
```

---

## Task 7: Rewrite CLXAssistant to use unified state + Auto-run routing

This is the load-bearing task. It replaces three submit handlers and three message arrays with one of each, driven by an `autoRun` flag.

**Files:**
- Modify: `src/components/ai/CLXAssistant.tsx`

- [ ] **Step 1: Replace the whole file**

Overwrite `src/components/ai/CLXAssistant.tsx` with:

```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { aiAssistantUrl } from '@/lib/aiAssistantRouter';
import { toast } from 'sonner';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { useActionParser } from '@/hooks/useActionParser';
import { useActionExecutor } from '@/hooks/useActionExecutor';
import CLXAssistantHeader from './CLXAssistantHeader';
import CLXAssistantInput from './CLXAssistantInput';
import CLXAssistantHistory from './CLXAssistantHistory';
import CLXAssistantEmptyState from './CLXAssistantEmptyState';
import UnifiedMessages from './modes/UnifiedMessages';
import type { UnifiedMessage, AgentLogEntry } from './types';
import { toPersistedMessage } from './types';
import type { ActionProposal } from './actions/ActionCard';

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

const CLXAssistant = () => {
  const {
    messages: persistedMessages,
    setMessages: setPersistedMessages,
    currentConversationId,
    setCurrentConversationId,
    conversations,
    isLoadingConversations,
    createConversation,
    loadConversation,
    saveMessages,
    deleteConversation,
    startNewConversation,
    pendingPrompt,
    setPendingPrompt,
  } = useAIAssistant();

  const location = useLocation();
  const navigate = useNavigate();
  const { parseActions } = useActionParser();
  const { executeAction, undoBatch: undoBatchAction } = useActionExecutor();

  // Unified rich message stream. Hydrates from persistedMessages (text-only)
  // whenever a conversation is loaded from the DB.
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [input, setInput] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null!);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { data: teamMember } = useQuery({
    queryKey: ['current-team-member-ai'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('users')
        .select('id, name, avatar_url')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
  });

  const { data: suggestedTasks = [] } = useQuery({
    queryKey: ['ai-suggested-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Sync rich messages FROM context when a conversation is loaded.
  // Context updates persistedMessages via loadConversation; we hydrate as text.
  useEffect(() => {
    setMessages((current) => {
      // If we already have richer state for the same content, keep it.
      // Otherwise hydrate text-only from the DB.
      if (current.length === persistedMessages.length) return current;
      return persistedMessages.map<UnifiedMessage>((m) => ({
        kind: 'text',
        role: m.role,
        content: m.content,
      }));
    });
  }, [persistedMessages]);

  useEffect(() => {
    if (pendingPrompt) {
      setInput(pendingPrompt);
      setPendingPrompt(null);
      setTimeout(() => {
        inputRef.current?.focus();
        const el = inputRef.current;
        if (el) {
          const len = el.value.length;
          try { el.setSelectionRange(len, len); } catch { /* no-op */ }
        }
      }, 150);
    }
  }, [pendingPrompt, setPendingPrompt]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const resetConversation = () => {
    startNewConversation();
    setMessages([]);
  };

  const handleSubmit = async (messageText?: string) => {
    const text = messageText || input.trim();
    if ((!text && !uploadedFile) || isLoading) return;

    let convId = currentConversationId;
    if (!convId) {
      convId = await createConversation();
      if (!convId) {
        toast.error('Failed to create conversation');
        return;
      }
      setCurrentConversationId(convId);
    }

    const userContent = uploadedFile ? `${text}\n\n[Attached PDF: ${uploadedFile.name}]` : text;
    const userMsg: UnifiedMessage = { kind: 'text', role: 'user', content: userContent };

    setInput('');
    const fileToSend = uploadedFile;
    setUploadedFile(null);
    setIsLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    if (autoRun) {
      await runAutonomous(userMsg, convId, abortController);
    } else {
      await runAssist(userMsg, convId, fileToSend, abortController);
    }
  };

  const runAssist = async (
    userMsg: UnifiedMessage,
    convId: string,
    file: UploadedFile | null,
    abortController: AbortController,
  ) => {
    const draft: UnifiedMessage[] = [...messages, userMsg];
    setMessages(draft);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Send only text-shape messages to the API.
      const apiMessages = draft.map(toPersistedMessage);

      const requestBody = {
        messages: apiMessages,
        teamMemberId: teamMember?.id,
        file,
        mode: 'assist',
        currentPage: location.pathname,
      };
      const response = await fetch(aiAssistantUrl(requestBody), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error('Rate limit exceeded. Please try again later.');
          setIsLoading(false);
          return;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      let fullContent = '';
      const withPlaceholder: UnifiedMessage[] = [
        ...draft,
        { kind: 'text', role: 'assistant', content: '' },
      ];
      setMessages(withPlaceholder);

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { kind: 'text', role: 'assistant', content: fullContent };
                return updated;
              });
            }
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      // Parse action tags out of the final text. If there are any, upgrade
      // the trailing message to kind='actions'.
      const { cleanText, actions } = parseActions(fullContent);
      const finalMsg: UnifiedMessage = actions.length > 0
        ? { kind: 'actions', role: 'assistant', content: cleanText, actions }
        : { kind: 'text', role: 'assistant', content: cleanText };

      const finalMessages: UnifiedMessage[] = [...draft, finalMsg];
      setMessages(finalMessages);

      // Persist as text-only.
      const persistedFinal = finalMessages.map(toPersistedMessage);
      setPersistedMessages(persistedFinal);
      if (convId) await saveMessages(convId, persistedFinal);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Assist error:', error);
      toast.error(error.message || 'Failed to get AI response');
      // Strip empty trailing assistant message if streaming never started.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.kind === 'text' && last.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const runAutonomous = async (
    userMsg: UnifiedMessage,
    convId: string,
    abortController: AbortController,
  ) => {
    const draft: UnifiedMessage[] = [...messages, userMsg];
    const placeholder: UnifiedMessage = {
      kind: 'agent_log',
      role: 'assistant',
      content: '',
      agentLog: [{ type: 'text', content: 'Processing your request...' }],
    };
    setMessages([...draft, placeholder]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const requestBody = {
        action: 'agent',
        prompt: userMsg.content,
        conversationId: convId,
        teamMemberId: teamMember?.id,
        currentPage: location.pathname,
      };
      const response = await fetch(aiAssistantUrl(requestBody), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      if (!response.ok) {
        if (response.status === 429) throw new Error('Rate limit exceeded. Please try again later.');
        let errorMsg = `Agent request failed (${response.status})`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch {
          errorMsg = `Agent request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      const agentLog: AgentLogEntry[] = [];
      let batchId: string | undefined;
      let totalChanges = 0;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr) as AgentLogEntry;
            agentLog.push(parsed);
            if (parsed.type === 'batch_complete') {
              batchId = parsed.batchId;
              totalChanges = parsed.totalChanges || 0;
            }
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                kind: 'agent_log',
                role: 'assistant',
                content: '',
                agentLog: [...agentLog],
                batchId,
                totalChanges,
              };
              return updated;
            });
          } catch {
            buffer = line + '\n' + buffer;
            break;
          }
        }
      }

      if (agentLog.length === 0) {
        agentLog.push({ type: 'text', content: 'No actions were taken.' });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          kind: 'agent_log',
          role: 'assistant',
          content: '',
          agentLog,
          batchId,
          totalChanges,
        };
        return updated;
      });
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Agent error:', error);
      const errorMessage = error.message || 'Agent execution failed';
      toast.error(errorMessage);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          kind: 'agent_log',
          role: 'assistant',
          content: '',
          agentLog: [{ type: 'error', content: errorMessage }],
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      inputRef.current?.focus();
    }
  };

  const handleConfirmAction = useCallback(
    async (actionId: string) => {
      // Find the action in any message
      let foundAction: ActionProposal | undefined;
      messages.forEach((m) => {
        if (m.kind === 'actions') {
          const hit = m.actions.find((a) => a.id === actionId);
          if (hit) foundAction = hit;
        }
      });
      if (!foundAction) return;

      // Mark executing
      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'actions'
            ? {
                ...m,
                actions: m.actions.map((a) =>
                  a.id === actionId ? { ...a, status: 'executing' as const } : a,
                ),
              }
            : m,
        ),
      );

      const result = await executeAction(foundAction, currentConversationId);

      setMessages((prev) =>
        prev.map((m) =>
          m.kind === 'actions'
            ? {
                ...m,
                actions: m.actions.map((a) =>
                  a.id === actionId
                    ? {
                        ...a,
                        status: result.success ? ('completed' as const) : ('failed' as const),
                        result: result.result,
                        changeId: result.changeId,
                      }
                    : a,
                ),
              }
            : m,
        ),
      );
    },
    [messages, executeAction, currentConversationId],
  );

  const handleDismissAction = useCallback((actionId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.kind === 'actions'
          ? {
              ...m,
              actions: m.actions.map((a) =>
                a.id === actionId ? { ...a, status: 'dismissed' as const } : a,
              ),
            }
          : m,
      ),
    );
  }, []);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleUndoBatch = useCallback(
    async (batchId: string) => {
      await undoBatchAction(batchId);
    },
    [undoBatchAction],
  );

  const handleViewChanges = useCallback(
    (batchId: string) => {
      navigate(`/superadmin/ai-changes?batch=${batchId}`);
    },
    [navigate],
  );

  return (
    <div className="relative flex h-full w-full overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-violet-500/[0.05] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-[36rem] rounded-full bg-amber-400/[0.04] blur-3xl" />
      </div>

      <AnimatePresence initial={false}>
        {showHistorySidebar && (
          <CLXAssistantHistory
            conversations={conversations}
            isLoading={isLoadingConversations}
            currentConversationId={currentConversationId}
            onLoad={async (id) => {
              await loadConversation(id);
            }}
            onDelete={async (e, id) => {
              e.stopPropagation();
              await deleteConversation(id);
            }}
            onNewChat={resetConversation}
          />
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <CLXAssistantHeader
          showHistorySidebar={showHistorySidebar}
          onToggleHistory={() => setShowHistorySidebar((prev) => !prev)}
          onNewChat={resetConversation}
        />

        <ScrollArea className="flex-1" ref={scrollRef}>
          {messages.length === 0 ? (
            <CLXAssistantEmptyState
              currentPage={location.pathname}
              suggestedTasks={suggestedTasks}
              onSubmit={handleSubmit}
              greetingName={teamMember?.name}
            />
          ) : (
            <UnifiedMessages
              messages={messages}
              isLoading={isLoading}
              userAvatarUrl={teamMember?.avatar_url}
              userName={teamMember?.name}
              onConfirmAction={handleConfirmAction}
              onDismissAction={handleDismissAction}
              onUndoBatch={handleUndoBatch}
              onViewChanges={handleViewChanges}
            />
          )}
        </ScrollArea>

        <CLXAssistantInput
          input={input}
          onInputChange={setInput}
          onSubmit={() => handleSubmit()}
          onStop={handleStopGeneration}
          isLoading={isLoading}
          uploadedFile={uploadedFile}
          onFileUpload={setUploadedFile}
          onRemoveFile={() => setUploadedFile(null)}
          inputRef={inputRef}
          autoRun={autoRun}
          onAutoRunChange={setAutoRun}
        />
      </div>
    </div>
  );
};

export default CLXAssistant;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean exit. All consumers now match the new prop signatures.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build succeeds. Note the size of the new `AIAssistant-*.js` chunk — it should be in the same ballpark as before (~150 kB) since we removed three files and added two.

- [ ] **Step 4: Commit**

```bash
git add src/components/ai/CLXAssistant.tsx
git commit -m "feat(ai-assistant): unify Chat/Assist/Agent into single mode + Auto-run toggle"
```

---

## Task 8: Delete the orphaned mode renderers

Now that `UnifiedMessages` is wired up and the build is green, the three old per-mode renderers are unreachable.

**Files:**
- Delete: `src/components/ai/modes/ChatMessages.tsx`
- Delete: `src/components/ai/modes/AssistMessages.tsx`
- Delete: `src/components/ai/modes/AgentMessages.tsx`

- [ ] **Step 1: Confirm nothing imports them**

Run:

```bash
grep -rn "modes/ChatMessages\|modes/AssistMessages\|modes/AgentMessages" src/
```

Expected: no matches. If anything still references them, stop and fix that file first.

- [ ] **Step 2: Delete the files**

```bash
rm src/components/ai/modes/ChatMessages.tsx
rm src/components/ai/modes/AssistMessages.tsx
rm src/components/ai/modes/AgentMessages.tsx
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add -u src/components/ai/modes/
git commit -m "chore(ai-assistant): remove orphan per-mode renderers"
```

---

## Task 9: Smoke test in dev server

There are no automated tests in this repo — we verify manually.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite serves on `http://localhost:8080` (or whatever the project default is — check terminal output).

- [ ] **Step 2: Hard-refresh and open the assistant**

Navigate to `/admin/assistant`. Verify:

- The page loads inside the admin chrome.
- The header shows: history toggle (left) · "CLX Assistant" wordmark (center) · "New chat" (right). **No segmented control.**
- The composer has the Auto-run pill to the left of the send button.
- The empty state shows greeting + 4 prompt cards + the violet "Auto-run" pill in the explainer copy.

- [ ] **Step 3: Test the assist path (Auto-run OFF)**

Type a prompt like "Update lead [some-name] to status under_review" and press Enter.

Verify:
- Assistant reply streams in.
- If the model emits action tags, one or more `ActionCard`s appear with Confirm/Dismiss buttons.
- Clicking Confirm marks the action as executing → completed; the change is persisted in `ai_agent_changes`.
- The composer focus ring is the primary (blue) tint, not violet.

- [ ] **Step 4: Test the Auto-run path (Auto-run ON)**

Click the Auto-run pill (should turn violet) and send a prompt like "Create a follow-up task for any lead in discovery".

Verify:
- The composer focus ring + send button turn violet.
- The hint text under the composer changes to "Auto-run on — I'll make changes and you can undo them."
- The assistant message renders inside a violet-bordered card with "AUTO-RUN" eyebrow.
- Tool calls stream in live (`Loader2` spinning → green check on success).
- When the batch completes, the "Undo N changes" + "View details" buttons appear at the bottom of the card.
- Clicking Undo successfully reverses the changes (verify in the AI Changes page).

- [ ] **Step 5: Test mode persistence across history**

- Send one assist message and one auto-run message in the same conversation.
- Toggle the history sidebar; click another conversation, then click back into the current one.
- Verify the messages reload as plain text (no action buttons, no live tool log — that's expected since the rich state is ephemeral). Both rich and persisted shapes should be readable.

- [ ] **Step 6: Test "New chat" reset**

Click "New chat" in the header. Verify:
- Messages clear.
- Empty state reappears.
- Auto-run state is preserved (user toggled it on, it stays on — that's intentional, the toggle is a user preference for this session).

- [ ] **Step 7: Document any regressions**

If anything misbehaves, note the file/line and either fix in-place or stop and surface to the user. Do not paper over with try/catch swallows.

- [ ] **Step 8: Commit any fixes**

If you made fixes during smoke testing:

```bash
git add -u
git commit -m "fix(ai-assistant): <description of what you fixed>"
```

---

## Task 10: Update component docs

**Files:**
- Modify: `src/components/ai/` — no internal CLAUDE.md exists; we add one to lock the new contract.

- [ ] **Step 1: Inspect what other ai/ files reference (sanity check)**

```bash
grep -rn "ChatMessages\|AssistMessages\|AgentMessages\|AIMode" src/components/ai/
```

Expected: no remaining matches. If any, fix before proceeding.

- [ ] **Step 2: Write the folder doc**

Create `src/components/ai/CLAUDE.md`:

```md
# AI Assistant Components

CLX Assistant — single unified chat surface. **Modes were removed in May 2026** (see git log around `2026-05-15-unify-clx-assistant-modes`). The old Chat / Assist / Agent segmented control is gone. The runtime behavior is:

- **Default send** → routes to `ai-assistant-chat` with `mode: 'assist'`. Streams text. `useActionParser` extracts inline `<action>` tags from the final response; if any exist, the trailing message upgrades to `kind: 'actions'` and renders `ActionCard`s with Confirm / Dismiss.
- **Auto-run send** (composer pill toggled on) → routes to `ai-assistant-agent`. Streams an SSE log of tool calls. The trailing message is `kind: 'agent_log'` and renders a live timeline + "Undo N changes" + "View details" buttons once the batch completes.

## Files

| File | Role |
|---|---|
| `CLXAssistant.tsx` | Top-level shell: state, submit routing (assist vs autonomous), conversation hydration, history rail |
| `CLXAssistantHeader.tsx` | History toggle + wordmark + new-chat button. **No mode switcher.** |
| `CLXAssistantInput.tsx` | Auto-grow textarea composer with paperclip + AutoRunToggle + send/stop button |
| `CLXAssistantHistory.tsx` | Left rail with date-grouped conversation list and "New chat" CTA |
| `CLXAssistantEmptyState.tsx` | Single hero greeting + context-aware prompt grid + suggested tasks |
| `AutoRunToggle.tsx` | Violet pill switch ("Zap" icon) used inside the composer |
| `types.ts` | `UnifiedMessage` discriminated union (kind: text / actions / agent_log) + `toPersistedMessage` mapper |
| `modes/UnifiedMessages.tsx` | Renders the message stream; per-message switch on `kind` |
| `actions/ActionCard.tsx` | Renders a single `ActionProposal` with confirm/dismiss/executing/completed/failed states |

## Persistence contract

`ai_conversation_messages` only stores `{ role, content }`. Rich shapes (action proposals, agent logs) are ephemeral — they only exist for the current session. `types.ts` exports `toPersistedMessage(msg)` which is the single point of truth for the DB shape (it summarizes agent logs as plain text so reloading shows something useful).

## Adding a new action type

1. Add a string variant to the `ActionProposal.type` union (in `actions/ActionCard.tsx`).
2. Teach the model about it: add an `<action type="..." .../>` example to the `assistCapabilities` block in `supabase/functions/ai-assistant-chat/index.ts`.
3. Implement execution in `supabase/functions/ai-assistant-actions/index.ts` (or its shared executor).
4. If you also want Agent / Auto-run to be able to call it autonomously, add a corresponding OpenAI function definition to `supabase/functions/_shared/aiAgent/tools.ts` and a mapping in `ai-assistant-agent/index.ts`.

The client side (parser, executor, renderer) is generic and needs no change unless you want bespoke UI for the new action.
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ai/CLAUDE.md
git commit -m "docs(ai-assistant): document unified-mode architecture"
```

---

## Final verification

- [ ] **Step 1: Full typecheck + build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both clean. Note the final `AIAssistant-*.js` chunk size from the build output — should be within ±20 kB of the pre-refactor size (~150 kB).

- [ ] **Step 2: Inspect the git log**

```bash
git log --oneline main..HEAD
```

Expected: ~9 commits, each scoped to a single concern (types → AutoRunToggle → UnifiedMessages → input → header → empty state → CLXAssistant → delete orphans → docs). If anything looks lumped, rebase/split before opening a PR.

- [ ] **Step 3: Open a PR**

```bash
gh pr create --title "Unify CLX Assistant modes (Chat/Assist/Agent → one + Auto-run)" --body "$(cat <<'EOF'
## Summary
- Removed the segmented Chat / Assist / Agent mode picker
- Default send is always Assist-flavored (text + inline action proposals to confirm)
- Added an **Auto-run** pill toggle on the composer that escalates a single send to autonomous (Agent) execution with batch undo
- Backend edge functions unchanged; this is a UX consolidation only

## Why
Three modes forced users to predict capability upfront and guess wrong — "I asked in Chat but it can't do X." The unified design matches where ChatGPT / Cursor / Linear have all moved: one input, one mental model, with autonomy as an opt-in escalation rather than a separate UI surface.

## Test plan
- [ ] Default send still streams a reply
- [ ] Action proposals from the model render as ActionCards with Confirm / Dismiss
- [ ] Confirmed actions write to ai_agent_changes and are individually undoable
- [ ] Auto-run pill toggles violet styling on composer
- [ ] Auto-run send hits ai-assistant-agent and renders the live tool log
- [ ] Batch undo + "View details" buttons appear and work after autonomous run completes
- [ ] Conversation history loads as plain text (ephemeral rich state is expected to be dropped)
- [ ] New chat resets messages; Auto-run preference persists for the session

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** The original ask was "unify Chat/Assist/Agent into one with inline actions + per-message Auto-run." Tasks 4–7 deliver the UI consolidation; Task 7 implements the runtime routing; Tasks 1–3 set up the supporting types and components; Tasks 8–10 are cleanup and docs. Every piece of the spec maps to a task.
- **Placeholder scan:** No "TBD" / "implement later" / "add appropriate error handling" steps. Every step shows the actual code or actual command.
- **Type consistency:** `UnifiedMessage` is defined in Task 1 and consumed unchanged by Tasks 3 and 7. `toPersistedMessage` is defined in Task 1 and called from Task 7. `AutoRunToggle`'s props (`active`, `onChange`, `disabled`) are consumed in Task 4 with matching names.
- **No backend changes** — verified in the file structure section. The edge functions are referenced but not modified.
- **One edge case worth flagging during execution:** the `ai_conversation_messages` table only stores text. Auto-run conversations will round-trip as plain text (no live tool log on reload). The plan accepts this — `toPersistedMessage` summarizes the agent log as bullet text so the user sees *something* useful in history, just not the interactive controls. If that's not acceptable, a follow-up task would extend the DB schema to persist `kind` + `agentLog` JSON, but that's out of scope here.
