import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'admin' | 'client' | 'partner';
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

  // Ref to track role across closures — eliminates stale closure bugs
  const roleRef = useRef<UserRole | null>(null);

  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user role:', error);
        return null;
      }

      // Prioritize admin role if user has multiple roles
      const roles = data?.map((r) => r.role) || [];
      if (roles.includes('admin')) return 'admin';

      return (roles[0] as UserRole) || null;
    } catch (error) {
      console.error('Error fetching user role:', error);
      return null;
    }
  };

  const setRoleAndRef = (role: UserRole | null) => {
    roleRef.current = role;
    setUserRole(role);
  };

  useEffect(() => {
    let initialLoadHandled = false;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'INITIAL_SESSION') {
          // Don't handle loading here — let getSession().then() below handle the initial load
          return;
        }

        // Only re-fetch role on actual sign-in AND only if we don't already have a role
        if (event === 'SIGNED_IN' && roleRef.current === null) {
          setRoleLoading(true);
          Promise.resolve().then(async () => {
            const role = await fetchUserRole(session!.user.id);
            setRoleAndRef(role);
            setRoleLoading(false);
            setLoading(false);
          });
        } else if (event === 'SIGNED_OUT') {
          setRoleAndRef(null);
          setRoleLoading(false);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Silently update session — never clear the existing role
          // Only flip loading off if it was still true (e.g. edge case)
          setRoleLoading(false);
          setLoading(false);
        } else if (event === 'SIGNED_IN' && roleRef.current !== null) {
          // Role already known — just make sure loading is false
          setRoleLoading(false);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (initialLoadHandled) return;
      initialLoadHandled = true;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setRoleLoading(true);
        fetchUserRole(session.user.id).then((role) => {
          setRoleAndRef(role);
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
    setRoleAndRef(null);
    setRoleLoading(false);
    setLoading(false);
  };

  // Only consider fully loaded when both auth and role are resolved
  const isFullyLoaded = !loading && !roleLoading;

  const value = {
    user,
    session,
    loading: !isFullyLoaded,
    userRole,
    signIn,
    signUp,
    signOut,
    isAdmin: userRole === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
