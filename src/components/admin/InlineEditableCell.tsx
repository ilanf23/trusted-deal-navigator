import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface InlineEditableCellProps {
  value: string;
  onChange: (newValue: string) => void;
  type?: 'text' | 'select';
  options?: { id: string; label: string }[];
  placeholder?: string;
  className?: string;
  displayClassName?: string;
}

export const InlineEditableCell = ({
  value,
  onChange,
  type = 'text',
  options = [],
  placeholder = '—',
  className,
  displayClassName,
}: InlineEditableCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  if (type === 'select') {
    return (
      <div onClick={(e) => e.stopPropagation()} className="w-full">
        <Select
          value={value || 'none'}
          onValueChange={(newValue) => {
            if (newValue !== value && newValue !== 'none') {
              onChange(newValue);
            }
          }}
        >
          <SelectTrigger className={cn(
            "h-7 border-none bg-transparent shadow-none px-0 hover:bg-slate-100 dark:hover:bg-slate-700 focus:ring-0 focus:ring-offset-0 text-[12px]",
            className
          )}>
            <SelectValue placeholder={placeholder}>
              {options.find(o => o.id === value)?.label || placeholder}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-slate-800 z-50">
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id} className="text-sm">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "h-7 px-1 py-0 text-[13px] border-[#0066FF] focus-visible:ring-1 focus-visible:ring-[#0066FF] bg-white dark:bg-slate-800",
          className
        )}
      />
    );
  }

  return (
    <span
      onClick={handleClick}
      className={cn(
        "truncate block cursor-text hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1 py-0.5 -mx-1 transition-colors",
        displayClassName
      )}
      title="Click to edit"
    >
      {value || <span className="text-slate-400 italic">{placeholder}</span>}
    </span>
  );
};
