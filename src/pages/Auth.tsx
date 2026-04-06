import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTeamMember } from '@/hooks/useTeamMember';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo.png';
import { z } from 'zod';
import PublicLayout from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

interface QuickAccessUser {
  id: string;
  name: string;
  email: string | null;
  app_role: string | null;
  position: string | null;
  is_owner: boolean | null;
  avatar_url: string | null;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadge(user: QuickAccessUser) {
  if (user.is_owner) return { label: 'Owner', variant: 'default' as const, className: 'bg-purple-600 hover:bg-purple-700' };
  if (user.app_role === 'super_admin') return { label: 'Super Admin', variant: 'default' as const, className: 'bg-indigo-600 hover:bg-indigo-700' };
  if (user.app_role === 'admin') return { label: 'Admin', variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700' };
  if (user.app_role === 'partner') return { label: 'Partner', variant: 'default' as const, className: 'bg-emerald-600 hover:bg-emerald-700' };
  return { label: 'User', variant: 'secondary' as const, className: '' };
}

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, signIn, signUp, loading: authLoading, userRole } = useAuth();
  const { teamMember, loading: teamLoading } = useTeamMember();

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
  const [signupRole, setSignupRole] = useState<'partner' | 'admin' | 'super_admin'>('partner');

  // Quick Access state
  const [quickAccessUsers, setQuickAccessUsers] = useState<QuickAccessUser[]>([]);
  const [quickAccessLoading, setQuickAccessLoading] = useState(true);
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null);

  // Fetch quick access users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('dev-login', {
          body: { action: 'list' },
        });

        if (error) return;

        setQuickAccessUsers(data?.users || []);
      } catch {
        // silently fail — login form is always available
      } finally {
        setQuickAccessLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleQuickLogin = async (quickUser: QuickAccessUser) => {
    if (!quickUser.email || loggingInAs) return;

    setLoggingInAs(quickUser.id);
    setError(null);

    try {
      // Step 1: Get magic link token from edge function
      const { data, error: invokeError } = await supabase.functions.invoke('dev-login', {
        body: { action: 'login', email: quickUser.email },
      });

      if (invokeError || !data?.token_hash) {
        setError(`Failed to sign in as ${quickUser.name}`);
        setLoggingInAs(null);
        return;
      }

      // Step 2: Verify the OTP to create a session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (otpError) {
        setError(`Failed to sign in as ${quickUser.name}: ${otpError.message}`);
        setLoggingInAs(null);
      }
      // On success, AuthContext's onAuthStateChange(SIGNED_IN) fires and the redirect useEffect handles navigation
    } catch {
      setError(`Failed to sign in as ${quickUser.name}`);
      setLoggingInAs(null);
    }
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user && !authLoading && !teamLoading) {
      // If user is a team member, route to their dashboard
      if (teamMember) {
        const name = teamMember.name.toLowerCase();
        const redirectPath = teamMember.is_owner
          ? `/superadmin/${name}`
          : `/admin/${name}`;
        navigate(redirectPath, { replace: true });
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
      } else {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, userRole, authLoading, teamLoading, teamMember, navigate, location]);

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

    const { error: signUpError } = await signUp(signupEmail, signupPassword, { signup_role: signupRole });

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        setError('An account with this email already exists. Please sign in instead.');
      } else {
        setError(signUpError.message);
      }
    }
    // No manual signIn needed — auto-confirm trigger makes signUp() return a session,
    // which fires onAuthStateChange(SIGNED_IN) and the redirect useEffect handles navigation.

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
      <div className="min-h-screen flex items-center justify-center pt-28 pb-8">
      <div className="flex gap-6 items-start w-full max-w-4xl">

        {/* Quick Access Card */}
        {!quickAccessLoading && quickAccessUsers.length > 0 && (
        <Card className="flex-1 min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick Access</CardTitle>
            <CardDescription>Select a user to sign in instantly</CardDescription>
          </CardHeader>
          <CardContent>
            {error && loggingInAs && (
              <Alert variant="destructive" className="mb-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              {quickAccessUsers.map((quickUser) => {
                const roleBadge = getRoleBadge(quickUser);
                const isLoggingIn = loggingInAs === quickUser.id;

                return (
                  <button
                    key={quickUser.id}
                    onClick={() => handleQuickLogin(quickUser)}
                    disabled={!!loggingInAs}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5 w-full text-left transition-all hover:bg-accent hover:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {isLoggingIn ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          getInitials(quickUser.name)
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{quickUser.name}</p>
                        <Badge variant={roleBadge.variant} className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${roleBadge.className}`}>
                          {roleBadge.label}
                        </Badge>
                      </div>
                      {quickUser.email && (
                        <p className="text-xs text-muted-foreground truncate">{quickUser.email}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Loading state for quick access */}
        {quickAccessLoading && (
          <Card className="flex-1 min-w-0">
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        )}

        {/* Login Form Card */}
        <Card className="w-full max-w-md shrink-0">
          <CardHeader className="text-center space-y-4">
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Sign in to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && !loggingInAs && (
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
                      onValueChange={(v) => setSignupRole(v as typeof signupRole)}
                      className="grid grid-cols-3 gap-3"
                    >
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
                      <Label
                        htmlFor="role-admin"
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                          signupRole === 'admin' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                        }`}
                      >
                        <RadioGroupItem value="admin" id="role-admin" className="sr-only" />
                        <span className="font-medium text-sm">Admin</span>
                        <span className="text-xs text-muted-foreground text-center">Team member</span>
                      </Label>
                      <Label
                        htmlFor="role-super-admin"
                        className={`flex flex-col items-center gap-1 rounded-lg border-2 p-3 cursor-pointer transition-colors ${
                          signupRole === 'super_admin' ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/50'
                        }`}
                      >
                        <RadioGroupItem value="super_admin" id="role-super-admin" className="sr-only" />
                        <span className="font-medium text-sm">Super Admin</span>
                        <span className="text-xs text-muted-foreground text-center">Owner access</span>
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
    </div>
    </PublicLayout>
  );
};

export default Auth;
