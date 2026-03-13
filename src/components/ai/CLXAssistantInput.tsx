import { useRef } from 'react';
import { Send, Paperclip, FileText, X, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
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
  inputRef: React.RefObject<HTMLInputElement>;
}

const placeholders: Record<AIMode, string> = {
  chat: 'Ask anything...',
  assist: 'What do you need help with?',
  agent: 'Describe what you want me to do...',
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

  return (
    <div className="p-3 border-t bg-muted/30">
      {uploadedFile && (
        <div className="flex items-center gap-2 mb-2 p-2 bg-muted rounded-md">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs truncate flex-1">{uploadedFile.name}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onRemoveFile}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex gap-2"
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
          size="sm"
          className="h-9 w-9 p-0 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          title="Attach PDF"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholders[mode]}
          disabled={isLoading}
          className="flex-1 h-9 text-sm"
        />
        {isLoading ? (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-9 w-9 p-0"
            onClick={onStop}
            title="Stop generating"
          >
            <Square className="h-3 w-3 fill-current" />
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim() && !uploadedFile} className="h-9 w-9 p-0">
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
};

export default CLXAssistantInput;
