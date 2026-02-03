import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Helper to format phone numbers to American format (XXX) XXX-XXXX
const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Handle different lengths
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === '1') {
    // Handle 1 + 10 digits (country code)
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if format doesn't match
  return phone;
};

// Strip formatting to get raw digits
const stripPhoneFormatting = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

interface FormattedPhoneInputProps {
  value: string;
  onSave: (newValue: string) => void;
  placeholder?: string;
  className?: string;
}

export const FormattedPhoneInput = ({
  value,
  onSave,
  placeholder = 'Phone number',
  className,
}: FormattedPhoneInputProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleFocus = () => {
    setIsEditing(true);
    // Keep the raw digits for editing
    setEditValue(stripPhoneFormatting(value));
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    const strippedOriginal = stripPhoneFormatting(value);
    const strippedNew = stripPhoneFormatting(trimmed);
    
    if (strippedNew !== strippedOriginal && strippedNew) {
      onSave(strippedNew);
    }
    // Reset to the original value if nothing changed
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
      inputRef.current?.blur();
    }
  };

  // Display formatted when not editing, raw digits when editing
  const displayValue = isEditing ? editValue : formatPhoneNumber(value);

  return (
    <Input
      ref={inputRef}
      value={displayValue}
      onChange={(e) => setEditValue(e.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={cn(
        "h-7 text-sm border-0 border-b border-transparent hover:border-border focus:border-blue-600 rounded-none px-0 focus-visible:ring-0",
        className
      )}
    />
  );
};

