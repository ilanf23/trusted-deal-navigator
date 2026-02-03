import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, User, Building2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LeadSuggestion {
  id: string;
  name: string;
  email: string | null;
  company_name: string | null;
}

interface RecipientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onLeadSelect?: (lead: LeadSuggestion) => void;
}

const RecipientAutocomplete: React.FC<RecipientAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Recipients',
  className,
  onLeadSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LeadSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search for leads when input changes
  const searchLeads = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, company_name')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,company_name.ilike.%${query}%`)
        .not('email', 'is', null)
        .limit(8);

      if (error) throw error;
      setSuggestions(data || []);
    } catch (err) {
      console.error('Error searching leads:', err);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchLeads(value);
    }, 200);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, searchLeads]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectSuggestion = (lead: LeadSuggestion) => {
    if (lead.email) {
      onChange(lead.email);
      onLeadSelect?.(lead);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
    setSuggestions([]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleFocus = () => {
    if (value.length >= 2 && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const showDropdown = isOpen && (suggestions.length > 0 || loading);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full text-sm bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 outline-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 transition-all",
          className
        )}
      />

      {/* Suggestions Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden"
        >
          {loading ? (
            <div className="px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Searching...
            </div>
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              {suggestions.map((lead, index) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => selectSuggestion(lead)}
                  className={cn(
                    "w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                    index === selectedIndex && "bg-blue-50 dark:bg-blue-900/20"
                  )}
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {lead.name}
                      </span>
                      {lead.company_name && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3" />
                          {lead.company_name}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-blue-600 dark:text-blue-400 truncate block">
                      {lead.email}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipientAutocomplete;
