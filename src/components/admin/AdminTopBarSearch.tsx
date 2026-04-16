import { useState, useRef, useEffect, useCallback, type ChangeEvent } from 'react';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getRecentlyViewed, type RecentlyViewedEntry } from '@/lib/recentlyViewed';

interface AdminTopBarSearchProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

const AdminTopBarSearch = ({
  value,
  onChange,
  placeholder = 'Search deals, contacts, tasks...',
}: AdminTopBarSearchProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [recentItems, setRecentItems] = useState<RecentlyViewedEntry[]>([]);

  // Load recently viewed on focus
  useEffect(() => {
    if (isFocused) {
      setRecentItems(getRecentlyViewed());
    }
  }, [isFocused]);

  // Outside click to close
  useEffect(() => {
    if (!isFocused) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isFocused]);

  // Live search query (debounced via staleTime + enabled)
  const debouncedQuery = useDebounce(value, 300);
  const { data: searchResults = [] } = useQuery({
    queryKey: ['topbar-search', debouncedQuery],
    queryFn: async () => {
      const q = debouncedQuery.trim();
      if (!q) return [];
      const { data, error } = await supabase
        .from('people')
        .select('id, name, company_name, email, phone')
        .or(`name.ilike.%${q}%,company_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .order('updated_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        name: d.name,
        title: null as string | null,
        company: d.company_name,
      }));
    },
    enabled: debouncedQuery.trim().length > 0 && isFocused,
    staleTime: 5_000,
  });

  const handleSelect = useCallback((entry: RecentlyViewedEntry) => {
    setIsFocused(false);
    navigate(`/admin/contacts/people/expanded-view/${entry.id}`);
  }, [navigate]);

  const showDropdown = isFocused;
  const items = value.trim() ? searchResults : recentItems;
  const headerLabel = value.trim() ? 'Search Results' : 'Recently Viewed';

  return (
    <div ref={containerRef} className="relative w-full">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 z-10" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="16.5" y1="16.5" x2="22" y2="22" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        style={{ backgroundColor: isFocused ? '#fff' : '#e8ecf0', borderRadius: isFocused ? '12px 12px 0 0' : 9999, boxShadow: isFocused ? '0 2px 12px rgba(0,0,0,0.12)' : 'none' }}
        className="w-full h-[38px] pl-11 pr-5 border-0 text-base text-center text-foreground placeholder:text-[#9aa0a6] dark:placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 transition-colors"
      />

      {showDropdown && (
        <div
          className="absolute left-0 right-0 top-full bg-white border-t border-gray-100 shadow-lg z-50 max-h-[420px] overflow-y-auto"
          style={{ borderRadius: '0 0 12px 12px' }}
        >
          {items.length > 0 ? (
            <>
              <p className="px-5 pt-4 pb-2 text-[13px] font-bold text-gray-500">{headerLabel}</p>
              {items.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => handleSelect(entry)}
                  className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-[#e8ecf0] flex items-center justify-center text-gray-500 text-[13px] font-semibold shrink-0">
                    {getInitials(entry.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-gray-800 truncate">{entry.name}</p>
                    {(entry.title || entry.company) && (
                      <p className="text-[13px] text-gray-400 truncate">
                        {[entry.title, entry.company].filter(Boolean).join(' | ')}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </>
          ) : (
            <p className="px-5 py-6 text-[13px] text-gray-400 text-center">
              {value.trim() ? 'No results found' : 'No recently viewed contacts'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Simple debounce hook
function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default AdminTopBarSearch;
