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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import logo from '@/assets/logo.png';
import { z } from 'zod';
import PublicLayout from '@/components/layout/PublicLayout';
import { supabase } from '@/integrations/supabase/client';
import { strongPasswordSchema } from '@/lib/password';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';

const emailSchema = z.string().email('Please enter a valid email address');
// Login authenticates an EXISTING password — only require that one was entered,
// so users whose password predates the strong-password policy aren't locked out.
const loginPasswordSchema = z.string().min(1, 'Password is required');

// Dev-only Quick Access: one-click passwordless sign-in as any existing user.
// Backed by the `dev-login` edge function (gated server-side by DEV_LOGIN_ENABLED),
// which lists users and mints a magic-link token — passwords are never exposed.
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

  // Quick Access (dev one-click login)
  const [quickAccessUsers, setQuickAccessUsers] = useState<QuickAccessUser[]>([]);
  const [quickAccessLoading, setQuickAccessLoading] = useState(true);
  const [loggingInAs, setLoggingInAs] = useState<string | null>(null);

  // Fetch quick access users on mount. Retries transient failures (e.g. a 429 from
  // the per-IP rate limit) with backoff so a brief blip doesn't make the panel
  // silently vanish. In prod the dev-login function is disabled, so every attempt
  // fails and the panel simply stays hidden — login form is always usable.
  useEffect(() => {
    let cancelled = false;

    const fetchUsers = async (attempt = 0): Promise<void> => {
      try {
        const { data, error } = await supabase.functions.invoke('dev-login', {
          body: { action: 'list' },
        });
        if (cancelled) return;
        if (error) throw error;
        setQuickAccessUsers(data?.users || []);
        setQuickAccessLoading(false);
      } catch {
        if (cancelled) return;
        if (attempt < 3) {
          // 1.5s, 3s, 4.5s — rides out a transient rate-limit window
          setTimeout(() => fetchUsers(attempt + 1), 1500 * (attempt + 1));
        } else {
          setQuickAccessLoading(false);
        }
      }
    };

    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleQuickLogin = async (quickUser: QuickAccessUser) => {
    if (!quickUser.email || loggingInAs) return;

    setLoggingInAs(quickUser.id);
    setError(null);

    try {
      // Step 1: get a magic-link token for this user from the edge function
      const { data, error: invokeError } = await supabase.functions.invoke('dev-login', {
        body: { action: 'login', email: quickUser.email },
      });

      if (invokeError || !data?.token_hash) {
        setError(`Failed to sign in as ${quickUser.name}`);
        setLoggingInAs(null);
        return;
      }

      // Step 2: verify the OTP to create a session
      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'magiclink',
      });

      if (otpError) {
        setError(`Failed to sign in as ${quickUser.name}: ${otpError.message}`);
        setLoggingInAs(null);
      }
      // On success, AuthContext's onAuthStateChange(SIGNED_IN) fires and the redirect useEffect navigates.
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
      } else if (isAdmin) {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    }
  }, [user, isAdmin, userRole, authLoading, teamLoading, teamMember, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      emailSchema.parse(loginEmail);
      loginPasswordSchema.parse(loginPassword);
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
      strongPasswordSchema.parse(signupPassword);
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

    // Only an admin portal exists today, so every new account is provisioned as
    // admin server-side by the handle_new_user() trigger — no role choice here.
    const { error: signUpError } = await signUp(signupEmail, signupPassword);

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
      {/* Top bar with logo */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <img src={logo} alt="Commercial Lending X" className="h-36" />
      </div>
      <div className="min-h-screen flex items-center justify-center pt-28 pb-8">
      <div className="flex flex-col md:flex-row gap-6 items-start justify-center w-full max-w-4xl">
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
                  <PasswordStrengthMeter password={signupPassword} />
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

      {/* Quick Access (right side) — dev one-click login as any existing user */}
      {quickAccessLoading ? (
        <Card className="flex-1 min-w-0 w-full">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : quickAccessUsers.length > 0 ? (
        <Card className="flex-1 min-w-0 w-full">
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
      ) : null}

      </div>
      </div>
    </div>
    </PublicLayout>
  );
};

export default Auth;
