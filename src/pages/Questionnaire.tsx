import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, User, MapPin, DollarSign, Building2, Briefcase, FileText, Info } from 'lucide-react';
import logo from '@/assets/logo.png';

interface LeadData {
  id: string;
  name: string;
  company_name: string | null;
  questionnaire_completed_at: string | null;
}

const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Afghanistan", "Albania", "Algeria", "American Samoa", "Andorra", "Angola", "Anguilla", "Antigua & Barbuda", "Argentina", "Armenia", "Aruba", "Australia", "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia & Herzegovina", "Botswana", "Brazil", "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Cape Verde", "Cayman Islands", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo - Brazzaville", "Congo - Kinshasa", "Cook Islands", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "French Guiana", "French Polynesia", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guam", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hong Kong SAR China", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania", "Russia", "Rwanda", "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad & Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

const Questionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    // Primary Contact
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    newsletter_signup: false,
    contact_method: '',
    // Address
    country: 'United States',
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    zip_code: '',
    // Loan Details
    principal_name: '',
    co_borrowers: '',
    guarantors: '',
    loan_amount: '',
    purpose_of_loan: '',
    collateral_value: '',
    collateral_description: '',
    loan_type: '',
    loan_type_other: '',
    cash_out: '',
    cash_out_amount: '',
    // Current Loan
    current_lender: '',
    current_loan_balance: '',
    current_loan_rate: '',
    current_loan_maturity_date: '',
    current_loan_in_default: '',
    // Real Estate
    property_owner_occupied: '',
    year_acquired: '',
    purchase_price: '',
    current_estimated_value: '',
    square_footage: '',
    number_of_units: '',
    // Borrower Employment
    borrower_occupation: '',
    borrower_year_started: '',
    borrower_current_employer: '',
    co_borrower_occupation: '',
    co_borrower_year_started: '',
    co_borrower_current_employer: '',
    self_employed_business_type: '',
    year_business_founded: '',
    business_description: '',
    // Loan Preferences
    desired_interest_rate: '',
    desired_term: '',
    desired_amortization: '',
    borrower_bankruptcy: '',
    co_borrower_bankruptcy: '',
    borrower_credit_score: '',
    co_borrower_credit_score: '',
    // Additional
    additional_information: '',
    how_did_you_hear: '',
    referred_by: '',
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

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
          .select('id, name, company_name, questionnaire_completed_at')
          .eq('questionnaire_token', token)
          .maybeSingle();

        if (error || !data) {
          setError('This questionnaire link is invalid or has expired');
          setLoading(false);
          return;
        }

        if (data.questionnaire_completed_at) {
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
    
    // Validate required fields
    const requiredFields = ['first_name', 'last_name', 'email', 'phone', 'contact_method', 'address_line_1', 'city', 'state', 'zip_code', 'principal_name', 'loan_amount', 'purpose_of_loan', 'collateral_value', 'collateral_description'];
    const missingFields = requiredFields.filter(field => !formData[field as keyof typeof formData]);
    
    if (missingFields.length > 0) {
      toast({
        title: 'Please complete all required fields',
        description: 'Fields marked with * are required.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error: insertError } = await supabase
        .from('lead_responses')
        .insert({
          lead_id: lead.id,
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone: formData.phone,
          newsletter_signup: formData.newsletter_signup,
          contact_method: formData.contact_method,
          country: formData.country,
          address_line_1: formData.address_line_1,
          address_line_2: formData.address_line_2,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          principal_name: formData.principal_name,
          co_borrowers: formData.co_borrowers,
          guarantors: formData.guarantors,
          loan_amount: formData.loan_amount ? parseFloat(formData.loan_amount) : null,
          purpose_of_loan: formData.purpose_of_loan,
          collateral_value: formData.collateral_value ? parseFloat(formData.collateral_value) : null,
          collateral_description: formData.collateral_description,
          loan_type: formData.loan_type,
          loan_type_other: formData.loan_type_other,
          cash_out: formData.cash_out,
          cash_out_amount: formData.cash_out_amount ? parseFloat(formData.cash_out_amount) : null,
          current_lender: formData.current_lender,
          current_loan_balance: formData.current_loan_balance ? parseFloat(formData.current_loan_balance) : null,
          current_loan_rate: formData.current_loan_rate,
          current_loan_maturity_date: formData.current_loan_maturity_date || null,
          current_loan_in_default: formData.current_loan_in_default,
          property_owner_occupied: formData.property_owner_occupied,
          year_acquired: formData.year_acquired,
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          current_estimated_value: formData.current_estimated_value ? parseFloat(formData.current_estimated_value) : null,
          square_footage: formData.square_footage,
          number_of_units: formData.number_of_units,
          borrower_occupation: formData.borrower_occupation,
          borrower_year_started: formData.borrower_year_started,
          borrower_current_employer: formData.borrower_current_employer,
          co_borrower_occupation: formData.co_borrower_occupation,
          co_borrower_year_started: formData.co_borrower_year_started,
          co_borrower_current_employer: formData.co_borrower_current_employer,
          self_employed_business_type: formData.self_employed_business_type,
          year_business_founded: formData.year_business_founded,
          business_description: formData.business_description,
          desired_interest_rate: formData.desired_interest_rate,
          desired_term: formData.desired_term,
          desired_amortization: formData.desired_amortization,
          borrower_bankruptcy: formData.borrower_bankruptcy,
          co_borrower_bankruptcy: formData.co_borrower_bankruptcy,
          borrower_credit_score: formData.borrower_credit_score,
          co_borrower_credit_score: formData.co_borrower_credit_score,
          additional_information: formData.additional_information,
          how_did_you_hear: formData.how_did_you_hear,
          referred_by: formData.referred_by,
        });

      if (insertError) {
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from('leads')
        .update({ questionnaire_completed_at: new Date().toISOString() })
        .eq('id', lead.id);

      if (updateError) {
        console.error('Error updating lead:', updateError);
      }

      setSubmitted(true);
      toast({
        title: 'Thank you!',
        description: 'Your loan application has been submitted successfully.',
      });
    } catch (err: any) {
      console.error('Error submitting questionnaire:', err);
      toast({
        title: 'Submission failed',
        description: 'There was an error submitting your application. Please try again.',
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
              Your loan application has been submitted successfully. Our team will review your information and contact you shortly.
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="Commercial Lending X" className="h-20 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">Loan Application</h1>
          <p className="text-muted-foreground">
            Welcome{lead?.name ? `, ${lead.name}` : ''}! Please complete the form below.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Accordion type="multiple" defaultValue={['contact', 'address', 'loan']} className="space-y-4">
            
            {/* Primary Contact */}
            <AccordionItem value="contact" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Primary Contact Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>First Name *</Label>
                    <Input value={formData.first_name} onChange={(e) => updateField('first_name', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name *</Label>
                    <Input value={formData.last_name} onChange={(e) => updateField('last_name', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" value={formData.email} onChange={(e) => updateField('email', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone *</Label>
                    <Input type="tel" value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Primary Contact Method *</Label>
                    <Select value={formData.contact_method} onValueChange={(v) => updateField('contact_method', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox 
                      id="newsletter" 
                      checked={formData.newsletter_signup} 
                      onCheckedChange={(checked) => updateField('newsletter_signup', !!checked)} 
                    />
                    <Label htmlFor="newsletter" className="font-normal">Sign up for news and updates</Label>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Address */}
            <AccordionItem value="address" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Address</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Country</Label>
                    <Select value={formData.country} onValueChange={(v) => updateField('country', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 1 *</Label>
                    <Input value={formData.address_line_1} onChange={(e) => updateField('address_line_1', e.target.value)} required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Address Line 2</Label>
                    <Input value={formData.address_line_2} onChange={(e) => updateField('address_line_2', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>City *</Label>
                    <Input value={formData.city} onChange={(e) => updateField('city', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>State *</Label>
                    <Input value={formData.state} onChange={(e) => updateField('state', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>ZIP Code *</Label>
                    <Input value={formData.zip_code} onChange={(e) => updateField('zip_code', e.target.value)} required />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Loan Details */}
            <AccordionItem value="loan" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Loan Details</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Principal Name or Entity on Loan *</Label>
                    <Input value={formData.principal_name} onChange={(e) => updateField('principal_name', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-Borrower(s)</Label>
                    <Input value={formData.co_borrowers} onChange={(e) => updateField('co_borrowers', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Guarantor(s)</Label>
                    <Input value={formData.guarantors} onChange={(e) => updateField('guarantors', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan Amount *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" className="pl-7" value={formData.loan_amount} onChange={(e) => updateField('loan_amount', e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Collateral Value *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" className="pl-7" value={formData.collateral_value} onChange={(e) => updateField('collateral_value', e.target.value)} required />
                    </div>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Purpose of Loan Request *</Label>
                    <Textarea value={formData.purpose_of_loan} onChange={(e) => updateField('purpose_of_loan', e.target.value)} required />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Collateral Description / Address *</Label>
                    <Textarea value={formData.collateral_description} onChange={(e) => updateField('collateral_description', e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan Type</Label>
                    <Select value={formData.loan_type} onValueChange={(v) => updateField('loan_type', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase">Purchase</SelectItem>
                        <SelectItem value="refinance">Refinance</SelectItem>
                        <SelectItem value="cloc">CLOC</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.loan_type === 'other' && (
                    <div className="space-y-2">
                      <Label>Loan Type (Other)</Label>
                      <Input value={formData.loan_type_other} onChange={(e) => updateField('loan_type_other', e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Cash Out</Label>
                    <Select value={formData.cash_out} onValueChange={(v) => updateField('cash_out', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {formData.cash_out === 'yes' && (
                    <div className="space-y-2">
                      <Label>If yes, amount desired</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input type="number" className="pl-7" value={formData.cash_out_amount} onChange={(e) => updateField('cash_out_amount', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Current Loan */}
            <AccordionItem value="current-loan" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Current Loan Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Current Lender</Label>
                    <Input value={formData.current_lender} onChange={(e) => updateField('current_lender', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Loan Balance</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" className="pl-7" value={formData.current_loan_balance} onChange={(e) => updateField('current_loan_balance', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Loan Rate</Label>
                    <Input value={formData.current_loan_rate} onChange={(e) => updateField('current_loan_rate', e.target.value)} placeholder="e.g., 5.5%" />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Loan Maturity Date</Label>
                    <Input type="date" value={formData.current_loan_maturity_date} onChange={(e) => updateField('current_loan_maturity_date', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Loan in Default</Label>
                    <Select value={formData.current_loan_in_default} onValueChange={(v) => updateField('current_loan_in_default', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="n/a">N/A</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Real Estate */}
            <AccordionItem value="real-estate" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Real Estate Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Is the Property Owner-Occupied</Label>
                    <Select value={formData.property_owner_occupied} onValueChange={(v) => updateField('property_owner_occupied', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="n/a">N/A</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Year Acquired</Label>
                    <Input value={formData.year_acquired} onChange={(e) => updateField('year_acquired', e.target.value)} placeholder="e.g., 2020" />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase Price</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" className="pl-7" value={formData.purchase_price} onChange={(e) => updateField('purchase_price', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Estimated Value</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <Input type="number" className="pl-7" value={formData.current_estimated_value} onChange={(e) => updateField('current_estimated_value', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Square Footage of Building</Label>
                    <Input value={formData.square_footage} onChange={(e) => updateField('square_footage', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Number of Units / Tenants</Label>
                    <Input value={formData.number_of_units} onChange={(e) => updateField('number_of_units', e.target.value)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Borrower Employment */}
            <AccordionItem value="employment" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Employment & Business Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <h4 className="md:col-span-2 font-medium text-muted-foreground">Borrower</h4>
                  <div className="space-y-2">
                    <Label>Borrower Occupation</Label>
                    <Input value={formData.borrower_occupation} onChange={(e) => updateField('borrower_occupation', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Borrower Year Started</Label>
                    <Input value={formData.borrower_year_started} onChange={(e) => updateField('borrower_year_started', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Borrower Current Employer</Label>
                    <Input value={formData.borrower_current_employer} onChange={(e) => updateField('borrower_current_employer', e.target.value)} />
                  </div>
                  
                  <h4 className="md:col-span-2 font-medium text-muted-foreground mt-4">Co-Borrower</h4>
                  <div className="space-y-2">
                    <Label>Co-Borrower Occupation</Label>
                    <Input value={formData.co_borrower_occupation} onChange={(e) => updateField('co_borrower_occupation', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-Borrower Year Started</Label>
                    <Input value={formData.co_borrower_year_started} onChange={(e) => updateField('co_borrower_year_started', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-Borrower Current Employer</Label>
                    <Input value={formData.co_borrower_current_employer} onChange={(e) => updateField('co_borrower_current_employer', e.target.value)} />
                  </div>

                  <h4 className="md:col-span-2 font-medium text-muted-foreground mt-4">Self-Employed</h4>
                  <div className="space-y-2">
                    <Label>If Self-Employed, Type of Business Owned</Label>
                    <Input value={formData.self_employed_business_type} onChange={(e) => updateField('self_employed_business_type', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Year Business Founded / Acquired</Label>
                    <Input value={formData.year_business_founded} onChange={(e) => updateField('year_business_founded', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Description of Business & Products/Services Offered</Label>
                    <Textarea value={formData.business_description} onChange={(e) => updateField('business_description', e.target.value)} />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Loan Preferences & Credit */}
            <AccordionItem value="preferences" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Loan Preferences & Credit</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Desired Interest Rate</Label>
                    <Input value={formData.desired_interest_rate} onChange={(e) => updateField('desired_interest_rate', e.target.value)} placeholder="e.g., 6%" />
                  </div>
                  <div className="space-y-2">
                    <Label>Desired Term</Label>
                    <Input value={formData.desired_term} onChange={(e) => updateField('desired_term', e.target.value)} placeholder="e.g., 30 years" />
                  </div>
                  <div className="space-y-2">
                    <Label>Desired Amortization</Label>
                    <Input value={formData.desired_amortization} onChange={(e) => updateField('desired_amortization', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Has Borrower filed bankruptcy in last 7 years</Label>
                    <Select value={formData.borrower_bankruptcy} onValueChange={(v) => updateField('borrower_bankruptcy', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="n/a">N/A</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Has Co-Borrower filed bankruptcy in last 7 years</Label>
                    <Select value={formData.co_borrower_bankruptcy} onValueChange={(v) => updateField('co_borrower_bankruptcy', v)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="n/a">N/A</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Borrower Credit Score (or estimated)</Label>
                    <Input value={formData.borrower_credit_score} onChange={(e) => updateField('borrower_credit_score', e.target.value)} placeholder="e.g., 720" />
                  </div>
                  <div className="space-y-2">
                    <Label>Co-Borrower Credit Score (or estimated)</Label>
                    <Input value={formData.co_borrower_credit_score} onChange={(e) => updateField('co_borrower_credit_score', e.target.value)} placeholder="e.g., 700" />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Additional Information */}
            <AccordionItem value="additional" className="bg-card rounded-lg border">
              <AccordionTrigger className="px-6 hover:no-underline">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-primary" />
                  <span className="font-semibold">Additional Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Additional information pertinent for CLX to be aware of</Label>
                    <Textarea 
                      value={formData.additional_information} 
                      onChange={(e) => updateField('additional_information', e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>How did you hear about CLX</Label>
                      <Input value={formData.how_did_you_hear} onChange={(e) => updateField('how_did_you_hear', e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Referred By</Label>
                      <Input value={formData.referred_by} onChange={(e) => updateField('referred_by', e.target.value)} />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full mt-6"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Your information is secure and will only be used to assess your financing options.
        </p>
      </div>
    </div>
  );
};

export default Questionnaire;