import React, { useState, useRef, useCallback } from 'react';
import { 
  X, Minus, Maximize2, ChevronDown,
  Undo2, Redo2, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, IndentDecrease, IndentIncrease,
  Type, Paperclip, Link2, Smile, Image, Lock, PenTool,
  MoreVertical, Trash2, Loader2, Calendar, Clock, FileText, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  base64?: string; // Base64 encoded data for sending
}

interface GmailComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  to: string;
  onToChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  onSend: (attachments: Attachment[]) => void;
  sending?: boolean;
  recipientName?: string;
}

const GmailComposeDialog: React.FC<GmailComposeDialogProps> = ({
  isOpen,
  onClose,
  to,
  onToChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  onSend,
  sending = false,
  recipientName,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showFormattingBar, setShowFormattingBar] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfidentialDialog, setShowConfidentialDialog] = useState(false);
  const [confidentialExpiry, setConfidentialExpiry] = useState<string>('1 week');
  const [isConfidential, setIsConfidential] = useState(false);
  const [selectedFont, setSelectedFont] = useState('Sans Serif');
  const [selectedFontSize, setSelectedFontSize] = useState('Normal');
  const [textColor, setTextColor] = useState('#000000');
  
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDiscard = () => {
    onToChange('');
    onSubjectChange('');
    onBodyChange('');
    setAttachments([]);
    setIsConfidential(false);
    onClose();
  };

  // Format command helper
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    // Sync content back to body
    if (editorRef.current) {
      onBodyChange(editorRef.current.innerHTML);
    }
  };

  // Handle editor input
  const handleEditorInput = () => {
    if (editorRef.current) {
      onBodyChange(editorRef.current.innerHTML);
    }
  };

  // File attachment handlers - convert to base64 for sending
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: Attachment[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Max size is 25MB.`);
        continue;
      }
      
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        continue;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && editorRef.current) {
          execCommand('insertImage', event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
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

  // Insert link
  const handleInsertLink = () => {
    if (!linkUrl) {
      toast.error('Please enter a URL');
      return;
    }
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    const text = linkText || url;
    execCommand('insertHTML', `<a href="${url}" target="_blank" style="color: #1a73e8; text-decoration: underline;">${text}</a>`);
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  };

  // Insert emoji
  const handleEmojiSelect = (emoji: any) => {
    if (editorRef.current) {
      execCommand('insertText', emoji.native);
    }
    setShowEmojiPicker(false);
  };

  // Schedule send
  const handleScheduleSend = () => {
    if (!scheduleDate) {
      toast.error('Please select a date');
      return;
    }
    const [hours, minutes] = scheduleTime.split(':').map(Number);
    const scheduledDateTime = new Date(scheduleDate);
    scheduledDateTime.setHours(hours, minutes);
    
    if (scheduledDateTime <= new Date()) {
      toast.error('Please select a future date and time');
      return;
    }
    
    toast.success(`Email scheduled for ${scheduledDateTime.toLocaleString()}`);
    setShowScheduleDialog(false);
    // In a real implementation, you would pass this to the backend
    onSend(attachments);
  };

  // Insert signature
  const handleInsertSignature = () => {
    const signature = `
      <br><br>
      <div style="color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px;">
        Best regards,<br>
        <strong>Evan</strong><br>
        Trusted Deal Navigator<br>
        <a href="mailto:evan@trusteddealnavigator.com" style="color: #1a73e8;">evan@trusteddealnavigator.com</a>
      </div>
    `;
    execCommand('insertHTML', signature);
    toast.success('Signature inserted');
  };

  // Enable confidential mode
  const handleConfidentialMode = () => {
    setIsConfidential(true);
    setShowConfidentialDialog(false);
    toast.success(`Confidential mode enabled. Email expires in ${confidentialExpiry}.`);
  };

  // Color picker options
  const colorOptions = [
    '#000000', '#434343', '#666666', '#999999', '#cccccc',
    '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff',
    '#0000ff', '#9900ff', '#ff00ff', '#ff6666', '#ffc966',
  ];

  // Minimized state
  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-0 right-24 w-72 bg-white dark:bg-slate-900 rounded-t-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-50 cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-slate-950 text-white rounded-t-lg">
          <span className="text-sm font-medium truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="p-1 hover:bg-slate-700 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        className={`fixed bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col ${
          isMaximized 
            ? 'inset-4 rounded-xl' 
            : 'bottom-0 right-20 w-[560px] h-[580px]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-t-xl border-b border-slate-200 dark:border-slate-700">
          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            New Message {isConfidential && <Lock className="w-3.5 h-3.5 inline ml-1 text-blue-600" />}
          </span>
          <div className="flex items-center gap-0.5">
            <button 
              onClick={() => setIsMinimized(true)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <Minus className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <Maximize2 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* Recipients Field */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <input
            type="text"
            placeholder="Recipients"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
            className="w-full text-sm bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Subject Field */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            className="w-full text-sm bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Body Area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 px-4 py-3 overflow-auto">
            <div 
              ref={editorRef}
              contentEditable
              onInput={handleEditorInput}
              className="w-full min-h-[180px] text-sm bg-transparent border-0 outline-none text-slate-900 dark:text-slate-100 focus:ring-0"
              style={{ 
                caretColor: '#3b82f6',
                fontFamily: selectedFont === 'Serif' ? 'Georgia, serif' : selectedFont === 'Monospace' ? 'monospace' : 'sans-serif',
              }}
              dangerouslySetInnerHTML={{ __html: body }}
              data-placeholder="Press / for Help me write"
            />
          </div>

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div 
                    key={att.id}
                    className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs"
                  >
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="max-w-[120px] truncate text-slate-700 dark:text-slate-300">{att.name}</span>
                    <span className="text-slate-400">({formatFileSize(att.size)})</span>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Formatting Toolbar */}
          {showFormattingBar && (
            <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-0.5 overflow-x-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('undo')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Undo (Ctrl+Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('redo')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <Redo2 className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Redo (Ctrl+Y)</TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5 mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-sm text-slate-600 dark:text-slate-400">
                      {selectedFont}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setSelectedFont('Sans Serif'); execCommand('fontName', 'sans-serif'); }}>
                      Sans Serif
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedFont('Serif'); execCommand('fontName', 'Georgia'); }}>
                      Serif
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedFont('Monospace'); execCommand('fontName', 'monospace'); }}>
                      Monospace
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                      <Type className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => { setSelectedFontSize('Small'); execCommand('fontSize', '2'); }}>
                      Small
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedFontSize('Normal'); execCommand('fontSize', '3'); }}>
                      Normal
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedFontSize('Large'); execCommand('fontSize', '5'); }}>
                      Large
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setSelectedFontSize('Huge'); execCommand('fontSize', '7'); }}>
                      Huge
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="h-5 mx-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('bold')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <Bold className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Bold (Ctrl+B)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('italic')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <Italic className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Italic (Ctrl+I)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('underline')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <Underline className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Underline (Ctrl+U)</TooltipContent>
                </Tooltip>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                      <span className="text-sm font-medium underline decoration-2" style={{ textDecorationColor: textColor }}>A</span>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="p-2">
                    <div className="grid grid-cols-5 gap-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            setTextColor(color);
                            execCommand('foreColor', color);
                          }}
                        />
                      ))}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Separator orientation="vertical" className="h-5 mx-1" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                      <AlignLeft className="w-4 h-4" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => execCommand('justifyLeft')}>
                      <AlignLeft className="w-4 h-4 mr-2" /> Left
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('justifyCenter')}>
                      <AlignCenter className="w-4 h-4 mr-2" /> Center
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('justifyRight')}>
                      <AlignRight className="w-4 h-4 mr-2" /> Right
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('insertOrderedList')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <ListOrdered className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Numbered list</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('insertUnorderedList')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Bulleted list</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('outdent')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <IndentDecrease className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Decrease indent</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => execCommand('indent')}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
                    >
                      <IndentIncrease className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Increase indent</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1">
              {/* Send Button with Dropdown */}
              <div className="flex items-center">
                <Button
                  onClick={() => onSend(attachments)}
                  disabled={sending || !to.trim()}
                  className="rounded-l-full rounded-r-none bg-blue-600 hover:bg-blue-700 text-white px-5 h-9"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Send'
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={sending}
                      className="rounded-l-none rounded-r-full bg-blue-600 hover:bg-blue-700 text-white px-2 h-9 border-l border-blue-500"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setShowScheduleDialog(true)}>
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule send
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Additional Actions */}
              <div className="flex items-center gap-0.5 ml-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setShowFormattingBar(!showFormattingBar)}
                      className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full ${showFormattingBar ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      <span className="text-lg font-serif">Aa</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Toggle formatting options</TooltipContent>
                </Tooltip>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Attach files</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setShowLinkDialog(true)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"
                    >
                      <Link2 className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Insert link</TooltipContent>
                </Tooltip>
                
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                      <Smile className="w-5 h-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0" align="start" side="top">
                    <Picker 
                      data={data} 
                      onEmojiSelect={handleEmojiSelect}
                      theme="light"
                      previewPosition="none"
                      skinTonePosition="none"
                    />
                  </PopoverContent>
                </Popover>
                
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => imageInputRef.current?.click()}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"
                    >
                      <Image className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Insert photo</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => setShowConfidentialDialog(true)}
                      className={`p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full ${isConfidential ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      <Lock className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Confidential mode</TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={handleInsertSignature}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"
                    >
                      <PenTool className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Insert signature</TooltipContent>
                </Tooltip>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => execCommand('removeFormat')}>
                      Remove formatting
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => execCommand('selectAll')}>
                      Select all
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => toast.info('Print preview coming soon')}>
                      Print
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Discard Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button 
                  onClick={handleDiscard}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Discard draft</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Link</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="link-text">Text to display</Label>
              <Input
                id="link-text"
                placeholder="Link text (optional)"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link-url">Web address (URL)</Label>
              <Input
                id="link-url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>Cancel</Button>
            <Button onClick={handleInsertLink}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Send Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Send
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <CalendarComponent
                mode="single"
                selected={scheduleDate}
                onSelect={setScheduleDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <Input
                  id="schedule-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
            {scheduleDate && (
              <p className="text-sm text-slate-500">
                Scheduled for: {scheduleDate.toLocaleDateString()} at {scheduleTime}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
            <Button onClick={handleScheduleSend} disabled={!scheduleDate}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confidential Mode Dialog */}
      <Dialog open={showConfidentialDialog} onOpenChange={setShowConfidentialDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-blue-600" />
              Confidential Mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Protect your message by setting an expiration date. Recipients won't be able to forward, copy, print, or download this email.
            </p>
            <div className="space-y-2">
              <Label>Set expiration</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    {confidentialExpiry}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-full">
                  <DropdownMenuItem onClick={() => setConfidentialExpiry('1 day')}>1 day</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfidentialExpiry('1 week')}>1 week</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfidentialExpiry('1 month')}>1 month</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfidentialExpiry('3 months')}>3 months</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setConfidentialExpiry('5 years')}>5 years</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfidentialDialog(false)}>Cancel</Button>
            <Button onClick={handleConfidentialMode}>Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GmailComposeDialog;
