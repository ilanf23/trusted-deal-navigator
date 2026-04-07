import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

interface LeadData {
  id: string;
  name: string;
  company_name: string | null;
  ratewatch_questionnaire_completed_at: string | null;
}

const COLLATERAL_TYPES = [
  'Commercial Real Estate',
  'Multifamily',
  'Industrial',
  'Retail',
  'Office',
  'Mixed Use',
  'Land',
  'Equipment',
  'Accounts Receivable',
  'Inventory',
];

const LOAN_TYPES = [
  'Term Loan',
  'Line of Credit',
  'SBA 7(a)',
  'SBA 504',
  'Bridge Loan',
  'Construction Loan',
  'CMBS',
  'Life Company',
  'Agency (Fannie/Freddie)',
];

const RATE_TYPES = [
  'Fixed',
  'Variable',
];

const LENDER_TYPES = [
  'Bank',
  'Credit Union',
  'Private Lender',
  'SBA Lender',
  'Life Insurance Company',
  'CMBS',
  'Agency',
];

const IMPROVEMENT_OPTIONS = [
  'Lower Interest Rate',
  'Lower Monthly Payment',
  'Cash Out / Equity Release',
  'Extend Maturity Date',
  'Remove Prepayment Penalty',
  'Switch from Variable to Fixed',
  'Improve Amortization',
  'Consolidate Loans',
  'Better Terms / Covenants',
];

const RateWatchQuestionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Contact
    name: '',
    email: '',
    phone: '',
    
    // Loan Details
    loan_balance: '',
    collateral_type: '',
    collateral_type_other: '',
    collateral_value: '',
    current_rate: '',
    target_rate: '',
    loan_maturity: '',
    re_city_state: '',
    loan_type: '',
    loan_type_other: '',
    rate_type: '',
    variable_index_spread: '',
    original_term_years: '',
    amortization: '',
    prepayment_penalty: '',
    lender_type: '',
    lender_type_other: '',
    estimated_cash_flow: '',
    property_occupancy: '',
    
    // Goals
    improvements: [] as string[],
    improvements_other: '',
  });

  const updateField = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleImprovement = (improvement: string) => {
    setFormData(prev => ({
      ...prev,
      improvements: prev.improvements.includes(improvement)
        ? prev.improvements.filter(i => i !== improvement)
        : [...prev.improvements, improvement]
    }));
  };

  // Calculate progress
  const progress = useMemo(() => {
    const requiredFields = ['name', 'email', 'phone'];
    const filled = requiredFields.filter(f => !!formData[f as keyof typeof formData]).length;
    return Math.round((filled / requiredFields.length) * 100);
  }, [formData]);

  useEffect(() => {
    const validateToken = async () => {
      // Handle "new" case - no lead association needed
      if (token === 'new') {
        setLead({ id: '', name: '', company_name: null, ratewatch_questionnaire_completed_at: null });
        setLoading(false);
        return;
      }

      if (!token) {
        setError('Invalid questionnaire link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('pipeline')
          .select('id, name, company_name, ratewatch_questionnaire_completed_at')
          .eq('ratewatch_questionnaire_token', token)
          .maybeSingle();

        if (error || !data) {
          setError('This questionnaire link is invalid or has expired');
          setLoading(false);
          return;
        }

        if (data.ratewatch_questionnaire_completed_at) {
          setSubmitted(true);
        }

        setLead(data);
      } catch (err) {
        setError('An error occurred while loading the questionnaire');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name || !formData.email || !formData.phone) {
      toast({
        title: 'Please complete all required fields',
        description: 'Name, Email, and Phone are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Parse name into first/last
      const nameParts = formData.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Combine improvements with other
      const allImprovements = formData.improvements_other 
        ? [...formData.improvements, formData.improvements_other].join(', ')
        : formData.improvements.join(', ');

      // Get collateral type (with other)
      const collateralType = formData.collateral_type === 'Other' 
        ? formData.collateral_type_other 
        : formData.collateral_type;

      // Get loan type (with other)
      const loanType = formData.loan_type === 'Other' 
        ? formData.loan_type_other 
        : formData.loan_type;

      // Get lender type (with other)
      const lenderType = formData.lender_type === 'Other' 
        ? formData.lender_type_other 
        : formData.lender_type;

      let leadId = lead?.id;

      // If this is a "new" questionnaire (no existing lead), create the lead first
      if (token === 'new' || !leadId) {
        const { data: newLead, error: leadError } = await supabase
          .from('pipeline')
          .insert({
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            source: 'RateWatch Questionnaire',
            ratewatch_questionnaire_completed_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (leadError || !newLead) {
          throw new Error('Failed to create lead');
        }
        leadId = newLead.id;
      }

      const { error: insertError } = await supabase
        .from('ratewatch_questionnaire_responses')
        .insert({
          lead_id: leadId,
          first_name: firstName,
          last_name: lastName,
          email: formData.email,
          phone: formData.phone,
          loan_balance: formData.loan_balance ? parseFloat(formData.loan_balance) : null,
          collateral_type: collateralType || null,
          collateral_value: formData.collateral_value ? parseFloat(formData.collateral_value) : null,
          current_rate: formData.current_rate ? parseFloat(formData.current_rate) : null,
          target_rate: formData.target_rate ? parseFloat(formData.target_rate) : null,
          loan_maturity: formData.loan_maturity || null,
          re_city_state: formData.re_city_state || null,
          loan_type: loanType || null,
          rate_type: formData.rate_type || null,
          variable_index_spread: formData.variable_index_spread || null,
          original_term_years: formData.original_term_years ? parseFloat(formData.original_term_years) : null,
          amortization: formData.amortization || null,
          prepayment_penalty: formData.prepayment_penalty || null,
          lender_type: lenderType || null,
          estimated_cash_flow: formData.estimated_cash_flow ? parseFloat(formData.estimated_cash_flow) : null,
          property_occupancy: formData.property_occupancy || null,
          seeking_to_improve: allImprovements || null,
        });

      if (insertError) throw insertError;

      // Only update lead if it's an existing lead (not new)
      if (token !== 'new' && lead?.id) {
        await supabase
          .from('pipeline')
          .update({ ratewatch_questionnaire_completed_at: new Date().toISOString() })
          .eq('id', lead.id);
      }

      setSubmitted(true);
      toast({
        title: 'Thank you!',
        description: 'Your RateWatch enrollment has been submitted successfully.',
      });
    } catch (err: any) {
      console.error('Error submitting questionnaire:', err);
      toast({
        title: 'Submission failed',
        description: 'There was an error submitting your information. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold mb-2">Link Invalid</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Thank You!</h2>
            <p className="text-muted-foreground mb-4">
              Your RateWatch Concierge enrollment has been submitted successfully. Our team will monitor rates and contact you when opportunities arise.
            </p>
            <p className="text-sm text-muted-foreground">
              You can close this page now.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-10">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10 h-16 overflow-visible">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-6">
          <img src={logo} alt="CLX Commercial" className="h-[200px] w-auto object-contain -my-20" />
          <div>
            <h1 className="font-bold text-lg">CLX RateWatch Concierge</h1>
            <p className="text-xs text-muted-foreground">Please fill out this form to subscribe to the CLX RateWatch Concierge</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Progress value={progress} className="h-2" />
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Email */}
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input 
                  type="email" 
                  value={formData.email} 
                  onChange={(e) => updateField('email', e.target.value)} 
                  required
                />
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label>Please Enter Your Name *</Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => updateField('name', e.target.value)} 
                  placeholder="Your full name"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label>Please Enter Your Phone Number *</Label>
                <Input 
                  type="tel" 
                  value={formData.phone} 
                  onChange={(e) => updateField('phone', e.target.value)} 
                  required
                />
              </div>

              {/* Loan Balance */}
              <div className="space-y-2">
                <Label>What is your Current Loan Balance?</Label>
                <Input 
                  type="number" 
                  value={formData.loan_balance} 
                  onChange={(e) => updateField('loan_balance', e.target.value)} 
                  placeholder="e.g., 1500000"
                />
              </div>

              {/* Collateral Type */}
              <div className="space-y-2">
                <Label>What is your Collateral Type?</Label>
                <Select value={formData.collateral_type} onValueChange={(v) => updateField('collateral_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {COLLATERAL_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formData.collateral_type === 'Other' && (
                  <Input 
                    value={formData.collateral_type_other} 
                    onChange={(e) => updateField('collateral_type_other', e.target.value)} 
                    placeholder="Please specify..."
                    className="mt-2"
                  />
                )}
              </div>

              {/* Collateral Value */}
              <div className="space-y-2">
                <Label>What is your Current Collateral Value?</Label>
                <Input 
                  type="number" 
                  value={formData.collateral_value} 
                  onChange={(e) => updateField('collateral_value', e.target.value)} 
                  placeholder="e.g., 2000000"
                />
              </div>

              {/* Current Interest Rate */}
              <div className="space-y-2">
                <Label>What is your Current Interest Rate?</Label>
                <p className="text-xs text-muted-foreground">Please enter as a decimal, ex. .095 for 9.5%</p>
                <Input 
                  type="number" 
                  step="0.001"
                  value={formData.current_rate} 
                  onChange={(e) => updateField('current_rate', e.target.value)} 
                  placeholder="e.g., 0.095"
                />
              </div>

              {/* Target Interest Rate */}
              <div className="space-y-2">
                <Label>What is your Target Interest Rate?</Label>
                <p className="text-xs text-muted-foreground">Please enter as a decimal, ex. .095 for 9.5%</p>
                <Input 
                  type="number" 
                  step="0.001"
                  value={formData.target_rate} 
                  onChange={(e) => updateField('target_rate', e.target.value)} 
                  placeholder="e.g., 0.075"
                />
              </div>

              {/* Loan Maturity Date */}
              <div className="space-y-2">
                <Label>What is your Existing Loan Maturity Date?</Label>
                <p className="text-xs text-muted-foreground">If you only know the year, please just put the first day of that year</p>
                <Input 
                  type="date" 
                  value={formData.loan_maturity} 
                  onChange={(e) => updateField('loan_maturity', e.target.value)} 
                />
              </div>

              {/* Property City/State */}
              <div className="space-y-2">
                <Label>What is your Property City and State?</Label>
                <Input 
                  value={formData.re_city_state} 
                  onChange={(e) => updateField('re_city_state', e.target.value)} 
                  placeholder="e.g., Dallas, TX"
                />
              </div>

              {/* Loan Type */}
              <div className="space-y-2">
                <Label>What is your Loan Type or Structure?</Label>
                <Select value={formData.loan_type} onValueChange={(v) => updateField('loan_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {LOAN_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formData.loan_type === 'Other' && (
                  <Input 
                    value={formData.loan_type_other} 
                    onChange={(e) => updateField('loan_type_other', e.target.value)} 
                    placeholder="Please specify..."
                    className="mt-2"
                  />
                )}
              </div>

              {/* Rate Type */}
              <div className="space-y-2">
                <Label>What is your Rate Type?</Label>
                <Select value={formData.rate_type} onValueChange={(v) => updateField('rate_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {RATE_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Variable Index/Spread */}
              {formData.rate_type === 'Variable' && (
                <div className="space-y-2">
                  <Label>If Variable, what is your index and spread?</Label>
                  <Input 
                    value={formData.variable_index_spread} 
                    onChange={(e) => updateField('variable_index_spread', e.target.value)} 
                    placeholder="e.g., Prime + 1.5%"
                  />
                </div>
              )}

              {/* Original Term */}
              <div className="space-y-2">
                <Label>What is your Original Term (in years)?</Label>
                <Input 
                  type="number" 
                  value={formData.original_term_years} 
                  onChange={(e) => updateField('original_term_years', e.target.value)} 
                  placeholder="e.g., 10"
                />
              </div>

              {/* Amortization */}
              <div className="space-y-2">
                <Label>What is your Amortization (in years)?</Label>
                <Input 
                  value={formData.amortization} 
                  onChange={(e) => updateField('amortization', e.target.value)} 
                  placeholder="e.g., 25"
                />
              </div>

              {/* Prepayment Penalty */}
              <div className="space-y-2">
                <Label>What is your Prepayment Penalty Details?</Label>
                <Input 
                  value={formData.prepayment_penalty} 
                  onChange={(e) => updateField('prepayment_penalty', e.target.value)} 
                  placeholder="e.g., 3-2-1 step down"
                />
              </div>

              {/* Lender Type */}
              <div className="space-y-2">
                <Label>What is your Current Lender Type?</Label>
                <Select value={formData.lender_type} onValueChange={(v) => updateField('lender_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {LENDER_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {formData.lender_type === 'Other' && (
                  <Input 
                    value={formData.lender_type_other} 
                    onChange={(e) => updateField('lender_type_other', e.target.value)} 
                    placeholder="Please specify..."
                    className="mt-2"
                  />
                )}
              </div>

              {/* Estimated Cash Flow */}
              <div className="space-y-2">
                <Label>What is your Estimated Cash Flow?</Label>
                <Input 
                  type="number" 
                  value={formData.estimated_cash_flow} 
                  onChange={(e) => updateField('estimated_cash_flow', e.target.value)} 
                  placeholder="e.g., 150000"
                />
              </div>

              {/* Occupancy/Use */}
              <div className="space-y-2">
                <Label>What is your Occupancy or Use?</Label>
                <p className="text-xs text-muted-foreground">Please enter as a decimal, ex. .95 for 95%</p>
                <Input 
                  type="number" 
                  step="0.01"
                  value={formData.property_occupancy} 
                  onChange={(e) => updateField('property_occupancy', e.target.value)} 
                  placeholder="e.g., 0.95"
                />
              </div>

              {/* Improvements - Multi-select checkboxes */}
              <div className="space-y-3">
                <Label>Please Select Everything you would like to Improve with your Loan</Label>
                <div className="space-y-2">
                  {IMPROVEMENT_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox 
                        id={option}
                        checked={formData.improvements.includes(option)}
                        onCheckedChange={() => toggleImprovement(option)}
                      />
                      <label 
                        htmlFor={option} 
                        className="text-sm font-normal cursor-pointer"
                      >
                        {option}
                      </label>
                    </div>
                  ))}
                  <div className="flex items-start space-x-2 pt-2">
                    <Checkbox 
                      id="other-improvement"
                      checked={!!formData.improvements_other}
                      onCheckedChange={(checked) => {
                        if (!checked) updateField('improvements_other', '');
                      }}
                    />
                    <div className="flex-1">
                      <label htmlFor="other-improvement" className="text-sm font-normal">Other:</label>
                      <Input 
                        value={formData.improvements_other} 
                        onChange={(e) => updateField('improvements_other', e.target.value)} 
                        placeholder="Please specify..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button type="submit" disabled={submitting} className="w-full" size="lg">
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  'Submit'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RateWatchQuestionnaire;
