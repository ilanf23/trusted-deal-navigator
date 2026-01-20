import { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Underline, 
  Strikethrough, 
  Link2, 
  List, 
  ListOrdered, 
  Code, 
  Quote,
  Plus,
  Type,
  Smile,
  AtSign,
  Video,
  Mic,
  Zap,
  Send,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
  channelName?: string;
}

const RichTextInput = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  sending = false,
  channelName
}: RichTextInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        onSubmit();
      }
    }
  };

  const topToolbarItems = [
    { icon: Bold, label: 'Bold' },
    { icon: Italic, label: 'Italic' },
    { icon: Underline, label: 'Underline' },
    { icon: Strikethrough, label: 'Strikethrough' },
    { icon: Link2, label: 'Link', separator: true },
    { icon: List, label: 'Bullet List' },
    { icon: ListOrdered, label: 'Numbered List' },
    { icon: Code, label: 'Code Block', separator: true },
    { icon: Quote, label: 'Quote' },
  ];

  const bottomToolbarItems = [
    { icon: Plus, label: 'Add attachment' },
    { icon: Type, label: 'Formatting' },
    { icon: Smile, label: 'Emoji' },
    { icon: AtSign, label: 'Mention' },
    { icon: Video, label: 'Record video', separator: true },
    { icon: Mic, label: 'Record audio' },
    { icon: Zap, label: 'Shortcuts' },
  ];

  return (
    <div 
      className={cn(
        "rounded-xl border bg-slate-800 dark:bg-slate-900 transition-all duration-200",
        isFocused ? "ring-2 ring-admin-blue/50 border-admin-blue" : "border-slate-600"
      )}
    >
      {/* Top Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-700">
        <TooltipProvider delayDuration={300}>
          {topToolbarItems.map((item, index) => (
            <div key={item.label} className="flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                    disabled={disabled}
                  >
                    <item.icon className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {item.label}
                </TooltipContent>
              </Tooltip>
              {item.separator && index < topToolbarItems.length - 1 && (
                <div className="w-px h-4 bg-slate-600 mx-1.5" />
              )}
            </div>
          ))}
        </TooltipProvider>
      </div>

      {/* Text Area */}
      <div className="px-3 py-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={channelName ? `Message ${channelName}` : placeholder}
          disabled={disabled || sending}
          className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent text-slate-200 placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
          rows={1}
        />
      </div>

      {/* Bottom Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700">
        <div className="flex items-center gap-0.5">
          <TooltipProvider delayDuration={300}>
            {bottomToolbarItems.map((item, index) => (
              <div key={item.label} className="flex items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                      disabled={disabled}
                    >
                      <item.icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
                {item.separator && index < bottomToolbarItems.length - 1 && (
                  <div className="w-px h-4 bg-slate-600 mx-1.5" />
                )}
              </div>
            ))}
          </TooltipProvider>
        </div>

        <Button
          type="button"
          size="icon"
          onClick={onSubmit}
          disabled={disabled || sending || !value.trim()}
          className="h-8 w-8 bg-admin-blue hover:bg-admin-blue-dark text-white rounded-lg"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
};

export { RichTextInput };
