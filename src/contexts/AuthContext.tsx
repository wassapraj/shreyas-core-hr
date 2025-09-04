import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  hasRole: (role: string) => boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Controlled refresh function
  const refreshSession = async () => {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // Guard: Don't refresh if less than 5 minutes since last refresh
    if (now - lastRefresh < fiveMinutes) {
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (!error && data.session) {
        setLastRefresh(now);
        console.log('Session refreshed successfully');
      }
    } catch (error) {
      console.error('Failed to refresh session:', error);
    }
  };

  // Setup refresh scheduler
  const setupRefreshScheduler = (session: Session | null) => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    
    if (session) {
      // Set up 5-minute interval refresh
      refreshIntervalRef.current = setInterval(() => {
        refreshSession();
      }, 5 * 60 * 1000);
      
      // Set up visibility change handler for opportunistic refresh
      const handleVisibilityChange = () => {
        if (!document.hidden && session) {
          const expiresAt = new Date(session.expires_at! * 1000).getTime();
          const now = Date.now();
          const oneHour = 60 * 60 * 1000;
          
          // Refresh if session expires within an hour
          if (expiresAt - now < oneHour) {
            refreshSession();
          }
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Setup or cleanup refresh scheduler
        setupRefreshScheduler(session);
        
        if (session?.user) {
          // Defer role fetching with setTimeout to prevent deadlock
          setTimeout(async () => {
            try {
              const { data: roles } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .order('role', { ascending: false })
                .limit(1);
              
              setUserRole(roles?.[0]?.role || null);
            } catch (error) {
              console.error('Error fetching user role:', error);
              setUserRole(null);
            }
          }, 0);
        } else {
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setupRefreshScheduler(session);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
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
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (role: string) => {
    if (!userRole) return false;
    
    const roleHierarchy = { super_admin: 3, hr: 2, employee: 1 };
    const userRolePriority = roleHierarchy[userRole as keyof typeof roleHierarchy] || 0;
    const requiredRolePriority = roleHierarchy[role as keyof typeof roleHierarchy] || 0;
    
    return userRolePriority >= requiredRolePriority;
  };

  const value = {
    user,
    session,
    userRole,
    hasRole,
    isLoading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};