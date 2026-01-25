import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, User, DollarSign, Building2, FileText, Target, ChevronRight, ChevronLeft } from 'lucide-react';
import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

interface LeadData {
  id: string;
  name: string;
  company_name: string | null;
  ratewatch_questionnaire_completed_at: string | null;
}

type SectionKey = 'contact' | 'current-loan' | 'property' | 'goals';

interface Section {
  key: SectionKey;
  label: string;
  icon: React.ElementType;
  requiredFields: string[];
}

const SECTIONS: Section[] = [
  { key: 'contact', label: 'Contact Info', icon: User, requiredFields: ['first_name', 'last_name', 'email', 'phone'] },
  { key: 'current-loan', label: 'Current Loan', icon: DollarSign, requiredFields: ['loan_balance', 'current_rate'] },
  { key: 'property', label: 'Property/Collateral', icon: Building2, requiredFields: [] },
  { key: 'goals', label: 'Goals', icon: Target, requiredFields: ['seeking_to_improve'] },
];

const LOAN_TYPES = [
  'Commercial Real Estate',
  'Multifamily',
  'Industrial',
  'Retail',
  'Office',
  'SBA 7(a)',
  'SBA 504',
  'Equipment Financing',
  'Business Acquisition',
  'Working Capital',
  'Other',
];

const RATE_TYPES = [
  'Fixed',
  'Variable',
  'Hybrid',
];

const LENDER_TYPES = [
  'Bank',
  'Credit Union',
  'Private Lender',
  'SBA Lender',
  'Life Insurance Company',
  'CMBS',
  'Other',
];

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
  'Other',
];

const RateWatchQuestionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>('contact');
  const [visitedSections, setVisitedSections] = useState<Set<SectionKey>>(new Set(['contact']));
  
  const [formData, setFormData] = useState({
    // Contact
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    contact_method: '',
    
    // Current Loan
    current_lender: '',
    loan_balance: '',
    current_rate: '',
    target_rate: '',
    loan_maturity: '',
    loan_type: '',
    rate_type: '',
    variable_index_spread: '',
    original_term_years: '',
    amortization: '',
    prepayment_penalty: '',
    lender_type: '',
    
    // Property/Collateral
    collateral_type: '',
    collateral_value: '',
    re_city_state: '',
    property_occupancy: '',
    owner_occupied_pct: '',
    estimated_cash_flow: '',
    business_description: '',
    
    // Goals
    seeking_to_improve: '',
    additional_notes: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Calculate section completion
  const sectionCompletion = useMemo(() => {
    const completion: Record<SectionKey, boolean> = {
      'contact': false,
      'current-loan': false,
      'property': true,
      'goals': false,
    };

    SECTIONS.forEach(section => {
      if (section.requiredFields.length === 0) {
        completion[section.key] = true;
      } else {
        completion[section.key] = section.requiredFields.every(
          field => !!formData[field as keyof typeof formData]
        );
      }
    });

    return completion;
  }, [formData]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    const allRequiredFields = SECTIONS.flatMap(s => s.requiredFields);
    if (allRequiredFields.length === 0) return 100;
    
    const filledFields = allRequiredFields.filter(
      field => !!formData[field as keyof typeof formData]
    );
    
    return Math.round((filledFields.length / allRequiredFields.length) * 100);
  }, [formData]);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid questionnaire link');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('leads')
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
    
    if (!lead) return;
    
    const allRequiredFields = SECTIONS.flatMap(s => s.requiredFields);
    const missingFields = allRequiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Please complete all required fields',
        description: `${missingFields.length} required field(s) are missing.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error: insertError } = await supabase
        .from('ratewatch_questionnaire_responses')
        .insert({
          lead_id: lead.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          contact_method: formData.contact_method || null,
          current_lender: formData.current_lender || null,
          loan_balance: formData.loan_balance ? parseFloat(formData.loan_balance) : null,
          current_rate: formData.current_rate ? parseFloat(formData.current_rate) : null,
          target_rate: formData.target_rate ? parseFloat(formData.target_rate) : null,
          loan_maturity: formData.loan_maturity || null,
          loan_type: formData.loan_type || null,
          rate_type: formData.rate_type || null,
          variable_index_spread: formData.variable_index_spread || null,
          original_term_years: formData.original_term_years ? parseFloat(formData.original_term_years) : null,
          amortization: formData.amortization || null,
          prepayment_penalty: formData.prepayment_penalty || null,
          lender_type: formData.lender_type || null,
          collateral_type: formData.collateral_type || null,
          collateral_value: formData.collateral_value ? parseFloat(formData.collateral_value) : null,
          re_city_state: formData.re_city_state || null,
          property_occupancy: formData.property_occupancy || null,
          owner_occupied_pct: formData.owner_occupied_pct ? parseFloat(formData.owner_occupied_pct) : null,
          estimated_cash_flow: formData.estimated_cash_flow ? parseFloat(formData.estimated_cash_flow) : null,
          business_description: formData.business_description || null,
          seeking_to_improve: formData.seeking_to_improve,
          additional_notes: formData.additional_notes || null,
        });

      if (insertError) throw insertError;

      await supabase
        .from('leads')
        .update({ ratewatch_questionnaire_completed_at: new Date().toISOString() })
        .eq('id', lead.id);

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

  const goToNextSection = () => {
    const currentIndex = SECTIONS.findIndex(s => s.key === activeSection);
    if (currentIndex < SECTIONS.length - 1) {
      const nextSection = SECTIONS[currentIndex + 1].key;
      setActiveSection(nextSection);
      setVisitedSections(prev => new Set([...prev, nextSection]));
    }
  };

  const goToPrevSection = () => {
    const currentIndex = SECTIONS.findIndex(s => s.key === activeSection);
    if (currentIndex > 0) {
      setActiveSection(SECTIONS[currentIndex - 1].key);
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

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'contact':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>First Name *</Label>
              <Input value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Last Name *</Label>
              <Input value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Preferred Contact Method</Label>
              <Select value={formData.contact_method} onValueChange={(v) => updateField('contact_method', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'current-loan':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Current Lender</Label>
              <Input value={formData.current_lender} onChange={(e) => updateField('current_lender', e.target.value)} placeholder="e.g., Chase Bank" />
            </div>
            <div className="space-y-2">
              <Label>Lender Type</Label>
              <Select value={formData.lender_type} onValueChange={(v) => updateField('lender_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {LENDER_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Loan Balance *</Label>
              <Input 
                type="number" 
                value={formData.loan_balance} 
                onChange={(e) => updateField('loan_balance', e.target.value)} 
                placeholder="e.g., 1500000"
              />
            </div>
            <div className="space-y-2">
              <Label>Current Rate (%) *</Label>
              <Input 
                type="number" 
                step="0.01"
                value={formData.current_rate} 
                onChange={(e) => updateField('current_rate', e.target.value)} 
                placeholder="e.g., 7.25"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Rate (%)</Label>
              <Input 
                type="number" 
                step="0.01"
                value={formData.target_rate} 
                onChange={(e) => updateField('target_rate', e.target.value)} 
                placeholder="e.g., 6.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Maturity Date</Label>
              <Input 
                type="date" 
                value={formData.loan_maturity} 
                onChange={(e) => updateField('loan_maturity', e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Loan Type</Label>
              <Select value={formData.loan_type} onValueChange={(v) => updateField('loan_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {LOAN_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Type</Label>
              <Select value={formData.rate_type} onValueChange={(v) => updateField('rate_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.rate_type === 'Variable' && (
              <div className="space-y-2 md:col-span-2">
                <Label>If Variable: Index and Spread</Label>
                <Input 
                  value={formData.variable_index_spread} 
                  onChange={(e) => updateField('variable_index_spread', e.target.value)} 
                  placeholder="e.g., Prime + 1.5%"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Original Term (Years)</Label>
              <Input 
                type="number" 
                value={formData.original_term_years} 
                onChange={(e) => updateField('original_term_years', e.target.value)} 
                placeholder="e.g., 10"
              />
            </div>
            <div className="space-y-2">
              <Label>Amortization</Label>
              <Input 
                value={formData.amortization} 
                onChange={(e) => updateField('amortization', e.target.value)} 
                placeholder="e.g., 25 years"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Prepayment Penalty</Label>
              <Input 
                value={formData.prepayment_penalty} 
                onChange={(e) => updateField('prepayment_penalty', e.target.value)} 
                placeholder="e.g., 3-2-1 step down"
              />
            </div>
          </div>
        );

      case 'property':
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Collateral Type</Label>
              <Select value={formData.collateral_type} onValueChange={(v) => updateField('collateral_type', v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {COLLATERAL_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Collateral Value</Label>
              <Input 
                type="number" 
                value={formData.collateral_value} 
                onChange={(e) => updateField('collateral_value', e.target.value)} 
                placeholder="e.g., 2000000"
              />
            </div>
            <div className="space-y-2">
              <Label>Property City/State</Label>
              <Input 
                value={formData.re_city_state} 
                onChange={(e) => updateField('re_city_state', e.target.value)} 
                placeholder="e.g., Dallas, TX"
              />
            </div>
            <div className="space-y-2">
              <Label>Occupancy/Use</Label>
              <Input 
                value={formData.property_occupancy} 
                onChange={(e) => updateField('property_occupancy', e.target.value)} 
                placeholder="e.g., Single tenant retail"
              />
            </div>
            <div className="space-y-2">
              <Label>Owner Occupied (%)</Label>
              <Input 
                type="number" 
                min="0"
                max="100"
                value={formData.owner_occupied_pct} 
                onChange={(e) => updateField('owner_occupied_pct', e.target.value)} 
                placeholder="e.g., 50"
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated Cash Flow (Annual)</Label>
              <Input 
                type="number" 
                value={formData.estimated_cash_flow} 
                onChange={(e) => updateField('estimated_cash_flow', e.target.value)} 
                placeholder="e.g., 150000"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Business Description</Label>
              <Textarea 
                value={formData.business_description} 
                onChange={(e) => updateField('business_description', e.target.value)} 
                placeholder="Brief description of your business or investment..."
                rows={3}
              />
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>What are you seeking to improve? *</Label>
              <Textarea 
                value={formData.seeking_to_improve} 
                onChange={(e) => updateField('seeking_to_improve', e.target.value)} 
                placeholder="e.g., Lower rate, better terms, cash out, extend maturity..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea 
                value={formData.additional_notes} 
                onChange={(e) => updateField('additional_notes', e.target.value)} 
                placeholder="Any other information you'd like us to know..."
                rows={4}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentSectionIndex = SECTIONS.findIndex(s => s.key === activeSection);
  const isLastSection = currentSectionIndex === SECTIONS.length - 1;
  const isFirstSection = currentSectionIndex === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="CLX Commercial" className="h-10" />
            <div>
              <h1 className="font-bold text-lg">CLX RateWatch Concierge</h1>
              <p className="text-xs text-muted-foreground">Rate monitoring & refinance service</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{lead?.name}</p>
            {lead?.company_name && (
              <p className="text-xs text-muted-foreground">{lead.company_name}</p>
            )}
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">{overallProgress}% complete</span>
        </div>
        <Progress value={overallProgress} className="h-2" />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          {/* Section Navigation */}
          <div className="hidden md:block">
            <nav className="space-y-1 sticky top-24">
              {SECTIONS.map((section, index) => {
                const Icon = section.icon;
                const isActive = activeSection === section.key;
                const isComplete = sectionCompletion[section.key];
                const isVisited = visitedSections.has(section.key);
                
                return (
                  <button
                    key={section.key}
                    onClick={() => {
                      setActiveSection(section.key);
                      setVisitedSections(prev => new Set([...prev, section.key]));
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted",
                      !isVisited && !isActive && "text-muted-foreground"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0",
                      isComplete && !isActive ? "bg-green-500 text-white" : "",
                      !isComplete && !isActive ? "bg-muted" : ""
                    )}>
                      {isComplete && !isActive ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="text-sm font-medium">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Form Content */}
          <Card>
            <CardContent className="pt-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  {(() => {
                    const Icon = SECTIONS.find(s => s.key === activeSection)?.icon || FileText;
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                  {SECTIONS.find(s => s.key === activeSection)?.label}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeSection === 'contact' && 'Please provide your contact information so we can reach you with rate updates.'}
                  {activeSection === 'current-loan' && 'Tell us about your current loan so we can monitor for better opportunities.'}
                  {activeSection === 'property' && 'Details about your collateral help us find the best refinancing options.'}
                  {activeSection === 'goals' && 'What improvements are you looking for in your financing?'}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {renderSectionContent()}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPrevSection}
                    disabled={isFirstSection}
                    className="gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>

                  {isLastSection ? (
                    <Button type="submit" disabled={submitting} className="gap-2">
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit Enrollment
                          <CheckCircle2 className="w-4 h-4" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button type="button" onClick={goToNextSection} className="gap-2">
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Mobile Section Pills */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t p-3">
        <div className="flex gap-2 overflow-x-auto">
          {SECTIONS.map((section) => {
            const isActive = activeSection === section.key;
            const isComplete = sectionCompletion[section.key];
            
            return (
              <button
                key={section.key}
                onClick={() => {
                  setActiveSection(section.key);
                  setVisitedSections(prev => new Set([...prev, section.key]));
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : isComplete 
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted"
                )}
              >
                {isComplete && !isActive && <CheckCircle2 className="w-3 h-3" />}
                {section.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RateWatchQuestionnaire;
