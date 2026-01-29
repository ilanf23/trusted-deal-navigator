import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Phone, 
  PhoneOutgoing, 
  Loader2, 
  User,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { useCall } from '@/contexts/CallContext';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  company_name: string | null;
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
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
};

export const OutboundCallCard = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dial' | 'contacts'>('dial');
  
  const { makeOutboundCall, outboundCall, isConnected, healthStatus } = useCall();
  const isCallInProgress = outboundCall !== null || isConnected;

  // Fetch leads with phone numbers for contact list
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['leads-with-phones', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('leads')
        .select('id, name, phone, company_name')
        .not('phone', 'is', null)
        .order('name', { ascending: true })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.or(`name.ilike.%${searchQuery}%,company_name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Lead[];
    },
  });

  const handleDialpadCall = () => {
    if (!phoneNumber) {
      toast.error('Please enter a phone number');
      return;
    }
    makeOutboundCall(phoneNumber);
    setPhoneNumber('');
  };

  const handleContactCall = (lead: Lead) => {
    if (!lead.phone) {
      toast.error('This contact has no phone number');
      return;
    }
    makeOutboundCall(lead.phone, lead.id, lead.name);
  };

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
                ? 'Dial a number or select a contact' 
                : 'Connecting phone system...'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tab Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant={activeTab === 'dial' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('dial')}
            className="flex-1 min-w-0"
          >
            <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Dial</span>
          </Button>
          <Button
            variant={activeTab === 'contacts' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('contacts')}
            className="flex-1 min-w-0"
          >
            <User className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="truncate">Contacts</span>
          </Button>
        </div>

        {activeTab === 'dial' ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="phone-input">Phone Number</Label>
              <Input
                id="phone-input"
                type="tel"
                placeholder="(555) 123-4567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneAsYouType(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && phoneNumber && !isCallInProgress) {
                    handleDialpadCall();
                  }
                }}
                disabled={isCallInProgress}
              />
            </div>
            <Button
              onClick={handleDialpadCall}
              disabled={!phoneNumber || isCallInProgress || !healthStatus.deviceReady}
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
                  Call Now
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <ScrollArea className="h-[200px]">
              {leadsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : leads.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {searchQuery ? 'No contacts found' : 'No contacts with phone numbers'}
                </div>
              ) : (
                <div className="space-y-1">
                  {leads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => handleContactCall(lead)}
                      disabled={isCallInProgress || !healthStatus.deviceReady}
                      className="w-full p-3 rounded-lg hover:bg-muted/50 transition-colors text-left flex items-center gap-3 disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-admin-blue to-admin-blue-dark flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold">
                          {lead.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{lead.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {lead.company_name && (
                            <span className="flex items-center gap-1 truncate">
                              <Building2 className="h-3 w-3" />
                              {lead.company_name}
                            </span>
                          )}
                        </div>
                        {lead.phone && (
                          <p className="text-xs text-muted-foreground">
                            {formatPhoneNumber(lead.phone)}
                          </p>
                        )}
                      </div>
                      <PhoneOutgoing className="h-4 w-4 text-admin-blue flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
