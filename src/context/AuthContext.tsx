import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from '../lib/firebase';
import { ensureUserAccount } from '../lib/firestoreRepo';
import { BusinessProfile, UserAccount } from '../types/models';

interface AuthContextValue {
  firebaseUser: User | null;
  userAccount: UserAccount | null;
  businessProfile: BusinessProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthState: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testFirestoreConnection();
  }, []);

  useEffect(() => {
    let unsubUser: (() => void) | undefined;
    let unsubProfile: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubUser) unsubUser();
      if (unsubProfile) unsubProfile();

      setFirebaseUser(user);
      if (!user) {
        setUserAccount(null);
        setBusinessProfile(null);
        setLoading(false);
        return;
      }

      if (!user.emailVerified) {
        setUserAccount(null);
        setBusinessProfile(null);
        setLoading(false);
        return;
      }

      try {
        await ensureUserAccount(user.uid, user.email || '', user.displayName || '');
      } catch (err) {
        console.error('Failed to ensure user account:', err);
      }

      unsubUser = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          setUserAccount(snap.exists() ? (snap.data() as UserAccount) : null);
          setLoading(false);
        },
        (error) => {
          setLoading(false);
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        }
      );

      unsubProfile = onSnapshot(
        doc(db, 'businessProfiles', user.uid),
        (snap) => {
          setBusinessProfile(snap.exists() ? (snap.data() as BusinessProfile) : null);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, `businessProfiles/${user.uid}`);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubUser) unsubUser();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleAuthProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    await sendEmailVerification(cred.user);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const resendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const refreshAuthState = async () => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      setFirebaseUser({ ...auth.currentUser } as User);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const isAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    (userAccount?.role === 'admin' || firebaseUser?.email === 'gaetan.boussegui@gmail.com');

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        userAccount,
        businessProfile,
        loading,
        isAdmin,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        sendPasswordReset,
        resendVerificationEmail,
        refreshAuthState,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
