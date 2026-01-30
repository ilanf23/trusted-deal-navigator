import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Send, Loader2, Paperclip, Bold, Italic, Underline, 
  Link2, List, ListOrdered, Trash2, XCircle, FileText, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface InlineAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  base64?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface InlineReplyBoxProps {
  recipientEmail: string;
  recipientName: string;
  recipientPhoto?: string | null;
  onSend: (body: string, attachments: InlineAttachment[]) => void;
  onDiscard: () => void;
  sending?: boolean;
  initialBody?: string;
  placeholder?: string;
  templates?: EmailTemplate[];
}

const InlineReplyBox: React.FC<InlineReplyBoxProps> = ({
  recipientEmail,
  recipientName,
  recipientPhoto,
  onSend,
  onDiscard,
  sending = false,
  initialBody = '',
  placeholder = 'Write your reply...',
  templates = [],
}) => {
  const [body, setBody] = useState(initialBody);
  const [attachments, setAttachments] = useState<InlineAttachment[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && initialBody) {
      editorRef.current.innerHTML = initialBody;
    }
  }, [initialBody]);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setBody(editorRef.current.innerHTML);
    }
  }, []);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  }, [handleEditorInput]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: InlineAttachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Max size is 25MB.`);
        continue;
      }
      
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      newAttachments.push({
        id: `${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        file: file,
        base64: base64,
      });
    }
    
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      toast.success(`${newAttachments.length} file(s) attached`);
    }
    e.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSend = () => {
    const content = editorRef.current?.innerHTML || '';
    if (!content.trim() || content === '<br>') {
      toast.error('Please write a message');
      return;
    }
    onSend(content, attachments);
  };

  const handleDiscard = () => {
    setBody('');
    setAttachments([]);
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    onDiscard();
  };

  return (
    <div className={cn(
      "mt-6 rounded-lg border transition-all",
      isFocused 
        ? "border-blue-400 shadow-md ring-2 ring-blue-100 dark:ring-blue-900/30" 
        : "border-border hover:border-slate-300 dark:hover:border-slate-600"
    )}>
      {/* Header with recipient */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-800/30 rounded-t-lg">
        <Avatar className="w-8 h-8">
          {recipientPhoto && <AvatarImage src={recipientPhoto} />}
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {recipientName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{recipientName}</p>
          <p className="text-xs text-muted-foreground truncate">{recipientEmail}</p>
        </div>
      </div>

      {/* Editor area */}
      <div className="p-4">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleEditorInput}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          suppressContentEditableWarning
          className="min-h-[120px] max-h-[300px] overflow-y-auto text-sm outline-none prose prose-sm max-w-none dark:prose-invert"
          style={{ 
            caretColor: '#3b82f6',
            lineHeight: '1.8',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
          data-placeholder={placeholder}
        />

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap gap-2">
              {attachments.map((att) => (
                <div 
                  key={att.id}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg group"
                >
                  <Paperclip className="w-4 h-4 text-slate-500" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium truncate max-w-[150px]">{att.name}</span>
                    <span className="text-xs text-slate-500">{formatFileSize(att.size)}</span>
                  </div>
                  <button 
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <XCircle className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Toolbar and actions */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-slate-50/50 dark:bg-slate-800/30 rounded-b-lg">
        {/* Formatting tools */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => execCommand('bold')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => execCommand('italic')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => execCommand('underline')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Underline"
          >
            <Underline className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={() => execCommand('insertUnorderedList')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Bullet list"
          >
            <List className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            onClick={() => execCommand('insertOrderedList')}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title="Attach files"
          >
            <Paperclip className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="*/*"
          />
          
          {/* Templates dropdown */}
          {templates.length > 0 && (
            <>
              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                    title="Insert template"
                  >
                    <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {templates.map((template) => (
                    <DropdownMenuItem 
                      key={template.id}
                      onClick={() => {
                        if (editorRef.current) {
                          editorRef.current.innerHTML = template.body;
                          setBody(template.body);
                        }
                        toast.success(`Template "${template.name}" applied`);
                      }}
                    >
                      <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                      {template.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            disabled={sending}
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending}
            className="bg-[#0066FF] hover:bg-[#0052CC] text-white"
          >
            {sending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-1" />
            )}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InlineReplyBox;
