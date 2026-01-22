import React, { useState } from 'react';
import { 
  X, Minus, Maximize2, ChevronDown,
  Undo2, Redo2, Bold, Italic, Underline, 
  AlignLeft, List, ListOrdered, IndentDecrease, IndentIncrease,
  Type, Paperclip, Link2, Smile, Image, Lock, PenTool,
  MoreVertical, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

interface GmailComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  to: string;
  onToChange: (value: string) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  onSend: () => void;
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

  if (!isOpen) return null;

  const handleDiscard = () => {
    onToChange('');
    onSubjectChange('');
    onBodyChange('');
    onClose();
  };

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
    <div 
      className={`fixed bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col ${
        isMaximized 
          ? 'inset-4 rounded-xl' 
          : 'bottom-0 right-20 w-[560px] h-[520px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 dark:bg-slate-800 rounded-t-xl border-b border-slate-200 dark:border-slate-700">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
          New Message
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
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 px-4 py-3 overflow-auto">
          <div className="relative">
            {!body && (
              <div className="absolute top-0 left-0 flex items-center gap-1 text-sm text-slate-400 dark:text-slate-500 pointer-events-none">
                <span className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600 mr-1"></span>
                Press <span className="font-medium text-slate-500 dark:text-slate-400">/</span> for Help me write
              </div>
            )}
            <textarea
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              className="w-full h-full min-h-[200px] text-sm bg-transparent border-0 outline-none resize-none text-slate-900 dark:text-slate-100"
              style={{ caretColor: '#3b82f6' }}
            />
          </div>
        </div>

        {/* Formatting Toolbar */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <Undo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Undo</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <Redo2 className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Redo</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 px-2 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-sm text-slate-600 dark:text-slate-400">
                  Sans Serif
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Sans Serif</DropdownMenuItem>
                <DropdownMenuItem>Serif</DropdownMenuItem>
                <DropdownMenuItem>Monospace</DropdownMenuItem>
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
                <DropdownMenuItem>Small</DropdownMenuItem>
                <DropdownMenuItem>Normal</DropdownMenuItem>
                <DropdownMenuItem>Large</DropdownMenuItem>
                <DropdownMenuItem>Huge</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-5 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <Bold className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Bold</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <Italic className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Italic</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <Underline className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Underline</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <span className="text-sm font-medium underline decoration-2 decoration-red-500">A</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Text color</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-5 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <button className="flex items-center p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <AlignLeft className="w-4 h-4" />
                  <ChevronDown className="w-3 h-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Align</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <ListOrdered className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Numbered list</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <List className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Bulleted list</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <IndentDecrease className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Decrease indent</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400">
                  <IndentIncrease className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Increase indent</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1">
            {/* Send Button with Dropdown */}
            <div className="flex items-center">
              <Button
                onClick={onSend}
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
                  <DropdownMenuItem>Schedule send</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Additional Actions */}
            <div className="flex items-center gap-0.5 ml-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <span className="text-lg font-serif">Aa</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Formatting options</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <Paperclip className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Attach files</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <Link2 className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Insert link</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <Smile className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Insert emoji</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <Image className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Insert photo</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <Lock className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Confidential mode</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <PenTool className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Insert signature</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 dark:text-slate-400">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">More options</TooltipContent>
              </Tooltip>
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
  );
};

export default GmailComposeDialog;
