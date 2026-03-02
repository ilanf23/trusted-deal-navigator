import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Link2,
  List,
  ListOrdered,
  Code,
  Quote,
  Heading,
  ChevronDown,
  RemoveFormatting,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
  maxHeight?: string;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}

const RichTextEditor = ({
  value,
  onChange,
  placeholder = 'Type here...',
  disabled = false,
  className,
  minHeight = '80px',
  maxHeight = '300px',
  onBlur,
  onKeyDown,
}: RichTextEditorProps) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastExternalValue = useRef<string>(value);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const savedSelection = useRef<Range | null>(null);

  // Sync external value → editor (avoid infinite loop)
  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const emitChange = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastExternalValue.current = html;
    onChange(html);
  }, [onChange]);

<<<<<<< HEAD
=======
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection.current);
    }
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, val);
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);
>>>>>>> d560fe7 (Add phone number formatting utility and update contact display in admin components)

  const handleInput = useCallback(() => {
    emitChange();
  }, [emitChange]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const clean = html
      ? DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'iframe', 'form', 'style'], FORBID_ATTR: ['onerror', 'onload', 'onclick'] })
      : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    document.execCommand('insertHTML', false, clean);
    emitChange();
  }, [emitChange]);

<<<<<<< HEAD
  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedSelection.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelection.current);
    }
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    restoreSelection();
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    emitChange();
  }, [emitChange, restoreSelection]);

=======
>>>>>>> d560fe7 (Add phone number formatting utility and update contact display in admin components)
  const handleInsertLink = useCallback(() => {
    if (!linkUrl.trim()) return;
    restoreSelection();
    editorRef.current?.focus();
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const sel = window.getSelection();
    const selectedText = sel?.toString() || url;
    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${selectedText}</a>`);
    setLinkUrl('');
    setLinkOpen(false);
    emitChange();
  }, [linkUrl, restoreSelection, emitChange]);

  const handleInsertCode = useCallback(() => {
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const text = sel.toString();
    if (text) {
      document.execCommand('insertHTML', false, `<code>${text}</code>`);
    }
    saveSelection();
    emitChange();
  }, [emitChange, restoreSelection, saveSelection]);

  const ToolBtn = ({ icon: Icon, label, onClick, active }: { icon: React.ElementType; label: string; onClick: () => void; active?: boolean }) => (
    <button
      type="button"
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40',
        active && 'bg-muted text-foreground'
      )}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );

  const Sep = () => <div className="w-px h-4 bg-border mx-0.5" />;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card transition-all',
        disabled && 'opacity-50 pointer-events-none',
        className,
      )}
    >
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onPaste={handlePaste}
        onBlur={() => { saveSelection(); onBlur?.(); }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onKeyDown={onKeyDown}
        className={cn(
          'px-3 py-2 text-sm text-foreground outline-none overflow-y-auto',
          'prose prose-sm max-w-none',
          'prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-blockquote:my-1',
          'prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:font-mono',
          'prose-a:text-blue-600 prose-a:underline',
          'prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-muted-foreground',
          '[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:opacity-50 [&:empty]:before:pointer-events-none',
        )}
        style={{ minHeight, maxHeight }}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-t border-border flex-wrap">
        {/* Link */}
        <Popover open={linkOpen} onOpenChange={(open) => {
          if (open) saveSelection();
          setLinkOpen(open);
          if (!open) setLinkUrl('');
        }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Insert link"
              onMouseDown={(e) => e.preventDefault()}
              disabled={disabled}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
            <div className="flex gap-1.5">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInsertLink(); } }}
                placeholder="https://..."
                className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background outline-none focus:border-blue-400"
                autoFocus
              />
              <button
                type="button"
                onClick={handleInsertLink}
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-1 rounded transition-colors"
              >
                Add
              </button>
            </div>
          </PopoverContent>
        </Popover>

        <ToolBtn icon={Bold} label="Bold" onClick={() => exec('bold')} />
        <ToolBtn icon={Italic} label="Italic" onClick={() => exec('italic')} />
        <ToolBtn icon={Strikethrough} label="Strikethrough" onClick={() => exec('strikeThrough')} />
        <ToolBtn icon={Code} label="Inline Code" onClick={handleInsertCode} />
        <ToolBtn icon={RemoveFormatting} label="Clear Formatting" onClick={() => exec('removeFormat')} />

        <Sep />

        <ToolBtn icon={Quote} label="Blockquote" onClick={() => exec('formatBlock', 'blockquote')} />

        {/* Heading dropdown */}
        <DropdownMenu onOpenChange={(open) => { if (open) saveSelection(); }}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Heading"
              onMouseDown={(e) => { e.preventDefault(); saveSelection(); }}
              disabled={disabled}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 flex items-center gap-0.5"
            >
              <Heading className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onSelect={() => exec('formatBlock', 'h1')} className="text-xs">
              <span className="font-bold text-base">Heading 1</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exec('formatBlock', 'h2')} className="text-xs">
              <span className="font-bold text-sm">Heading 2</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exec('formatBlock', 'h3')} className="text-xs">
              <span className="font-semibold text-xs">Heading 3</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exec('formatBlock', 'p')} className="text-xs">
              Normal text
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ToolBtn icon={List} label="Bullet List" onClick={() => exec('insertUnorderedList')} />
        <ToolBtn icon={ListOrdered} label="Ordered List" onClick={() => exec('insertOrderedList')} />
      </div>
    </div>
  );
};

export { RichTextEditor };
