// frontend/src/lib/firebase.ts
// Firebase client SDK configuration

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
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
 * Sign in with Google popup.
 * Returns the Firebase ID token to exchange for backend JWT.
 */
export async function signInWithGoogle(): Promise<{
  idToken: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  firebaseUid: string;
}> {
  const auth = getFirebaseAuth();
  const provider = getGoogleProvider();
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();

  return {
    idToken,
    email: result.user.email,
    displayName: result.user.displayName,
    photoURL: result.user.photoURL,
    firebaseUid: result.user.uid,
  };
}

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
