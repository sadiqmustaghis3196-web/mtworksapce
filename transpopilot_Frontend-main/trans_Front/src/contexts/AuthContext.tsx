import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import {  disableDemoMode } from '../lib/demoData';
import { markUserAuthenticated } from '../api/monitoring';
import { logDebug, logError, logInfo } from '../lib/logger';
import { API_BASE_URL } from '../lib/apiConfig';

interface Organization {
  id: string;
  name: string;
  subscription_tier: 'trial' | 'starter' | 'pro' | 'enterprise';
}

interface UserProfile {
  id: string;
  organization_id: string | null;
  role: 'user' | 'admin' | 'super_admin' | 'fleet_manager' | 'driver' | 'safety_manager' | 'hr' | 'dispatcher';
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  organization?: Organization;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isGuestMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;

  signUp: (email: string, password: string, fullName?: string, role?: string, companyName?: string, onProgress?: (message: string) => void) => Promise<void>;
  signOut: () => Promise<void>;
  resendConfirmationEmail: (email: string) => Promise<void>;
  exitGuestMode: () => void;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isFleetManager: () => boolean;
  isDispatcher: () => boolean;
  isDriver: () => boolean;
  isEnterprise: () => boolean;
  refreshProfile: () => Promise<void>;
  seedDemoData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuestMode, setIsGuestMode] = useState(false);

  let profileFetchFailures = 0;

  const fetchProfile = async (userId: string, attempt = 1): Promise<UserProfile | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return null;

      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${sessionData.session.access_token}` }
      });
      
      const result = await res.json();
      
      if (!res.ok || !result.success) {
        logError('Error fetching user profile from backend', result.error);
        
        if (res.status === 401) {
          profileFetchFailures++;
          if (profileFetchFailures >= 3) {
            logError('Session expired or invalid after 3 attempts, forcing sign out.');
            await supabase.auth.signOut();
            profileFetchFailures = 0;
            alert('Your session has expired or is invalid. Please log in again.');
            window.location.href = '/?tab=login';
            return null;
          }
        }
        
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          logInfo(`Retrying profile fetch (attempt ${attempt + 1}/3) in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          return fetchProfile(userId, attempt + 1);
        }

        return null;
      }
      
      profileFetchFailures = 0;
      const data = result.data;

      if (data) {
        await supabase
          .from('user_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      }

      return data;
    } catch (error) {
      logError('Error in fetchProfile', error);
      if (attempt < 3) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(r => setTimeout(r, delay));
        return fetchProfile(userId, attempt + 1);
      }
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        logError('getSession error, clearing session', error);
        supabase.auth.signOut().catch(() => {});
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsGuestMode(true);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          // Mark user as authenticated for API monitoring
          markUserAuthenticated();
          setLoading(false);
        });
      } else {
        // No authenticated user - enable guest mode automatically
        setIsGuestMode(true);
        setProfile(null);
        setLoading(false);
      }
    }).catch((err) => {
      logError('getSession fatal error, clearing session', err);
      supabase.auth.signOut().catch(() => {});
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsGuestMode(true);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if ((_event as string) === 'TOKEN_REFRESH_FAILED') {
        logError('Token refresh failed, signing out');
        supabase.auth.signOut().catch(() => {});
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
        setSession(null);
        setUser(null);
        setProfile(null);
        setIsGuestMode(true);
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // User logged in - disable guest mode
        setIsGuestMode(false);
        
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          // Mark user as authenticated for API monitoring
          markUserAuthenticated();
          setLoading(false);
        });
      } else {
        // User logged out - re-enable guest mode
        setIsGuestMode(true);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const seedDemoData = async () => {};

  const signIn = async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        if (
          error.message.includes('Invalid login credentials') ||
          error.message.includes('invalid_grant') ||
          error.message.includes('User not found') ||
          error.message.includes('wrong password')
        ) {
          throw new Error('Invalid email or password.');
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('EMAIL_NOT_CONFIRMED: Please verify your email address before signing in. Check your inbox for a confirmation link.');
        }
        if (error.message.includes('Email link is invalid or has expired')) {
          throw new Error('EMAIL_LINK_EXPIRED: Your confirmation link has expired. Please request a new one.');
        }
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
          throw new Error('Network error: Unable to reach the authentication server. Please check your internet connection and try again.');
        }
        if (error.message.includes('rate limit') || error.message.includes('Too many requests')) {
          throw new Error('Too many login attempts. Please wait a few moments before trying again.');
        }
        // Fallback to generic message for security instead of leaking internal database or account details
        throw new Error('Invalid email or password.');
      }

      if (data.user) {
        const profileData = await fetchProfile(data.user.id);
        setProfile(profileData);
        // Mark user as authenticated for API monitoring
        markUserAuthenticated();
      }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to reach the authentication server. Please check your internet connection and try again.');
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Invalid email or password.');
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName?: string,
    role: string = 'user',
    companyName?: string,
    onProgress?: (message: string) => void
  ) => {
    try {
      onProgress?.('Creating your account...');
      logDebug('Starting signup process');

      const normalizedEmail = email.trim().toLowerCase();

      // Auto-generate fullName if not provided
      const generatedFullName = fullName || (() => {
        const username = normalizedEmail.split('@')[0];
        return username
          .split(/[._-]/)
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      })();

      // Auto-generate companyName if not provided
      const generatedCompanyName = companyName || (() => {
        const domain = normalizedEmail.split('@')[1];
        if (!domain) return 'My Organization';
        const orgName = domain.split('.')[0];
        return orgName.charAt(0).toUpperCase() + orgName.slice(1) + ' Organization';
      })();

      const signupPromise = supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: generatedFullName,
            role: role,
            organization_name: generatedCompanyName,
          },
          emailRedirectTo: undefined,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT: Signup request timed out after 30 seconds. This may indicate a database trigger issue or slow network.')), 30000);
      });

      const { data, error } = await Promise.race([signupPromise, timeoutPromise]);

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          logInfo('Signup attempt with existing email');
          // Security hardening: Generic response prevents email harvesting/account enumeration
          throw new Error('EMAIL_CONFIRMATION_REQUIRED: If this is a new account, a confirmation link has been sent to your email. If you already have an account, please sign in.');
        }
        if (error.message.includes('Password')) {
          logInfo('Signup attempt with weak password');
          throw new Error('WEAK_PASSWORD: Password must be at least 12 characters long and not easily guessable.');
        }
        if (error.message.includes('Email rate limit exceeded') || error.message.includes('rate limit')) {
          logInfo('Signup rate limit exceeded');
          throw new Error('RATE_LIMIT: Too many attempts. Please wait a moment and try again.');
        }

        logError('Signup error details', {
          status: error.status,
          name: error.name,
        });

        if (error.message.includes('fetch') || error.message.includes('network')) {
          throw new Error('Network error: Unable to reach the server. Please check your connection and try again.');
        }

        throw new Error(`Signup failed: ${error.message}`);
      }

      if (!data.user) {
        throw new Error('Account creation failed. Please try again.');
      }

      logInfo('User created successfully', { userId: data.user.id });

      if (data.user && !data.session) {
        logDebug('Email confirmation required', { email });
        throw new Error('EMAIL_CONFIRMATION_REQUIRED: Account created successfully! Please check your email and click the confirmation link to activate your account.');
      }

      if (!data.session) {
        throw new Error('Session creation failed. Please try signing in.');
      }

      onProgress?.('Loading your profile...');

      let retries = 0;
      const maxRetries = 5;
      let profileData = null;

      while (retries < maxRetries && !profileData) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1)));
        profileData = await fetchProfile(data.user.id);
        if (!profileData) {
          logDebug(`Profile not found, retry ${retries + 1}/${maxRetries}`);
          retries++;
        }
      }

      if (!profileData) {
        throw new Error('Profile creation timed out. Please try signing in.');
      }

      setProfile(profileData);

      // onProgress?.('Setting up demo data...');
      // Demo data seeding has been removed for production signups.
      // If demo mode intentionally needs it, it should be behind an explicit flag.

      // Mark user as authenticated for API monitoring
      markUserAuthenticated();

      onProgress?.('Account setup complete!');
    } catch (error) {
      if (error instanceof Error && (
        error.message.startsWith('ALREADY_REGISTERED:') || 
        error.message.startsWith('WEAK_PASSWORD:') ||
        error.message.startsWith('RATE_LIMIT:') ||
        error.message.startsWith('EMAIL_CONFIRMATION_REQUIRED:')
      )) {
        // Expected validation/flow error, pass it up without logging as a severe exception
        throw error;
      }
      logError('SignUp exception', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create account. Please try again.');
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setProfile(null);
      // Guest mode will be re-enabled by the auth state change listener
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Failed to sign out');
    }
  };

  const resendConfirmationEmail = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) {
        if (error.message.includes('rate limit')) {
          throw new Error('Too many requests. Please wait a few minutes before trying again.');
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to resend confirmation email. Please try again.');
    }
  };

  const exitGuestMode = () => {
    // This just clears the guest mode flag, useful for prompting user to sign in
    setIsGuestMode(false);
    
  };

  const isAdmin = useCallback(() => {
    return profile?.role === 'admin' || profile?.role === 'super_admin';
  }, [profile?.role]);

  const isSuperAdmin = useCallback(() => {
    return profile?.role === 'super_admin';
  }, [profile?.role]);

  const isFleetManager = useCallback(() => {
    return profile?.role === 'fleet_manager' || profile?.role === 'admin' || profile?.role === 'super_admin';
  }, [profile?.role]);

  const isDispatcher = useCallback(() => {
    return profile?.role === 'dispatcher';
  }, [profile?.role]);

  const isDriver = useCallback(() => {
    return profile?.role === 'driver';
  }, [profile?.role]);

  const isEnterprise = useCallback(() => {
    return profile?.organization?.subscription_tier === 'enterprise';
  }, [profile?.organization?.subscription_tier]);

  const value = {
    user,
    profile,
    session,
    loading,
    isGuestMode,
    signIn,
    signUp,
    signOut,
    resendConfirmationEmail,
    exitGuestMode,
    isAdmin,
    isSuperAdmin,
    isFleetManager,
    isDispatcher,
    isDriver,
    isEnterprise,
    refreshProfile,
    seedDemoData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
