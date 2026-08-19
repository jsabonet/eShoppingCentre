'use client';

import { useState, useEffect, useMemo, createContext, useContext, useCallback, useRef, type ReactNode } from 'react';
import { authAPI, usersAPI, type User } from '@/src/lib/api';
import { signInWithGoogle, signOutFirebase, completeRedirectSignIn, onFirebaseAuthStateChanged } from '@/src/lib/firebase';
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
    username?: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => void;
  /** Refresca o utilizador autenticado (ex: após tornar-se afiliado). */
  refreshUser: () => Promise<void>;
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
    } finally {
      setLoading(false);
    }
  }, []);

  // Dedup do exchange entre o caminho popup e o listener onAuthStateChanged
  const lastHandledUid = useRef<string | null>(null);

  const exchangeFirebaseToken = useCallback(
    async (firebaseUser: {
      uid: string;
      email: string | null;
      getIdToken: () => Promise<string>;
    }): Promise<{ isNewUser: boolean } | null> => {
      if (!firebaseUser || lastHandledUid.current === firebaseUser.uid) return null;
      lastHandledUid.current = firebaseUser.uid;
      try {
        console.log('[GoogleLogin] Utilizador Firebase detetado | email=', firebaseUser.email);
        const idToken = await firebaseUser.getIdToken();
        console.log('[GoogleLogin] A trocar idToken pelo JWT do backend | idToken len=', idToken.length);
        const { data } = await authAPI.firebaseLogin(idToken);
        console.log('[GoogleLogin] backend OK | user=', data.user?.email, '| is_new_user=', data.is_new_user);
        localStorage.setItem('access_token', data.access);
        setUser(data.user);
        return { isNewUser: data.is_new_user };
      } catch (err: any) {
        console.error(
          '[GoogleLogin] Falha ao concluir login:',
          err?.response?.data || err?.code || err?.message || err,
        );
        throw err;
      }
    },
    [],
  );

  // Captura o resultado do redirect (produção) + mantém sessão Google via listener
  useEffect(() => {
    // Caminho 1: resultado do redirect (getRedirectResult)
    const handleRedirect = async () => {
      console.log('[GoogleLogin] handleRedirect: a correr no mount da página.');
      const redirectData = await completeRedirectSignIn();
      if (redirectData) {
        await exchangeFirebaseToken({
          uid: redirectData.firebaseUid,
          email: redirectData.email,
          getIdToken: async () => redirectData.idToken,
        }).catch(() => {});
      } else {
        console.log('[GoogleLogin] Sem redirectData no getRedirectResult — a aguardar onAuthStateChanged.');
      }
      checkAuth();
    };

    // Caminho 2: listener de estado (cobre browsers que perdem o resultado do redirect)
    const unsubscribe = onFirebaseAuthStateChanged((fbUser) => {
      if (fbUser) {
        console.log('[GoogleLogin] onAuthStateChanged disparou | email=', fbUser.email);
        exchangeFirebaseToken(fbUser).catch(() => {});
      } else {
        // Firebase sem sessão — permite reutilizar a mesma conta mais tarde
        lastHandledUid.current = null;
      }
    });

    handleRedirect();

    return unsubscribe;
  }, [checkAuth, exchangeFirebaseToken]);

  const login = async (email: string, password: string) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('access_token', data.access);
    // Fetch user profile after login (Django only returns tokens)
    const userRes = await usersAPI.me();
    setUser(userRes.data);
  };

  const registerFn = async (formData: {
    email: string;
    username?: string;
    password: string;
    password2: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
  }) => {
    const { data } = await authAPI.register(formData);
    localStorage.setItem('access_token', data.access);
    // Fetch user profile after register
    const userRes = await usersAPI.me();
    setUser(userRes.data);
  };

  const logout = () => {
    // Sign out from Firebase if the user logged in via Google
    signOutFirebase().catch(() => {});
    authAPI.logout();
    setUser(null);
    lastHandledUid.current = null;
  };

  // ─── Session inactivity timer (only active when authenticated) ───
  const { remaining, showWarning, resetTimer } = useInactivityTimer({
    timeout: 30 * 60 * 1000,      // 30 minutes inactivity
    warningBefore: 60 * 1000,      // warn 1 minute before
    onLogout: logout,
  });

  const loginWithGoogle = useCallback(async (): Promise<{ isNewUser: boolean }> => {
    // Dev/localhost: popup (fiável). Produção: redirect (capturado no reload).
    const result = await signInWithGoogle();
    if (result) {
      const exchanged = await exchangeFirebaseToken({
        uid: result.uid,
        email: result.email,
        getIdToken: async () => result.idToken,
      });
      return exchanged ?? { isNewUser: false };
    }
    // Caminho redirect (produção): o token é trocado no reload via onAuthStateChanged.
    return { isNewUser: false };
  }, [exchangeFirebaseToken]);

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
        refreshUser: checkAuth,
        loginWithGoogle,
      }), [user, loading, login, registerFn, logout, loginWithGoogle, checkAuth])}
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
