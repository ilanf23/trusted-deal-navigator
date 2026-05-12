import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Phone,
  PhoneOutgoing,
  Loader2,
  Building2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCall } from '@/contexts/CallContext';

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  company_name: string | null;
}

interface OutboundCallCardProps {
  initialPhone?: string;
  initialLeadId?: string;
}

const formatPhoneNumber = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
};

const formatPhoneAsYouType = (value: string) => {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

// Treat the query as a "name search" if it contains any letter character.
// Pure digit / formatting characters are interpreted as a phone number to dial.
const looksLikeNameQuery = (q: string) => /[a-z]/i.test(q);

export const OutboundCallCard = ({ initialPhone, initialLeadId }: OutboundCallCardProps) => {
  const { makeOutboundCall, outboundCall, isConnected, healthStatus } = useCall();
  const isCallInProgress = outboundCall !== null || isConnected;

  // The text the user has typed. Either a partial name search or a phone number.
  const [query, setQuery] = useState<string>(() =>
    initialPhone ? formatPhoneAsYouType(initialPhone) : '',
  );

  // When the user picks a contact from the dropdown we lock onto it: the input
  // displays the contact's name, and the call uses the contact's phone + id so
  // the call attribution works downstream.
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Seed selection if the parent passed an initialLeadId (deep link from a
  // pipeline row "Call" button). We still let the user clear it.
  useEffect(() => {
    if (!initialLeadId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('potential')
        .select('id, name, phone, company_name')
        .eq('id', initialLeadId)
        .maybeSingle();
      if (!cancelled && data) {
        setSelectedContact(data as Contact);
        setQuery((data as Contact).name);
      }
    })();
    return () => { cancelled = true; };
  }, [initialLeadId]);

  // Close results when the user clicks outside the card body.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const isNameSearch = looksLikeNameQuery(query);

  // Pull contacts matching the query. The query is debounced via React Query's
  // queryKey — we re-fetch on every keystroke but the staleTime keeps it cheap.
  const { data: contacts = [], isFetching } = useQuery({
    queryKey: ['outbound-contact-search', query.trim().toLowerCase()],
    queryFn: async () => {
      const trimmed = query.trim();
      let q = supabase
        .from('potential')
        .select('id, name, phone, company_name')
        .not('phone', 'is', null)
        .order('name', { ascending: true })
        .limit(25);
      if (trimmed.length > 0) {
        q = q.or(`name.ilike.%${trimmed}%,company_name.ilike.%${trimmed}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
    enabled: isNameSearch || query.length === 0,
    staleTime: 30_000,
  });

  const visibleContacts = useMemo(() => contacts, [contacts]);

  // Reset highlight whenever the result set changes so arrow-key nav starts at the top.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [visibleContacts.length, showResults]);

  const handleQueryChange = (raw: string) => {
    setShowResults(true);
    if (looksLikeNameQuery(raw)) {
      // Name search — keep the raw text, drop any contact lock once the user
      // starts typing a different name.
      setQuery(raw);
      if (selectedContact && raw !== selectedContact.name) {
        setSelectedContact(null);
      }
    } else {
      // Phone number — apply as-you-type formatting and clear any selection.
      setQuery(formatPhoneAsYouType(raw));
      setSelectedContact(null);
    }
  };

  const handlePickContact = (contact: Contact) => {
    setSelectedContact(contact);
    setQuery(contact.name);
    setShowResults(false);
  };

  const handleClearSelection = () => {
    setSelectedContact(null);
    setQuery('');
    setShowResults(false);
  };

  const handleCall = () => {
    if (selectedContact?.phone) {
      makeOutboundCall(selectedContact.phone, selectedContact.id, selectedContact.name);
      return;
    }
    // No contact picked — fall back to whatever phone string the user typed.
    if (!query || isNameSearch) {
      toast.error('Pick a contact or enter a phone number');
      return;
    }
    makeOutboundCall(query);
    setQuery('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showResults && visibleContacts.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, visibleContacts.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const pick = visibleContacts[highlightedIndex];
        if (pick) handlePickContact(pick);
        return;
      }
      if (e.key === 'Escape') {
        setShowResults(false);
        return;
      }
    }
    if (e.key === 'Enter' && !isCallInProgress) {
      handleCall();
    }
  };

  const callDisabled =
    isCallInProgress ||
    !healthStatus.deviceReady ||
    (selectedContact ? !selectedContact.phone : !query || isNameSearch);

  return (
    <Card className="border-2 border-admin-blue/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-admin-blue/10">
            <PhoneOutgoing className="h-5 w-5 text-admin-blue" />
          </div>
          <div>
            <CardTitle className="text-lg">Make a Call</CardTitle>
            <CardDescription>
              {healthStatus.deviceReady
                ? 'Search a name or enter a number'
                : 'Connecting phone system...'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2" ref={containerRef}>
          <Label htmlFor="phone-input">Name or Phone Number</Label>
          <div className="relative">
            <Input
              id="phone-input"
              type="text"
              autoComplete="off"
              placeholder="Search by name or type a number"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleInputKeyDown}
              disabled={isCallInProgress}
              className="pr-8"
            />
            {query.length > 0 && !isCallInProgress && (
              <button
                type="button"
                onClick={handleClearSelection}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Suggestions dropdown — only opens when the user is searching by
                name (or hasn't typed anything yet). For a typed phone number,
                hide the dropdown so the user can dial without distraction.
                Visual language: flat design, slate neutrals, no gradients, no
                heavy shadows. Each row reads as a 3-zone grid: identity (avatar
                + name + company stacked) on the left, phone right-aligned with
                tabular numerals so 10-digit numbers never truncate. Active row
                uses a subtle slate tint instead of a saturated highlight. */}
            {showResults && (isNameSearch || query.length === 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-sm max-h-80 overflow-auto">
                {isFetching ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : visibleContacts.length === 0 ? (
                  <div className="text-center py-6 px-4 text-xs text-muted-foreground">
                    {query.trim().length > 0
                      ? 'No contacts match'
                      : 'Type a name to search'}
                  </div>
                ) : (
                  <ul role="listbox" aria-label="Matching contacts" className="py-1">
                    {visibleContacts.map((c, i) => {
                      const isActive = i === highlightedIndex;
                      const initial = c.name.charAt(0).toUpperCase();
                      return (
                        <li key={c.id} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              // mouseDown so the input doesn't lose focus and
                              // close the dropdown before the click registers.
                              e.preventDefault();
                              handlePickContact(c);
                            }}
                            onMouseEnter={() => setHighlightedIndex(i)}
                            className={`group w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors duration-150 ${
                              isActive ? 'bg-slate-100 dark:bg-slate-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 ring-1 ring-slate-200 dark:ring-slate-700 flex items-center justify-center flex-shrink-0">
                              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                {initial}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate leading-tight">
                                {c.name}
                              </p>
                              {c.company_name && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground truncate flex items-center gap-1 leading-tight">
                                  <Building2 className="h-3 w-3 flex-shrink-0" />
                                  <span className="truncate">{c.company_name}</span>
                                </p>
                              )}
                            </div>
                            {c.phone && (
                              <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap flex-shrink-0">
                                {formatPhoneNumber(c.phone)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Selected contact pill — confirms which person you're about to call. */}
          {selectedContact && (
            <div className="flex items-center justify-between rounded-md border border-admin-blue/30 bg-admin-blue/5 px-3 py-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium truncate">{selectedContact.name}</p>
                <p className="text-muted-foreground truncate">
                  {selectedContact.phone ? formatPhoneNumber(selectedContact.phone) : 'No phone'}
                  {selectedContact.company_name ? ` · ${selectedContact.company_name}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear contact"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        <Button
          onClick={handleCall}
          disabled={callDisabled}
          className="w-full"
        >
          {!healthStatus.deviceReady ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : isCallInProgress ? (
            <>
              <Phone className="h-4 w-4 mr-2 animate-pulse" />
              Call in Progress
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 mr-2" />
              {selectedContact ? `Call ${selectedContact.name}` : 'Call Now'}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
