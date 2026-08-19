// frontend/src/lib/firebase.ts
// Firebase client SDK configuration

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
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

/**
 * Inicia o login com Google usando REDIRECT (fluxo recomendado para browsers
 * modernos que bloqueiam cookies de terceiros — Chrome, Safari, Brave).
 *
 * Após o utilizador escolher a conta, o browser regressa ao site e o token é
 * capturado por `completeRedirectSignIn()` (que usa `getRedirectResult`),
 * chamada uma única vez no carregamento da página.
 */
export async function signInWithGoogle(): Promise<void> {
  console.log('[Firebase] signInWithRedirect: a iniciar redirect para o Google...');
  const auth = getFirebaseAuth();
  await signInWithRedirect(auth, getGoogleProvider());
  console.log('[Firebase] signInWithRedirect: chamada concluída (browser vai sair da página).');
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
    if (!result) {
      console.log('[Firebase] getRedirectResult: SEM resultado pendente (null) — nenhum redirect em curso.');
      return null;
    }

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
  } catch (error: any) {
    // Ignore errors from getRedirectResult (e.g., no pending redirect)
    if (error?.code === 'auth/no-current-user') {
      console.log('[Firebase] getRedirectResult: auth/no-current-user (sem sessão pendente).');
      return null;
    }
    console.error('[Firebase] Erro no redirect sign-in:', error?.code, error?.message);
    throw error;
  }
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
