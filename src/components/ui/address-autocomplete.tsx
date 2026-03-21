import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapPin } from 'lucide-react';

/* ── Pulsing dots loading indicator ── */
function PulsingDots() {
  return (
    <div className="flex items-center gap-[3px] absolute right-2.5 top-1/2 -translate-y-1/2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="block h-[5px] w-[5px] rounded-full bg-violet-500"
          style={{
            animation: 'addressPulse 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes addressPulse {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// ── Types ──
export interface ParsedAddress {
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
}

interface Suggestion {
  id: string;
  mainText: string;
  secondaryText: string;
  parsed: ParsedAddress;
}

interface AddressAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (address: ParsedAddress) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

// ── US state name → abbreviation ──
const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

function abbrState(fullName: string): string {
  return STATE_ABBR[fullName] ?? fullName;
}

// ── Nominatim response types ──
interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country?: string;
    country_code?: string;
  };
}

function parseNominatimResult(r: NominatimResult): ParsedAddress {
  const a = r.address;
  const houseNumber = a.house_number ?? '';
  const road = a.road ?? '';
  const city = a.city ?? a.town ?? a.village ?? a.hamlet ?? a.municipality ?? '';
  const state = a.state ? abbrState(a.state) : '';
  const zip = a.postcode ?? '';

  return {
    address_line_1: [houseNumber, road].filter(Boolean).join(' '),
    city,
    state,
    zip_code: zip,
    country: a.country_code?.toUpperCase(),
  };
}

function buildSuggestion(r: NominatimResult, index: number): Suggestion {
  const parsed = parseNominatimResult(r);
  const mainText = parsed.address_line_1 || r.display_name.split(',')[0];
  const parts = [parsed.city, parsed.state, parsed.zip_code].filter(Boolean);
  const secondaryText = parts.join(', ');

  return {
    id: `${r.place_id}-${index}`,
    mainText,
    secondaryText,
    parsed,
  };
}

// ── Component ──
export function AddressAutocompleteInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  className = '',
  autoFocus = false,
  disabled = false,
}: AddressAutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);

  // Update dropdown position based on input location
  const updateDropdownPos = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  // Click outside handler — checks both input and portal dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPos();
    window.addEventListener('scroll', updateDropdownPos, true);
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      window.removeEventListener('scroll', updateDropdownPos, true);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [showDropdown, updateDropdownPos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Fetch suggestions from Nominatim
  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: input,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'us',
        email: 'admin@commerciallendingx.com',
      });

      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

      const data: NominatimResult[] = await res.json();
      const mapped = data
        .filter(r => r.address?.road)
        .map((r, i) => buildSuggestion(r, i));

      setSuggestions(mapped);
      if (mapped.length > 0) {
        updateDropdownPos();
        setShowDropdown(true);
      } else {
        setShowDropdown(false);
      }
      setActiveIndex(-1);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      console.error('Address autocomplete error:', err);
      setSuggestions([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, [updateDropdownPos]);

  // Handle input change with debounce — show loading immediately, fetch after short delay
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Show loading indicator immediately when user has typed enough
    if (val.length >= 3) {
      setLoading(true);
    } else {
      setLoading(false);
      setSuggestions([]);
      setShowDropdown(false);
    }

    debounceRef.current = setTimeout(() => fetchSuggestions(val), 250);
  };

  // Select a suggestion
  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setShowDropdown(false);
    onChange(suggestion.parsed.address_line_1);
    onSelect(suggestion.parsed);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (showDropdown && suggestions.length > 0 && activeIndex >= 0) {
        // Select the highlighted suggestion
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
      } else if (value.length >= 3 && !showDropdown) {
        // Force immediate fetch when no suggestions visible yet
        e.preventDefault();
        if (debounceRef.current) clearTimeout(debounceRef.current);
        fetchSuggestions(value);
      }
      return;
    }

    if (!showDropdown || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-suggestion]');
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const dropdown = showDropdown && suggestions.length > 0
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
          }}
          className="z-[9999] bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.id}
              data-suggestion
              onClick={() => handleSelectSuggestion(s)}
              className={`flex items-start gap-2.5 w-full text-left px-3 py-2 text-[13px] transition-colors ${
                i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
              }`}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span className="font-medium text-foreground block truncate">{s.mainText}</span>
                <span className="text-xs text-muted-foreground block truncate">{s.secondaryText}</span>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) { updateDropdownPos(); setShowDropdown(true); } }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          disabled={disabled}
          className={className}
          autoComplete="off"
        />
        {loading && <PulsingDots />}
      </div>
      {dropdown}
    </div>
  );
}
