import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo.png';
import { z } from 'zod';
import PublicLayout from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signIn, signUp, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupRole, setSignupRole] = useState<'client' | 'partner'>('client');
  // Redirect if already logged in
  const { userRole } = useAuth();

  useEffect(() => {
    if (user && !authLoading) {
      const email = (user.email ?? '').toLowerCase();

      // Route team members (employees) to their specific dashboards
      const employeeRoutes: Record<string, string> = {
        'evan@test.com': '/admin/evan',
        'maura@test.com': '/admin/maura',
        'wendy@test.com': '/admin/wendy',
      };

      // Check if user is a team member with a specific route
      if (employeeRoutes[email]) {
        navigate(employeeRoutes[email], { replace: true });
        return;
      }

      // Force this user to admin/ilan
      if (email === 'ilan@maverich.ai') {
        navigate('/superadmin/ilan', { replace: true });
        return;
      }

      // Redirect partners to partner dashboard
      if (userRole === 'partner') {
        navigate('/partner', { replace: true });
        return;
      }

      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (isAdmin) {
        navigate('/superadmin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [user, isAdmin, userRole, authLoading, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      emailSchema.parse(loginEmail);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please verify your email address before signing in.');
      } else {
        setError(error.message);
      }
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      emailSchema.parse(signupEmail);
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
        setIsLoading(false);
        return;
      }
    }

    if (signupPassword !== signupConfirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(signupEmail, signupPassword);
    
    if (error) {
      if (error.message.includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(error.message);
      }
    } else {
      // If partner role selected, wait for session then update role
      if (signupRole === 'partner') {
        // Listen for the session to become available after signup
        const waitForSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase
              .from('user_roles')
              .update({ role: 'partner' as any })
              .eq('user_id', session.user.id);
          }
        };
        
        // Try immediately and also set up a listener
        await waitForSession();
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session?.user) {
            await supabase
              .from('user_roles')
              .update({ role: 'partner' as any })
              .eq('user_id', session.user.id);
            subscription.unsubscribe();
          }
        });
      }
      setSuccess('Account created successfully! You can now sign in.');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirmPassword('');
      setSignupRole('client');
    }
    
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
    <div className="min-h-screen relative bg-gradient-to-br from-primary/5 via-background to-accent/5 px-4">
      {/* Top bar with logo and back button */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <img src={logo} alt="Commercial Lending X" className="h-36" />
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/')}
        >
          ← Back to Website
        </Button>
      </div>
      <div className="min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4 border-green-500 bg-green-50 text-green-700">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="you@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 mt-4">
                <div className="space-y-3">
                  <Label>I am signing up as</Label>
                  <RadioGroup
                    value={signupRole}
                    onValueChange={(v) => setSignupRole(v as 'client' | 'partner')}
                    className="grid grid-cols-2 gap-3"
                  >
                    <Label
                      htmlFor="role-borrower"
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                        signupRole === 'client' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <RadioGroupItem value="client" id="role-borrower" className="sr-only" />
                      <span className="font-medium text-sm">Borrower</span>
                      <span className="text-xs text-muted-foreground text-center">Looking for financing</span>
                    </Label>
                    <Label
                      htmlFor="role-partner"
                      className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                        signupRole === 'partner' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                      }`}
                    >
                      <RadioGroupItem value="partner" id="role-partner" className="sr-only" />
                      <span className="font-medium text-sm">Partner</span>
                      <span className="text-xs text-muted-foreground text-center">Refer deals & earn</span>
                    </Label>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@company.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupConfirmPassword}
                    onChange={(e) => setSignupConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </div>
    </div>
    </PublicLayout>
  );
};

export default Auth;
