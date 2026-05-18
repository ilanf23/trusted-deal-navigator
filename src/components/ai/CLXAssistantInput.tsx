import { useRef, useEffect } from 'react';
import { ArrowUp, Paperclip, FileText, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { AIMode } from './CLXAssistantHeader';

interface UploadedFile {
  name: string;
  type: string;
  content: string;
}

interface CLXAssistantInputProps {
  mode: AIMode;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
  uploadedFile: UploadedFile | null;
  onFileUpload: (file: UploadedFile) => void;
  onRemoveFile: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const placeholders: Record<AIMode, string> = {
  chat: 'Ask anything — I can see your leads, tasks, and pipeline',
  assist: 'Describe what you need help with, and I\'ll propose actions',
  agent: 'Tell me what to do, and I\'ll handle it autonomously',
};

const modeAccent: Record<AIMode, string> = {
  chat: 'focus-within:ring-primary/30 focus-within:border-primary/40',
  assist: 'focus-within:ring-amber-400/30 focus-within:border-amber-400/50',
  agent: 'focus-within:ring-violet-400/30 focus-within:border-violet-400/50',
};

const CLXAssistantInput = ({
  mode,
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  uploadedFile,
  onFileUpload,
  onRemoveFile,
  inputRef,
}: CLXAssistantInputProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea to its content, capped so it never dominates the screen.
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
            modeAccent[mode],
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
            placeholder={placeholders[mode]}
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm leading-6 outline-none',
              'placeholder:text-muted-foreground/70 disabled:opacity-60',
              'max-h-[200px]',
            )}
          />

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
                  ? 'bg-primary text-primary-foreground shadow-sm hover:scale-[1.03]'
                  : 'bg-muted text-muted-foreground',
              )}
              title="Send"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Enter to send · Shift + Enter for newline
        </p>
      </div>
    </div>
  );
};

export default CLXAssistantInput;
