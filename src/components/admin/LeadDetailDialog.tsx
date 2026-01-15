import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, Phone, Building2, Calendar, FileText, User, DollarSign, Clock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadResponse = Database['public']['Tables']['lead_responses']['Row'];
type LeadStatus = Database['public']['Enums']['lead_status'];

const statusColors: Record<LeadStatus, string> = {
  discovery: 'bg-blue-100 text-blue-800',
  pre_qualification: 'bg-cyan-100 text-cyan-800',
  document_collection: 'bg-yellow-100 text-yellow-800',
  underwriting: 'bg-orange-100 text-orange-800',
  approval: 'bg-green-100 text-green-800',
  funded: 'bg-purple-100 text-purple-800',
};

interface LeadDetailDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadUpdated?: () => void;
}

const LeadDetailDialog = ({ lead, open, onOpenChange, onLeadUpdated }: LeadDetailDialogProps) => {
  const [responses, setResponses] = useState<LeadResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (lead && open) {
      setNotes(lead.notes || '');
      fetchResponses();
    }
  }, [lead, open]);

  const fetchResponses = async () => {
    if (!lead) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lead_responses')
        .select('*')
        .eq('lead_id', lead.id)
        .maybeSingle();

      if (error) throw error;
      setResponses(data);
    } catch (error) {
      console.error('Error fetching responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!lead) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes })
        .eq('id', lead.id);

      if (error) throw error;
      toast({ title: 'Notes saved', description: 'Lead notes have been updated.' });
      onLeadUpdated?.();
    } catch (error) {
      console.error('Error saving notes:', error);
      toast({ title: 'Error', description: 'Failed to save notes', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  if (!lead) return null;

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="w-5 h-5" />
            {lead.name}
            <Badge className={statusColors[lead.status]}>{lead.status.replace('_', ' ')}</Badge>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Information</h3>
                <div className="space-y-2">
                  {lead.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${lead.email}`} className="text-primary hover:underline">{lead.email}</a>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                    </div>
                  )}
                  {lead.company_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {lead.company_name}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Added:</span>
                    <span>{formatDate(lead.created_at)}</span>
                  </div>
                  {lead.questionnaire_sent_at && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Questionnaire Sent:</span>
                      <span>{formatDate(lead.questionnaire_sent_at)}</span>
                    </div>
                  )}
                  {lead.questionnaire_completed_at && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-green-600" />
                      <span className="text-muted-foreground">Completed:</span>
                      <span>{formatDate(lead.questionnaire_completed_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* How We Met */}
            {lead.source && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">How We Met</h3>
                  <p className="text-sm">{lead.source}</p>
                </div>
              </>
            )}

            {/* Notes Section */}
            <Separator />
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Notes</h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                className="min-h-[100px]"
              />
              <Button onClick={handleSaveNotes} disabled={savingNotes} size="sm">
                {savingNotes ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Notes
              </Button>
            </div>

            {/* Questionnaire Responses */}
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Questionnaire Responses
              </h3>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !responses ? (
                <div className="text-center py-8 text-muted-foreground bg-muted/50 rounded-lg">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No questionnaire responses yet</p>
                  {!lead.questionnaire_sent_at && (
                    <p className="text-sm mt-1">Questionnaire has not been sent to this lead.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Loan Details */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-primary" />
                      Loan Details
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Loan Amount:</span>
                        <p className="font-medium">{formatCurrency(responses.loan_amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Loan Type:</span>
                        <p className="font-medium">{responses.loan_type || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Purpose:</span>
                        <p className="font-medium">{responses.purpose_of_loan || responses.funding_purpose || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Funding Timeline:</span>
                        <p className="font-medium">{responses.funding_timeline || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Desired Term:</span>
                        <p className="font-medium">{responses.desired_term || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Desired Interest Rate:</span>
                        <p className="font-medium">{responses.desired_interest_rate || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Business Info */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      Business Information
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Business Type:</span>
                        <p className="font-medium">{responses.business_type || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Year Founded:</span>
                        <p className="font-medium">{responses.year_business_founded || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Annual Revenue:</span>
                        <p className="font-medium">{responses.annual_revenue || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Principal Name:</span>
                        <p className="font-medium">{responses.principal_name || 'N/A'}</p>
                      </div>
                      {responses.business_description && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Business Description:</span>
                          <p className="font-medium">{responses.business_description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Credit & Financial */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      Credit & Financial
                    </h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Borrower Credit Score:</span>
                        <p className="font-medium">{responses.borrower_credit_score || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Co-Borrower Credit Score:</span>
                        <p className="font-medium">{responses.co_borrower_credit_score || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Borrower Bankruptcy:</span>
                        <p className="font-medium">{responses.borrower_bankruptcy || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Co-Borrower Bankruptcy:</span>
                        <p className="font-medium">{responses.co_borrower_bankruptcy || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Collateral Info */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Collateral & Property</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Collateral Value:</span>
                        <p className="font-medium">{formatCurrency(responses.collateral_value)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current Estimated Value:</span>
                        <p className="font-medium">{formatCurrency(responses.current_estimated_value)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Purchase Price:</span>
                        <p className="font-medium">{formatCurrency(responses.purchase_price)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Year Acquired:</span>
                        <p className="font-medium">{responses.year_acquired || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Square Footage:</span>
                        <p className="font-medium">{responses.square_footage || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Number of Units:</span>
                        <p className="font-medium">{responses.number_of_units || 'N/A'}</p>
                      </div>
                      {responses.collateral_description && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Description:</span>
                          <p className="font-medium">{responses.collateral_description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current Loan Info */}
                  {(responses.current_lender || responses.current_loan_balance) && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Current Loan</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Current Lender:</span>
                          <p className="font-medium">{responses.current_lender || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Current Balance:</span>
                          <p className="font-medium">{formatCurrency(responses.current_loan_balance)}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Current Rate:</span>
                          <p className="font-medium">{responses.current_loan_rate || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">In Default:</span>
                          <p className="font-medium">{responses.current_loan_in_default || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact Details from Response */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <h4 className="font-medium">Contact Details (from questionnaire)</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <p className="font-medium">{responses.first_name} {responses.last_name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium">{responses.email || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium">{responses.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Preferred Contact:</span>
                        <p className="font-medium">{responses.contact_method || 'N/A'}</p>
                      </div>
                      {responses.address_line_1 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Address:</span>
                          <p className="font-medium">
                            {responses.address_line_1}
                            {responses.address_line_2 && `, ${responses.address_line_2}`}
                            <br />
                            {responses.city}, {responses.state} {responses.zip_code}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional Info */}
                  {(responses.additional_information || responses.how_did_you_hear || responses.referred_by) && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <h4 className="font-medium">Additional Information</h4>
                      <div className="space-y-2 text-sm">
                        {responses.how_did_you_hear && (
                          <div>
                            <span className="text-muted-foreground">How They Heard About Us:</span>
                            <p className="font-medium">{responses.how_did_you_hear}</p>
                          </div>
                        )}
                        {responses.referred_by && (
                          <div>
                            <span className="text-muted-foreground">Referred By:</span>
                            <p className="font-medium">{responses.referred_by}</p>
                          </div>
                        )}
                        {responses.additional_information && (
                          <div>
                            <span className="text-muted-foreground">Additional Notes:</span>
                            <p className="font-medium">{responses.additional_information}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDetailDialog;
