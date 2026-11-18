import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Mail, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AnimatedButton } from '../lib/motion';

interface AuthPageProps {
  initialMode: 'login' | 'register';
  onBackToSite: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode, onBackToSite }) => {
  const reduced = useReducedMotion();
  const { notify } = useToast();
  const {
    firebaseUser,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    refreshAuthState,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Email verification gate when signed in with unverified email/password account
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
        >
          <div className="mb-6">
            <BrandLogo />
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center mb-4">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#172B4D] mb-2">Verify your email address</h1>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            We sent a verification link to <strong className="text-[#172033]">{firebaseUser.email}</strong>. Please open the link in your inbox, then click below to continue into your workspace.
          </p>
          <div className="space-y-3">
            <AnimatedButton
              className="w-full"
              loading={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await refreshAuthState();
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>I&apos;ve Verified My Email</span>
            </AnimatedButton>
            <AnimatedButton
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await resendVerificationEmail();
                notify('success', 'Verification email sent', 'Please check your inbox or spam folder.');
              }}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Resend Verification Email</span>
            </AnimatedButton>
            <button
              type="button"
              onClick={logout}
              className="w-full text-xs text-slate-500 hover:text-[#172033] py-2 cursor-pointer"
            >
              Sign out and use another account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const handleGoogle = async () => {
    setErrorMsg('');
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
      notify('success', 'Signed in', 'Welcome to InvoicifyPro.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      if (mode === 'reset') {
        await sendPasswordReset(email.trim());
        setInfoMsg('Password reset email sent. Check your inbox for reset instructions.');
      } else if (mode === 'register') {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await registerWithEmail(name, email.trim(), password);
        notify('success', 'Account created', 'Check your email to verify your address.');
      } else {
        await signInWithEmail(email.trim(), password);
        notify('success', 'Welcome back', 'Signed in to InvoicifyPro.');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed' || code === 'auth/admin-restricted-operation') {
        setErrorMsg(
          'Email/Password sign-in is not yet enabled in the Firebase Console for this project. Use one-click Google Sign-In below, or enable Email/Password in Firebase Authentication settings.'
        );
      } else {
        setErrorMsg(err?.message || 'Authentication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col justify-center py-12 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto">
        <button
          type="button"
          onClick={onBackToSite}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#172B4D] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to InvoicifyPro</span>
        </button>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm"
        >
          <div className="mb-6">
            <BrandLogo />
            <h1 className="font-display text-2xl font-bold text-[#172B4D] mt-5">
              {mode === 'login'
                ? 'Sign in to your workspace'
                : mode === 'register'
                  ? 'Create your InvoicifyPro account'
                  : 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'login'
                ? 'Manage invoices, estimates, clients, and cash flow.'
                : mode === 'register'
                  ? 'Start invoicing in USD with AI assistance in minutes.'
                  : 'Enter your email and we will send a reset link.'}
            </p>
          </div>

          {mode !== 'reset' && (
            <>
              <AnimatedButton
                type="button"
                variant="secondary"
                className="w-full mb-5"
                loading={googleSubmitting}
                onClick={handleGoogle}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </AnimatedButton>

              <div className="relative flex items-center justify-center my-5">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-xs text-slate-400 shrink-0">or with email</span>
                <div className="border-t border-slate-200 w-full" />
              </div>
            </>
          )}

          {errorMsg && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 leading-relaxed">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 leading-relaxed">
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jordan Taylor"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setMode('reset');
                      }}
                      className="text-xs text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <AnimatedButton type="submit" className="w-full" loading={submitting}>
              {mode === 'reset' && <KeyRound className="w-4 h-4" />}
              <span>
                {mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Create Account'
                    : 'Send Reset Link'}
              </span>
            </AnimatedButton>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            {mode === 'login' ? (
              <span>
                New to InvoicifyPro?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('register');
                  }}
                  className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Create an account
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setInfoMsg('');
                    setMode('login');
                  }}
                  className="font-semibold text-[#2563EB] hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};
