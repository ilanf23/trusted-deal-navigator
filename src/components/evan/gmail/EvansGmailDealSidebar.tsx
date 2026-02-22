import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mail, Phone, Users, Building, User, Plus, Maximize2, FileText, Loader2 } from 'lucide-react';
import { GmailEmail } from '@/components/gmail/gmailHelpers';
import type { EvansGmailLogic } from '@/hooks/useEvansGmailLogic';

interface EvansGmailDealSidebarProps {
  selectedLead: any;
  selectedEmail: GmailEmail;
  logic: EvansGmailLogic;
}

export function EvansGmailDealSidebar({ selectedLead, selectedEmail, logic }: EvansGmailDealSidebarProps) {
  const {
    updateLeadMutation,
    updateStageMutation,
    pipelineStages,
    setSelectedLeadIdForDetail,
    setLeadDetailOpen,
    generatingDraftForId,
    handleMoveForward,
  } = logic;

  return (
    <div className="w-80 border-l border-border bg-background dark:bg-slate-900 overflow-y-auto">
      {/* Header Title */}
      <div className="px-3 pt-3 pb-2">
        <h3 className="text-sm font-semibold text-foreground">CRM Lead Info</h3>
      </div>
      {/* Stage and Assignment Row */}
      <div className="px-3 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Stage</p>
            <Select
              value={selectedLead.pipeline_leads?.[0]?.stage_id || ''}
              onValueChange={(value) => {
                updateStageMutation.mutate({ leadId: selectedLead.id, stageId: value });
              }}
            >
              <SelectTrigger className="h-8 w-[130px] text-sm bg-background">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: selectedLead.pipeline_leads?.[0]?.pipeline_stages?.color || '#0066FF' }}
                  />
                  <SelectValue placeholder="Select stage">
                    {selectedLead.pipeline_leads?.[0]?.pipeline_stages?.name || 'Discovery'}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {pipelineStages.map((stage: any) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#0066FF' }} />
                      {stage.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 bg-emerald-600">
                <AvatarFallback className="text-xs text-white bg-emerald-600">E</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground">Evan</span>
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => {
            setSelectedLeadIdForDetail(selectedLead.id);
            setLeadDetailOpen(true);
          }}
          title="View full details"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="h-[calc(100%-70px)]">
        <div className="p-4 space-y-2">
          {/* Contact Info Section */}
          <div className="py-2">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm text-foreground">Contact Info</span>
            </div>
            <div className="space-y-3 pl-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contact Name</p>
                <Input
                  className="h-8 text-sm bg-background"
                  defaultValue={selectedLead.name}
                  onBlur={(e) => {
                    if (e.target.value !== selectedLead.name) {
                      updateLeadMutation.mutate({ leadId: selectedLead.id, updates: { name: e.target.value } });
                    }
                  }}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Known As</p>
                <Input
                  className="h-8 text-sm bg-background"
                  placeholder="Nickname or alias"
                  defaultValue={selectedLead.known_as || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedLead.known_as || '')) {
                      updateLeadMutation.mutate({ leadId: selectedLead.id, updates: { known_as: e.target.value || null } });
                    }
                  }}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Company</p>
                <Input
                  className="h-8 text-sm bg-background"
                  placeholder="Company name"
                  defaultValue={selectedLead.company_name || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedLead.company_name || '')) {
                      updateLeadMutation.mutate({ leadId: selectedLead.id, updates: { company_name: e.target.value || null } });
                    }
                  }}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Title</p>
                <Input
                  className="h-8 text-sm bg-background"
                  placeholder="Job title"
                  defaultValue={selectedLead.title || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (selectedLead.title || '')) {
                      updateLeadMutation.mutate({ leadId: selectedLead.id, updates: { title: e.target.value || null } });
                    }
                  }}
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Contact Type</p>
                <Select
                  value={selectedLead.contact_type || 'potential_customer'}
                  onValueChange={(value) => {
                    updateLeadMutation.mutate({ leadId: selectedLead.id, updates: { contact_type: value } });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="potential_customer">Potential Customer</SelectItem>
                    <SelectItem value="existing_customer">Existing Customer</SelectItem>
                    <SelectItem value="referral_partner">Referral Partner</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="lender">Lender</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contacts Section */}
          <div className="py-2">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm text-foreground">Contacts</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {selectedLead.lead_contacts?.length || 0}
              </Badge>
            </div>
            <div className="space-y-2 pl-6">
              {(!selectedLead.lead_contacts || selectedLead.lead_contacts.length === 0) ? (
                <p className="text-sm text-muted-foreground italic">No contacts added yet</p>
              ) : (
                selectedLead.lead_contacts.map((contact: any) => (
                  <div key={contact.id} className="py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{contact.name}</p>
                      {contact.is_primary && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Primary</Badge>
                      )}
                    </div>
                    {contact.title && (
                      <p className="text-xs text-muted-foreground">{contact.title}</p>
                    )}
                    <div className="flex flex-wrap gap-3 mt-1">
                      {contact.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span>{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              <Button variant="link" className="text-primary text-sm p-0 h-auto">
                <Plus className="w-4 h-4 mr-1" />
                Add contact
              </Button>
            </div>
          </div>

          <Separator />

          {/* Phone Numbers Section */}
          <div className="py-2">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm text-foreground">Phone Numbers</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {(selectedLead.lead_phones?.length || 0) + (selectedLead.phone && !selectedLead.lead_phones?.length ? 1 : 0)}
              </Badge>
            </div>
            <div className="space-y-2 pl-6">
              {selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                <div className="py-1">
                  <p className="text-sm text-foreground">{selectedLead.phone}</p>
                  <p className="text-xs text-muted-foreground">Primary</p>
                </div>
              )}
              {selectedLead.lead_phones?.map((phone: any) => (
                <div key={phone.id} className="py-1">
                  <p className="text-sm text-foreground">{phone.phone_number}</p>
                  <p className="text-xs text-muted-foreground capitalize">{phone.phone_type || 'Primary'}</p>
                </div>
              ))}
              {!selectedLead.phone && (!selectedLead.lead_phones || selectedLead.lead_phones.length === 0) && (
                <p className="text-sm text-muted-foreground italic">No phone numbers</p>
              )}
              <Button variant="link" className="text-primary text-sm p-0 h-auto">
                <Plus className="w-4 h-4 mr-1" />
                Add phone
              </Button>
            </div>
          </div>

          <Separator />

          {/* Email Addresses Section */}
          <div className="py-2">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm text-foreground">Email Addresses</span>
              <Badge variant="secondary" className="ml-auto text-xs">
                {(selectedLead.lead_emails?.length || 0) + (selectedLead.email && !selectedLead.lead_emails?.length ? 1 : 0)}
              </Badge>
            </div>
            <div className="space-y-2 pl-6">
              {selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                <div className="py-1">
                  <p className="text-sm text-foreground">{selectedLead.email}</p>
                  <p className="text-xs text-muted-foreground">Primary</p>
                </div>
              )}
              {selectedLead.lead_emails?.map((email: any) => (
                <div key={email.id} className="py-1">
                  <p className="text-sm text-foreground">{email.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{email.email_type || 'Primary'}</p>
                </div>
              ))}
              {!selectedLead.email && (!selectedLead.lead_emails || selectedLead.lead_emails.length === 0) && (
                <p className="text-sm text-muted-foreground italic">No email addresses</p>
              )}
              <Button variant="link" className="text-primary text-sm p-0 h-auto">
                <Plus className="w-4 h-4 mr-1" />
                Add email
              </Button>
            </div>
          </div>

          <Separator />

          {/* Action Button */}
          <div className="pt-4">
            <Button
              className="w-full bg-[#0066FF]/80 hover:bg-[#0052CC]/80 text-white"
              onClick={(e) => {
                e.stopPropagation();
                handleMoveForward(selectedEmail);
              }}
              disabled={generatingDraftForId === selectedEmail.id}
            >
              {generatingDraftForId === selectedEmail.id ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileText className="w-4 h-4 mr-2" />
              )}
              Move Forward
            </Button>
          </div>

          {/* Quick Notes */}
          {selectedLead.notes && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-muted-foreground tracking-wider mb-2">NOTES</p>
              <p className="text-sm text-foreground/80 leading-relaxed">{selectedLead.notes}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
