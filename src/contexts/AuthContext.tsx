import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: UserRole | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    console.log('Fetching role for user:', userId);
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      console.log('User roles data:', data);

      // Prioritize admin role if user has multiple roles
      const roles = data?.map(r => r.role) || [];
      if (roles.includes('admin')) {
        console.log('User is admin');
        return 'admin' as UserRole;
      }
      const role = (roles[0] as UserRole) || null;
      console.log('User role:', role);
      return role;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, !!session);
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer role fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setRoleLoading(true);
          setTimeout(async () => {
            const role = await fetchUserRole(session.user.id);
            console.log('Setting user role:', role);
            setUserRole(role);
            setRoleLoading(false);
            setLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setRoleLoading(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Got existing session:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setRoleLoading(true);
        fetchUserRole(session.user.id).then((role) => {
          console.log('Initial role fetch:', role);
          setUserRole(role);
          setRoleLoading(false);
          setLoading(false);
        });
      } else {
        setRoleLoading(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  };

  // Only consider fully loaded when both auth and role are resolved
  const isFullyLoaded = !loading && !roleLoading;
  
  const value = {
    user,
    session,
    loading: !isFullyLoaded, // Keep loading true until role is also loaded
    userRole,
    signIn,
    signUp,
    signOut,
    isAdmin: userRole === 'admin',
  };

  console.log('Auth context value:', { user: !!user, loading: !isFullyLoaded, roleLoading, userRole, isAdmin: userRole === 'admin' });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
