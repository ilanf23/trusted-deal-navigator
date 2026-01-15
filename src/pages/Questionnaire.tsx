import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, Building2, DollarSign, Clock, TrendingUp, Target } from 'lucide-react';

interface LeadData {
  id: string;
  name: string;
  company_name: string | null;
  questionnaire_completed_at: string | null;
}

const Questionnaire = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lead, setLead] = useState<LeadData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    business_type: '',
    funding_amount: '',
    funding_timeline: '',
    annual_revenue: '',
    funding_purpose: '',
  });

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
          .single();

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
    
    // Validate all fields
    if (!formData.business_type || !formData.funding_amount || !formData.funding_timeline || 
        !formData.annual_revenue || !formData.funding_purpose) {
      toast({
        title: 'Please complete all fields',
        description: 'All questions are required to proceed.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Insert responses
      const { error: insertError } = await supabase
        .from('lead_responses')
        .insert({
          lead_id: lead.id,
          business_type: formData.business_type,
          funding_amount: formData.funding_amount,
          funding_timeline: formData.funding_timeline,
          annual_revenue: formData.annual_revenue,
          funding_purpose: formData.funding_purpose,
        });

      if (insertError) {
        throw insertError;
      }

      // Mark questionnaire as completed
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
        description: 'Your responses have been submitted successfully.',
      });
    } catch (err: any) {
      console.error('Error submitting questionnaire:', err);
      toast({
        title: 'Submission failed',
        description: 'There was an error submitting your responses. Please try again.',
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
              Your pre-qualification questionnaire has been submitted successfully. Our team will review your responses and reach out to you shortly.
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
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Pre-Qualification Questionnaire</h1>
          <p className="text-muted-foreground">
            Welcome{lead?.name ? `, ${lead.name}` : ''}! Please answer the following questions to help us understand your financing needs.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Business Information
              </CardTitle>
              <CardDescription>Tell us about your business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business_type">What type of business do you own or operate?</Label>
                <Select 
                  value={formData.business_type} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, business_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail / E-commerce</SelectItem>
                    <SelectItem value="restaurant">Restaurant / Food Service</SelectItem>
                    <SelectItem value="healthcare">Healthcare / Medical</SelectItem>
                    <SelectItem value="construction">Construction / Contracting</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="professional_services">Professional Services</SelectItem>
                    <SelectItem value="technology">Technology / Software</SelectItem>
                    <SelectItem value="transportation">Transportation / Logistics</SelectItem>
                    <SelectItem value="real_estate">Real Estate</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Funding Requirements
              </CardTitle>
              <CardDescription>Help us understand your financial needs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="funding_amount">How much funding are you seeking?</Label>
                <Select 
                  value={formData.funding_amount} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, funding_amount: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select funding amount range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_50k">Under $50,000</SelectItem>
                    <SelectItem value="50k_100k">$50,000 - $100,000</SelectItem>
                    <SelectItem value="100k_250k">$100,000 - $250,000</SelectItem>
                    <SelectItem value="250k_500k">$250,000 - $500,000</SelectItem>
                    <SelectItem value="500k_1m">$500,000 - $1,000,000</SelectItem>
                    <SelectItem value="over_1m">Over $1,000,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="annual_revenue" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  What is your approximate annual revenue?
                </Label>
                <Select 
                  value={formData.annual_revenue} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, annual_revenue: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select annual revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under_100k">Under $100,000</SelectItem>
                    <SelectItem value="100k_250k">$100,000 - $250,000</SelectItem>
                    <SelectItem value="250k_500k">$250,000 - $500,000</SelectItem>
                    <SelectItem value="500k_1m">$500,000 - $1,000,000</SelectItem>
                    <SelectItem value="1m_5m">$1,000,000 - $5,000,000</SelectItem>
                    <SelectItem value="over_5m">Over $5,000,000</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Timeline & Purpose
              </CardTitle>
              <CardDescription>When do you need the funding and what for?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="funding_timeline">When do you need the funding?</Label>
                <Select 
                  value={formData.funding_timeline} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, funding_timeline: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediately">Immediately (within 1 week)</SelectItem>
                    <SelectItem value="1_2_weeks">1-2 weeks</SelectItem>
                    <SelectItem value="2_4_weeks">2-4 weeks</SelectItem>
                    <SelectItem value="1_2_months">1-2 months</SelectItem>
                    <SelectItem value="2_3_months">2-3 months</SelectItem>
                    <SelectItem value="flexible">Flexible / No rush</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="funding_purpose" className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  What will the funding be used for?
                </Label>
                <Textarea
                  id="funding_purpose"
                  placeholder="e.g., Equipment purchase, inventory expansion, hiring, marketing, debt consolidation, real estate, etc."
                  value={formData.funding_purpose}
                  onChange={(e) => setFormData(prev => ({ ...prev, funding_purpose: e.target.value }))}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Pre-Qualification'
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
