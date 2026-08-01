'use client';

import { useState, useEffect, useMemo, createContext, useContext, useCallback, type ReactNode } from 'react';
import { authAPI, usersAPI, type User } from '@/src/lib/api';
import { signInWithGoogle, signOutFirebase } from '@/src/lib/firebase';
import { useInactivityTimer } from '@/src/hooks/useInactivityTimer';
import SessionExpiryWarning from '@/src/components/SessionExpiryWarning';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  isAffiliate: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Sign in with Google via Firebase popup. */
  loginWithGoogle: () => Promise<{ isNewUser: boolean }>;
  register: (data: {
    email: string;
    username: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await usersAPI.me();
      setUser(data);
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    // Fetch user profile after login (Django only returns tokens)
    const userRes = await usersAPI.me();
    setUser(userRes.data);
  };

  const registerFn = async (formData: {
    email: string;
    username: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    const { data } = await authAPI.register(formData);
    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);
    // Fetch user profile after register
    const userRes = await usersAPI.me();
    setUser(userRes.data);
  };

  const logout = () => {
    // Sign out from Firebase if the user logged in via Google
    signOutFirebase().catch(() => {});
    authAPI.logout();
    setUser(null);
  };

  // ─── Session inactivity timer (only active when authenticated) ───
  const { remaining, showWarning, resetTimer } = useInactivityTimer({
    timeout: 30 * 60 * 1000,      // 30 minutes inactivity
    warningBefore: 60 * 1000,      // warn 1 minute before
    onLogout: logout,
  });

  const loginWithGoogle = useCallback(async (): Promise<{ isNewUser: boolean }> => {
    // Step 1: Firebase popup → get ID token
    const { idToken } = await signInWithGoogle();

    // Step 2: Exchange Firebase ID token for backend JWT
    const { data } = await authAPI.firebaseLogin(idToken);

    localStorage.setItem('access_token', data.access);
    localStorage.setItem('refresh_token', data.refresh);

    // User info already comes in the response from firebaseLogin
    setUser(data.user);

    return { isNewUser: data.is_new_user };
  }, []);

  return (
    <AuthContext.Provider
      value={useMemo(() => ({
        user,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.roles?.includes('admin') ?? false,
        isSeller: user?.roles?.includes('seller') ?? false,
        isAffiliate: user?.roles?.includes('affiliate') ?? false,
        login,
        register: registerFn,
        logout,
        loginWithGoogle,
      }), [user, loading, login, registerFn, logout, loginWithGoogle])}
    >
      {/* Session expiry warning modal */}
      {user && showWarning && (
        <SessionExpiryWarning
          remaining={remaining}
          onExtend={resetTimer}
          onLogout={logout}
        />
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
