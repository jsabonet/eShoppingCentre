// frontend/src/lib/firebase.ts
// Firebase client SDK configuration

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Lazy initialization — only initialize Firebase when actually needed
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _googleProvider: GoogleAuthProvider | null = null;

function getApp(): FirebaseApp {
  if (!_app) {
    const config = getFirebaseConfig();
    if (!config.apiKey) {
      throw new Error(
        'Firebase não está configurado. Verifica as variáveis NEXT_PUBLIC_FIREBASE_* no .env.local',
      );
    }
    if (!getApps().length) {
      _app = initializeApp(config);
    } else {
      _app = getApps()[0];
    }
  }
  return _app;
}

function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getApp());
  }
  return _auth;
}

function getGoogleProvider(): GoogleAuthProvider {
  if (!_googleProvider) {
    _googleProvider = new GoogleAuthProvider();
    _googleProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return _googleProvider;
}

export interface FirebaseSignInResult {
  idToken: string;
  uid: string;
  email: string | null;
}

/**
 * Inicia o login com Google.
 * - Desenvolvimento/localhost: usa POPUP (fiável em desktop).
 * - Produção: usa REDIRECT (necessário em mobile, onde popups são bloqueados).
 *
 * Devolve o idToken/uid quando o popup resolve logo; devolve null quando usa
 * redirect (o resultado é capturado no reload via `completeRedirectSignIn`/listener).
 */
export async function signInWithGoogle(): Promise<FirebaseSignInResult | null> {
  const auth = getFirebaseAuth();
  const provider = getGoogleProvider();

  if (process.env.NODE_ENV === 'production') {
    console.log('[Firebase] signInWithRedirect (produção): a iniciar redirect para o Google...');
    await signInWithRedirect(auth, provider);
    return null;
  }

  console.log('[Firebase] signInWithPopup (dev): a abrir popup do Google...');
  try {
    const result = await signInWithPopup(auth, provider);
    const idToken = await result.user.getIdToken();
    console.log('[Firebase] popup OK | email=', result.user.email, '| idToken len=', idToken.length);
    return { idToken, uid: result.user.uid, email: result.user.email };
  } catch (error: any) {
    if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/cancelled-popup-request') {
      console.log('[Firebase] popup bloqueado — fallback para redirect.');
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw error;
  }
}

/**
 * Complete sign-in after a redirect.
 * Call this on page load to handle the return from signInWithRedirect.
 * Returns null if there is no pending redirect result.
 */
export async function completeRedirectSignIn(): Promise<{
  idToken: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  firebaseUid: string;
} | null> {
  const auth = getFirebaseAuth();
  console.log('[Firebase] completeRedirectSignIn: a chamar getRedirectResult()...');
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      console.log('[Firebase] getRedirectResult: utilizador obtido | uid=', result.user.uid, '| email=', result.user.email);
      const idToken = await result.user.getIdToken();
      console.log('[Firebase] getIdToken OK | idToken len=', idToken.length);
      return {
        idToken,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        firebaseUid: result.user.uid,
      };
    }
    console.log('[Firebase] getRedirectResult: SEM resultado pendente (null).');
  } catch (error: any) {
    if (error?.code === 'auth/no-current-user') {
      console.log('[Firebase] getRedirectResult: auth/no-current-user (sem sessão pendente).');
    } else {
      console.error('[Firebase] Erro no redirect sign-in:', error?.code, error?.message);
      throw error;
    }
  }

  // Fallback: alguns browsers perdem o resultado do redirect (handoff cross-origin),
  // mas a sessão fica persistida. Verificamos o utilizador atual.
  try {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user) {
      const isGoogle = (user.providerData || []).some((p) => p.providerId === 'google.com');
      console.log('[Firebase] fallback authStateReady | currentUser=', user.email, '| google=', isGoogle);
      if (isGoogle) {
        const idToken = await user.getIdToken();
        console.log('[Firebase] fallback: idToken obtido | len=', idToken.length);
        return {
          idToken,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          firebaseUid: user.uid,
        };
      }
    } else {
      console.log('[Firebase] fallback authStateReady: sem currentUser (sem sessão Google).');
    }
  } catch (e: any) {
    console.error('[Firebase] fallback authStateReady falhou:', e?.code || e?.message || e);
  }

  return null;
}

/**
 * Get the Firebase Auth instance (for use in redirect result handling).
 */
export { getFirebaseAuth };

/**
 * Sign out from Firebase and clear local state.
 */
export async function signOutFirebase(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await signOut(auth);
  } catch {
    // Firebase may not be initialized — ignore
  }
}

/**
 * Listen to Firebase auth state changes.
 */
export function onFirebaseAuthStateChanged(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  try {
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, callback);
  } catch {
    // Firebase not initialized — return a no-op unsubscribe
    return () => {};
  }
}
