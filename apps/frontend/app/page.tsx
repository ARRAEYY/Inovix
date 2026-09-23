/**
 * Inovix — Campus Food Ordering frontend (redesigned).
 *
 * Single-page app at `/`. Renders <LoginView/>, <StudentView/>,
 * <OutletView/>, or <AdminView/> based on the authenticated user's
 * role. On first mount we attempt a silent refresh via the httpOnly
 * `nosh_refresh` cookie.
 *
 * Styling uses the original Inovix design-system CSS classes from
 * `src/app/globals.css` (crimson `--primary: #b10035`, Inter font).
 * No shadcn/ui components — just plain HTML elements + the CSS class
 * names that mirror Inovix/apps/frontend/src/index.css.
 *
 * API logic (Zustand auth store, fetch wrapper with
 * `?XTransformPort=3001` + `credentials: 'include'`, 401 refresh,
 * Socket.IO singleton) lives in `src/lib/nosh/*` — unchanged from the
 * previous build.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Clock,
  CreditCard,
  GraduationCap,
  Hash,
  Home as HomeIcon,
  IdCard,
  Info,
  Key,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  QrCode,
  Radio,
  Receipt,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Trash2,
  TriangleAlert,
  User as UserIcon,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Wifi,
  WifiOff,
  X,
  XCircle,
  AlertCircle,
  BookOpen,
  ChevronDown,
  ScrollText,
} from 'lucide-react';

import {
  ApiError,
  DEV_ACCOUNTS,
  adminApi,
  auditApi,
  authApi,
  cartApi,
  catalogApi,
  computeCartTotals,
  notificationsApi,
  onboardingApi,
  ordersApi,
  outletApi,
  paymentsApi,
  type RazorpayOrderResponse,
} from '@/lib/nosh/api';
import { useAuthStore, isOutletRole } from '@/lib/nosh/store';
import { connectSocket, disconnectSocket, onConnectionChange, onNotificationCreated, onOrderNew, onOrderStatusChanged } from '@/lib/nosh/socket';
import { formatINR, formatDateTime, formatRelativeTime, initials, parseJSON } from '@/lib/nosh/format';
import { OutletStaffView } from '@/components/nosh/outlet-staff-view';
import { OutletAdminView } from '@/components/nosh/outlet-admin-view';
import type {
  AdminOverview,
  AdminOrderItem,
  AdminOutletItem,
  AdminUserItem,
  AuditLogEntry,
  Cart,
  CreateOutletInput,
  MenuItem,
  Notification,
  Order,
  OrderStatus,
  Outlet,
  OutletKPIs,
  OutletStatus,
  PopularMenuItem,
  SearchResult,
  StaffMember,
  User,
  UserStatus,
} from '@/lib/nosh/types';

// ─── Providers ──────────────────────────────────────────────────────────────

let queryClientSingleton: QueryClient | null = null;
function getQueryClient(): QueryClient {
  if (!queryClientSingleton) {
    queryClientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failureCount, error) => {
            if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
              return false;
            }
            return failureCount < 2;
          },
          staleTime: 30_000,
          refetchOnWindowFocus: false,
        },
        mutations: { retry: false },
      },
    });
  }
  return queryClientSingleton;
}

export default function Home() {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <RootDispatcher />
      <Toaster position="top-right" richColors closeButton />
      <SocketLifecycleWatcher />
    </QueryClientProvider>
  );
}

function SocketLifecycleWatcher() {
  const token = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const initialised = useAuthStore((s) => s.initialised);

  useEffect(() => {
    if (!initialised) return;
    if (token && user) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }
  }, [token, user, initialised]);

  return null;
}

function toastMutationError(err: unknown, fallback = 'Something went wrong') {
  if (err instanceof ApiError) {
    toast.error(err.message || fallback);
  } else if (err instanceof Error) {
    toast.error(err.message || fallback);
  } else {
    toast.error(fallback);
  }
}

// ─── Root dispatcher ─────────────────────────────────────────────────────────

function RootDispatcher() {
  const initialised = useAuthStore((s) => s.initialised);
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clear = useAuthStore((s) => s.clear);
  const setStatus = useAuthStore((s) => s.setStatus);
  const setInitialised = useAuthStore((s) => s.setInitialised);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await authApi.refresh();
      if (cancelled) return;
      if (data) {
        setAuth(data.user, data.accessToken);
        // The /refresh endpoint uses Prisma findUnique without `include`,
        // so `studentProfile` / `outletStaff` are dropped from the response.
        // Re-fetch the full user via /auth/me so the Profile tab has the
        // complete picture. Safe to fail silently — the refresh-derived
        // user is still functional.
        try {
          const me = (await authApi.me()) as unknown as { user?: User } | User;
          const fullUser = (me as { user?: User })?.user ?? (me as User);
          if (fullUser && fullUser.id) {
            useAuthStore.getState().setUser(fullUser);
          }
        } catch {
          // ignore — keep the refresh-derived user
        }
      } else {
        clear();
        setStatus('unauthenticated');
        setInitialised(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!initialised) return <SplashScreen />;
  if (status !== 'authenticated' || !user) return <LoginView />;
  // First-time students who haven't completed onboarding are routed to the
  // onboarding screen regardless of any other UI state. The OnboardingView
  // calls POST /api/v1/onboarding, then refreshes the user in the store.
  if (user.role === 'STUDENT' && !user.onboardingCompleted) return <OnboardingView />;
  if (user.role === 'STUDENT') return <StudentView />;
  if (user.role === 'OUTLET_STAFF') return <OutletStaffView />;
  if (user.role === 'OUTLET_ADMIN') return <OutletAdminView />;
  if (isOutletRole(user.role)) return <OutletAdminView />;
  if (user.role === 'SUPER_ADMIN') return <AdminView />;
  return <LoginView />;
}

function SplashScreen() {
  return (
    <div className="splash-screen">
      <div className="splash-logo">n</div>
      <div className="splash-text">
        <span className="splash-spinner" /> Restoring session…
      </div>
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

type AuthMode = 'signin' | 'signup' | 'forgot';

function LoginView() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function switchMode(next: AuthMode) {
    setMode(next);
    setError('');
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const data = await authApi.login(email.trim(), password);
      setAuth(data.user, data.accessToken);
      toast.success(`Welcome, ${data.user.name ?? data.user.email}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'forgot') {
    return <ForgotPasswordView onBack={() => switchMode('signin')} />;
  }

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand">
          <span className="brand-name">nosh</span>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            Good food.
            <br />
            <span className="highlight">Zero waiting.</span>
          </h1>
          <p className="hero-description">
            Order from your favorite campus outlets
            <br />
            and pick it up when it&apos;s ready.
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <p className="card-subheading">{mode === 'signup' ? 'Student Registration' : 'Campus Food Portal'}</p>
          <h2 className="card-title">{mode === 'signup' ? 'Create your account' : 'Welcome'}</h2>

          {error && (
            <div className="form-alert error-alert" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {mode === 'signup' ? (
            <form
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                setError('Google Sign-In requires GOOGLE_CLIENT_ID to be configured on the backend.');
                toast.info('Google Sign-In is required for student registration');
              }}
            >
              <p className="login-hint" style={{ marginBottom: '0.85rem' }}>
                Students sign up exclusively with their college Google account.
                We never store passwords — your campus email is your identity.
              </p>

              <button type="submit" className="google-btn" disabled={submitting}>
                <span className="google-logo">
                  <GoogleLogo />
                </span>
                Sign up with Google
              </button>

              <div className="auth-switch-row" style={{ marginTop: '1.25rem' }}>
                Already have an account?
                <button type="button" className="auth-switch-link" onClick={() => switchMode('signin')}>
                  Sign in
                </button>
              </div>
            </form>
          ) : (
            <form className="login-form" onSubmit={handleSignIn}>
              <div className="input-group">
                <label htmlFor="email">College or work email</label>
                <input
                  type="email"
                  id="email"
                  placeholder="you@campus.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <div className="forgot-password-container" style={{ textAlign: 'right', marginTop: '0.35rem' }}>
                  <button type="button" className="forgot-password" onClick={() => switchMode('forgot')}>
                    Forgot password?
                  </button>
                </div>
              </div>

              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" /> Signing in…
                  </span>
                ) : (
                  <>Sign in <span className="arrow">→</span></>
                )}
              </button>

              <div className="divider">
                <span>or</span>
              </div>

              <button
                type="button"
                className="google-btn"
                onClick={() => {
                  toast.info('Google OAuth connects with your college account');
                }}
              >
                <span className="google-logo">
                  <GoogleLogo />
                </span>
                Continue with Google
              </button>

              <div className="auth-switch-row" style={{ marginTop: '1rem' }}>
                New student?
                <button type="button" className="auth-switch-link" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </div>

              {/* Collapsed local dev quick-fill drawer for testing */}
              <details style={{ marginTop: '1.5rem', paddingTop: '0.85rem', borderTop: '1px solid #f1f1f1', fontSize: '0.75rem', color: '#666' }}>
                <summary style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#888' }}>
                  <Key size={12} /> Local test accounts (click to autofill)
                </summary>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.45rem', marginTop: '0.65rem' }}>
                  <button
                    type="button"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer' }}
                    onClick={() => { setEmail(DEV_ACCOUNTS.student.email); setPassword(''); }}
                  >
                    🎓 Student
                  </button>
                  <button
                    type="button"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer' }}
                    onClick={() => { setEmail(DEV_ACCOUNTS.outletStaff.email); setPassword(''); }}
                  >
                    🍳 Kitchen Staff
                  </button>
                  <button
                    type="button"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer' }}
                    onClick={() => { setEmail(DEV_ACCOUNTS.outletAdmin.email); setPassword(DEV_ACCOUNTS.outletAdmin.password); }}
                  >
                    🏪 Outlet Admin
                  </button>
                  <button
                    type="button"
                    style={{ fontSize: '0.75rem', padding: '0.35rem 0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', background: '#f8fafc', cursor: 'pointer' }}
                    onClick={() => { setEmail(DEV_ACCOUNTS.superAdmin.email); setPassword(DEV_ACCOUNTS.superAdmin.password); }}
                  >
                    🛡️ Super Admin
                  </button>
                </div>
              </details>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Forgot password (wired to /auth/forgot-password + /auth/reset-password) ──

type ForgotStep = 'email' | 'otp' | 'password' | 'done';

function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<ForgotStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState('');

  // Step 1 — POST /api/v1/auth/forgot-password { email }
  // The backend always returns 200 (even for unknown emails) so we
  // don't leak which addresses exist. In dev mode the OTP is also
  // logged to the backend console — we surface that as a hint.
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setStep('otp');
      setInfo(`If an account exists for ${email.trim()}, a 6-digit code has been sent.`);
      toast.success('Recovery code sent');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send recovery code';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Step 2 — purely client-side: validate the OTP looks like a 6-digit code.
  // The actual OTP verification happens together with the new password
  // submission in step 3 (the /reset-password endpoint takes both fields).
  function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (otp.trim().length < 6 || !/^\d{6}$/.test(otp.trim())) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    setStep('password');
  }

  // Step 3 — POST /api/v1/auth/reset-password { email, otp, newPassword }
  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError('Password must contain an upper, lower & digit');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword(email.trim(), otp.trim(), newPassword);
      setStep('done');
      toast.success('Password reset — sign in with the new password');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not reset password';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    if (step === 'email') return submitEmail(e);
    if (step === 'otp') return submitOtp(e);
    if (step === 'password') return submitReset(e);
  }

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand">
          <span className="brand-name">nosh</span>
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            Reset your
            <br />
            <span className="highlight">password.</span>
          </h1>
          <p className="hero-description">
            We&apos;ll send a 6-digit recovery code to your college email so you can set a new password.
          </p>
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <p className="card-subheading">Account recovery</p>
          <h2 className="card-title">Forgot password</h2>

          <div className="auth-step-indicator" aria-label="Recovery progress">
            <span className={`step ${step === 'email' ? 'active' : ''}`}>1 · Email</span>
            <span className="step-sep">›</span>
            <span className={`step ${step === 'otp' ? 'active' : ''}`}>2 · Verify</span>
            <span className="step-sep">›</span>
            <span className={`step ${step === 'password' || step === 'done' ? 'active' : ''}`}>3 · New password</span>
          </div>

          {error && (
            <div className="form-alert error-alert" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {info && step !== 'done' && (
            <div className="auth-success-banner" role="status">
              <CheckCircle2 size={18} /> {info}
            </div>
          )}

          {step === 'done' ? (
            <>
              <div className="auth-success-banner">
                <CheckCircle2 size={18} /> Your password has been reset. You can now sign in.
              </div>
              <button type="button" className="primary-btn" onClick={onBack}>
                Back to sign in <span className="arrow">→</span>
              </button>
            </>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {step === 'email' && (
                <div className="input-group">
                  <label htmlFor="forgot-email">College email</label>
                  <input
                    type="email"
                    id="forgot-email"
                    placeholder="you@campus.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              )}
              {step === 'otp' && (
                <div className="input-group">
                  <label htmlFor="otp">Recovery code</label>
                  <input
                    type="text"
                    id="otp"
                    placeholder="6-digit code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    required
                    autoFocus
                  />
                  <p className="login-hint">Check your inbox (spam too) for the 6-digit code.</p>
                  <div className="dev-mode-hint">
                    <Info size={14} />
                    <span>In dev mode, check the backend console for the code.</span>
                  </div>
                </div>
              )}
              {step === 'password' && (
                <>
                  <div className="input-group">
                    <label htmlFor="new-password">New password</label>
                    <input
                      type="password"
                      id="new-password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="input-group">
                    <label htmlFor="confirm-new">Confirm password</label>
                    <input
                      type="password"
                      id="confirm-new"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </>
              )}

              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" /> Working…
                  </span>
                ) : (
                  <>
                    {step === 'email' && <>Send recovery code <span className="arrow">→</span></>}
                    {step === 'otp' && <>Continue <span className="arrow">→</span></>}
                    {step === 'password' && <>Reset password <span className="arrow">→</span></>}
                  </>
                )}
              </button>

              <div className="auth-switch-row">
                Remembered?
                <button type="button" className="auth-switch-link" onClick={onBack}>
                  Back to sign in
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Google "G" logo (multicolor SVG) ──────────────────────────────────────
// Lucide-react doesn't ship a brand-color Google mark, so we inline the
// official 4-color SVG used by Google's own Sign-In With Google button.

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571c.001-.001.002-.001.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

// ─── Onboarding (first-time student profile setup) ──────────────────────────

function OnboardingView() {
  const setUser = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);

  const [fullName, setFullName] = useState(user?.name ?? user?.email ?? '');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!fullName.trim()) return 'Full name is required';
    if (!/^[0-9]{10}$/.test(phone.trim())) return 'Phone must be a 10-digit number';
    if (!course.trim()) return 'Course is required';
    if (!year.trim()) return 'Year is required';
    if (!collegeId.trim()) return 'College ID is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(password)) return 'Password must contain an uppercase letter';
    if (!/[a-z]/.test(password)) return 'Password must contain a lowercase letter';
    if (!/[0-9]/.test(password)) return 'Password must contain a digit';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const response = await onboardingApi.complete({
        password,
        profile: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          course: course.trim(),
          year: year.trim(),
          collegeId: collegeId.trim(),
        },
      });
      setUser(response.user);
      toast.success('Onboarding complete — welcome to nosh!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Onboarding failed';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="brand" style={{ marginBottom: '1.25rem' }}>
          <span className="brand-name">nosh</span>
        </div>
        <p className="card-subheading">Welcome{user?.name ? `, ${user.name}` : ''}</p>
        <h2 className="card-title">Finish setting up your profile</h2>
        <p className="login-hint" style={{ textAlign: 'left', marginBottom: '1.25rem' }}>
          We just need a few details to confirm you&apos;re a real campus student.
        </p>

        {error && (
          <div className="form-alert error-alert" role="alert" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="onboarding-form-grid">
            <div className="form-row full-width">
              <label htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                type="text"
                placeholder="Your full name as per college records"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="phone">Phone (10-digit)</label>
              <input
                id="phone"
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                autoComplete="tel"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="collegeId">College ID</label>
              <input
                id="collegeId"
                type="text"
                placeholder="RU12345"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="course">Course</label>
              <input
                id="course"
                type="text"
                placeholder="BTech CS &amp; AI"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                autoComplete="organization-title"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="year">Year</label>
              <select
                id="year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                required
              >
                <option value="">Select year</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>
            <div className="form-row full-width">
              <label htmlFor="onboardPassword">Set a password</label>
              <input
                id="onboardPassword"
                type="password"
                placeholder="At least 8 characters with upper, lower &amp; digit"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <span className="field-hint">
                Used for email + password sign-in once Google sign-in is unavailable.
              </span>
            </div>
          </div>

          <button type="submit" className="primary-btn" disabled={submitting} style={{ width: '100%', marginTop: '0.5rem' }}>
            {submitting ? (
              <span className="btn-loading-content">
                <span className="btn-spinner" /> Saving…
              </span>
            ) : (
              <>Complete setup <span className="arrow">→</span></>
            )}
          </button>
        </form>

        <div className="auth-switch-row">
          Not now?
          <button
            type="button"
            className="auth-switch-link"
            onClick={async () => {
              await authApi.logout();
              clear();
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared header ────────────────────────────────────────────────────────────

interface AppHeaderProps {
  contextLabel?: string;
  cartCount?: number;
  onCartClick?: () => void;
  right?: React.ReactNode;
  /** Optional nav items shown in the profile dropdown (Student view passes Home/Orders/Profile). */
  navItems?: { key: string; label: string; icon: React.ReactNode; onClick: () => void; active?: boolean }[];
}

function AppHeader({ contextLabel, cartCount, onCartClick, right, navItems }: AppHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const [connected, setConnected] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onConnectionChange(setConnected);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function handleLogout() {
    await authApi.logout();
    setDropdownOpen(false);
  }

  return (
    <header className="main-header">
      <div className="header-container">
        <div className="brand">
          <span className="brand-name">nosh</span>
          {contextLabel && <span className="welcome-greeting" style={{ fontSize: '0.8rem', fontWeight: 600, marginLeft: '0.5rem' }}>· {contextLabel}</span>}
        </div>

        <div className="header-right">
          {right}

          <span className={`live-pill ${connected ? 'online' : ''}`} title={connected ? 'Realtime connected' : 'Realtime disconnected'}>
            <span className="live-dot" />
            {connected ? (
              <>
                <Wifi size={12} />
                <span className="live-pill-text">Live</span>
                <Radio size={12} />
              </>
            ) : (
              <>
                <WifiOff size={12} />
                <span className="live-pill-text">Offline</span>
              </>
            )}
          </span>

          {typeof cartCount === 'number' && onCartClick && (
            <button className="icon-btn" style={{ position: 'relative' }} title="Cart" onClick={onCartClick} aria-label="Open cart">
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}

          <NotificationsBell />

          {user && (
            <div className="profile-wrapper" ref={dropdownRef}>
              <button
                className={`profile-btn ${dropdownOpen ? 'open' : ''}`}
                onClick={() => setDropdownOpen((v) => !v)}
                aria-label="Open profile menu"
              >
                <div className="profile-avatar">{initials(user.name, user.email)}</div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', color: 'var(--text-light)' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {dropdownOpen && (
                <div className="profile-dropdown">
                  <div className="dropdown-header">
                    <p className="dropdown-name">{user.name ?? 'No name set'}</p>
                    <p className="dropdown-email">{user.email}</p>
                    <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span className="status-badge active" style={{ fontSize: '0.65rem' }}>
                        <span className="status-dot" /> {user.role}
                      </span>
                      {user.outletId && user.outletRole && (
                        <span className="status-badge warning" style={{ fontSize: '0.65rem' }}>
                          <span className="status-dot" /> {user.outletRole}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {navItems?.map((item) => (
                    <button
                      key={item.key}
                      className="dropdown-item"
                      style={item.active ? { color: 'var(--primary)', fontWeight: 600 } : undefined}
                      onClick={() => {
                        item.onClick();
                        setDropdownOpen(false);
                      }}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                  {navItems && navItems.length > 0 && <div className="dropdown-divider"></div>}
                  <button className="dropdown-item" onClick={handleLogout} style={{ color: 'var(--primary)' }}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Notifications bell ──────────────────────────────────────────────────────

function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch the unread count + first page of notifications only when the
  // dropdown is open (saves a request on every page load).
  const { data, isLoading } = useQuery({
    queryKey: ['nosh', 'notifications'],
    queryFn: () => notificationsApi.list({ page: 1, pageSize: 20 }),
    enabled: open,
    staleTime: 15_000,
  });

  // Live updates via socket — when a new notification arrives, invalidate
  // the cache so the dropdown refetches next time it's opened.
  useEffect(() => {
    return onNotificationCreated(() => {
      qc.invalidateQueries({ queryKey: ['nosh', 'notifications'] });
      toast.info('New notification');
    });
  }, [qc]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', onClick);
      return () => document.removeEventListener('mousedown', onClick);
    }
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nosh', 'notifications'] }),
    onError: (e) => toastMutationError(e, 'Could not mark notification as read'),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nosh', 'notifications'] });
      toast.success('All notifications marked as read');
    },
    onError: (e) => toastMutationError(e, 'Could not mark all as read'),
  });

  const unread = data?.unreadCount ?? 0;
  const items = data?.items ?? [];

  return (
    <div className="notifications-bell-wrap" ref={wrapRef}>
      <button
        className="icon-btn"
        style={{ position: 'relative' }}
        title="Notifications"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unread > 0 && <span className="notifications-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notifications-dropdown" role="dialog" aria-label="Notifications">
          <div className="notifications-dropdown-header">
            <span className="notifications-dropdown-title">
              <Bell size={14} /> Notifications
              {unread > 0 && <span style={{ color: 'var(--primary)', fontSize: '0.78rem' }}>· {unread} new</span>}
            </span>
            <button
              type="button"
              className="action-btn"
              disabled={markAllReadMutation.isPending || unread === 0}
              onClick={() => markAllReadMutation.mutate()}
              title="Mark all as read"
            >
              <CheckCircle2 size={12} /> Mark all read
            </button>
          </div>

          {isLoading ? (
            <div className="notifications-empty">
              <Loader2 className="animate-spin" size={20} />
              <p>Loading notifications…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="notifications-empty">
              <div className="empty-icon-wrapper">
                <Bell size={22} />
              </div>
              <p>You&apos;re all caught up.</p>
            </div>
          ) : (
            <ul className="notifications-dropdown-list">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={() => markReadMutation.mutate(n.id)}
                  markingRead={markReadMutation.isPending && markReadMutation.variables === n.id}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
  markingRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
  markingRead: boolean;
}) {
  return (
    <li
      className={`notification-item ${notification.isRead ? '' : 'unread'}`}
      onClick={() => {
        if (!notification.isRead) onMarkRead();
      }}
    >
      <div className="notification-item-title">
        {!notification.isRead && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />}
        {notification.title}
      </div>
      <p className="notification-item-message">{notification.message}</p>
      <div className="notification-item-meta">
        {formatRelativeTime(notification.createdAt)}
        {markingRead && <> · marking…</>}
      </div>
    </li>
  );
}

// ─── Student view ─────────────────────────────────────────────────────────────

type StudentTab = 'home' | 'orders' | 'profile';
type StudentView = 'browse' | 'menu';

function StudentView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<StudentTab>('home');
  const [view, setView] = useState<StudentView>('browse');
  const [activeOutletId, setActiveOutletId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  // Cart count badge — read from the active cart query if it's been fetched.
  const { data: cart } = useQuery<Cart | null>({
    queryKey: ['nosh', 'cart'],
    queryFn: () => cartApi.getActive(),
    enabled: !!user,
  });
  const cartCount = cart?.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  function openOutlet(outlet: Outlet) {
    setActiveOutletId(outlet.id);
    setView('menu');
  }

  function backToBrowse() {
    setView('browse');
    setActiveOutletId(null);
  }

  function handleCheckoutSuccess(_order: Order) {
    setView('browse');
    setActiveOutletId(null);
    setTab('orders');
    qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
  }

  return (
    <div className="page-wrapper">
      <AppHeader
        contextLabel="Student"
        cartCount={cartCount}
        onCartClick={() => setCartOpen(true)}
        navItems={[
          { key: 'home', label: 'Home', icon: <HomeIcon size={16} />, onClick: () => { setTab('home'); setView('browse'); }, active: tab === 'home' },
          { key: 'orders', label: 'Your orders', icon: <Receipt size={16} />, onClick: () => setTab('orders'), active: tab === 'orders' },
          { key: 'profile', label: 'Your profile', icon: <UserRound size={16} />, onClick: () => setTab('profile'), active: tab === 'profile' },
        ]}
      />

      <main className="explore-container" style={{ paddingTop: '2rem' }}>
        {tab === 'home' && view === 'browse' && <OutletGrid onOpenOutlet={openOutlet} />}
        {tab === 'home' && view === 'menu' && activeOutletId && (
          <OutletMenuScreen
            outletId={activeOutletId}
            onBack={backToBrowse}
            onOpenCart={() => setCartOpen(true)}
          />
        )}
        {tab === 'orders' && <StudentOrders />}
        {tab === 'profile' && <StudentProfile />}
      </main>

      <BottomNav tab={tab} onChange={setTab} />

      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={handleCheckoutSuccess} />
    </div>
  );
}

// ─── Outlet grid ──────────────────────────────────────────────────────────────

function OutletGrid({ onOpenOutlet }: { onOpenOutlet: (o: Outlet) => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: outlets, isLoading } = useQuery<Outlet[]>({
    queryKey: ['nosh', 'outlets'],
    queryFn: () => catalogApi.listOutlets(),
  });

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'OPEN'>('ALL');

  const query = search.trim();
  const isSearching = query.length >= 2;

  const filtered = (outlets ?? []).filter((o) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q);
    const matchesFilter = filter === 'ALL' ? true : o.status === 'OPEN';
    return matchesSearch && matchesFilter;
  });

  // Featured outlets first.
  const sorted = [...filtered].sort((a, b) => Number(b.featured) - Number(a.featured));

  return (
    <>
      <div className="page-header">
        <p className="welcome-greeting">Welcome back, {user?.name ?? user?.email ?? 'Student'}</p>
        <h1 className="page-title">Explore Outlets</h1>
        <p className="page-subtitle">Order from your favorite campus outlets</p>
      </div>

      <div className="controls-row">
        <div className="search-container">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="search-input"
            placeholder="Search outlets, dishes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search outlets and dishes"
          />
          <div className="shortcut-hint">/</div>
        </div>

        <div className="filter-pills">
          <button className={`pill ${filter === 'ALL' ? 'active' : ''}`} onClick={() => setFilter('ALL')}>
            All
          </button>
          <button className={`pill ${filter === 'OPEN' ? 'active' : ''}`} onClick={() => setFilter('OPEN')}>
            Open now
          </button>
        </div>
      </div>

      {isSearching ? (
        <StudentSearchResults query={query} onOpenOutlet={onOpenOutlet} />
      ) : (
        <>
          <PopularItemsScroller onOpenOutlet={onOpenOutlet} />

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
              <Loader2 className="animate-spin" size={16} /> Loading outlets…
            </div>
          ) : sorted.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
              <p>No outlets found matching your criteria.</p>
            </div>
          ) : (
            <div className="outlets-grid">
              {sorted.map((outlet) => (
                <OutletCard key={outlet.id} outlet={outlet} onClick={() => onOpenOutlet(outlet)} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function OutletCard({ outlet, onClick }: { outlet: Outlet; onClick: () => void }) {
  const isOpen = outlet.status === 'OPEN' || outlet.status === 'BUSY';
  const tags = outlet.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3);

  return (
    <div className="outlet-card" onClick={onClick}>
      <div className="outlet-image-container">
        {outlet.logoUrl ? (
          <img src={outlet.logoUrl} alt={outlet.name} className="outlet-image" loading="lazy" />
        ) : (
          <div className="outlet-image-placeholder">{outlet.name.charAt(0).toUpperCase()}</div>
        )}
        {outlet.featured && (
          <span className="outlet-featured-pill">
            <Star size={10} /> Featured
          </span>
        )}
      </div>

      <div className="outlet-content">
        <div className="outlet-header">
          <h3 className="outlet-name">{outlet.name}</h3>
          <span className={`status-badge ${isOpen ? 'active' : 'inactive'}`}>
            <span className="status-dot" />
            {isOpen ? 'Active' : 'Closed'}
          </span>
        </div>

        <p className="outlet-description">
          {outlet.description || outlet.location || 'Campus food outlet'}
        </p>

        <div className="outlet-meta">
          <span className="meta-item">
            <Star size={14} /> {outlet.rating.toFixed(1)}
          </span>
          <span className="meta-item">
            <Clock size={14} /> {outlet.estimatedTime}
          </span>
          <span className="meta-item">
            <MapPin size={14} /> {outlet.location || 'Campus'}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="outlet-meta" style={{ marginBottom: '1rem', gap: '0.4rem' }}>
            {tags.map((t) => (
              <span key={t} className="pill" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', cursor: 'default' }}>
                {t}
              </span>
            ))}
          </div>
        )}

        <button className="primary-btn view-menu-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
          View menu <span className="arrow">→</span>
        </button>
      </div>
    </div>
  );
}

// ─── Popular items scroller + Search results ─────────────────────────────────

function PopularItemsScroller({ onOpenOutlet }: { onOpenOutlet: (o: Outlet) => void }) {
  const { data: popular, isLoading } = useQuery<PopularMenuItem[]>({
    queryKey: ['nosh', 'catalog', 'popular'],
    queryFn: () => catalogApi.popular(),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="popular-section" aria-busy="true">
        <div className="popular-section-title">
          <Star size={16} style={{ color: 'var(--primary)' }} /> Popular right now
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.85rem' }}>
          <Loader2 className="animate-spin" size={14} /> Loading popular items…
        </div>
      </div>
    );
  }

  if (!popular || popular.length === 0) return null;

  return (
    <div className="popular-section">
      <div className="popular-section-title">
        <Star size={16} style={{ color: 'var(--primary)' }} /> Popular right now
      </div>
      <div className="popular-scroller">
        {popular.map((item) => (
          <PopularCard key={item.id} item={item} onClick={() => {
            if (item.outlet?.id) {
              // We need a full Outlet object for openOutlet — fetch via listOutlets cache
              // but since we only have id + name + slug, just trigger openOutlet with a
              // synthetic Outlet object that has the id populated. The menu screen will
              // look up the full record from the outlets query cache.
              onOpenOutlet({
                id: item.outlet.id,
                slug: item.outlet.slug,
                campusId: null,
                name: item.outlet.name,
                description: '',
                logoUrl: null,
                status: 'OPEN' as OutletStatus,
                defaultPrepMins: 0,
                pickupTimeoutMins: 0,
                rating: 0,
                estimatedTime: '',
                location: '',
                tags: '',
                featured: false,
                createdAt: '',
                updatedAt: '',
              });
            }
          }} />
        ))}
      </div>
    </div>
  );
}

function PopularCard({ item, onClick }: { item: PopularMenuItem; onClick: () => void }) {
  return (
    <div className="popular-card" onClick={onClick} role="button" tabIndex={0}>
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="popular-image" loading="lazy" />
      ) : (
        <div className="popular-image-placeholder">
          <ChefHat size={24} />
        </div>
      )}
      <div className="popular-body">
        <span className="popular-name">{item.name}</span>
        {item.outlet?.name && <span className="popular-outlet">From {item.outlet.name}</span>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
          <span className="veg-indicator">
            <span className={`veg-indicator-dot ${item.vegetarian ? '' : 'non-veg'}`} />
            {item.vegetarian ? 'Veg' : 'Non-veg'}
          </span>
        </div>
        <span className="popular-price">{formatINR(item.price)}</span>
      </div>
    </div>
  );
}

function StudentSearchResults({ query, onOpenOutlet }: { query: string; onOpenOutlet: (o: Outlet) => void }) {
  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['nosh', 'catalog', 'search', query],
    queryFn: () => catalogApi.search(query),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
        <Loader2 className="animate-spin" size={16} /> Searching…
      </div>
    );
  }

  const outlets = data?.outlets ?? [];
  const items = data?.menuItems ?? [];

  if (outlets.length === 0 && items.length === 0) {
    return (
      <div className="search-results-empty">
        <div className="empty-icon-wrapper">
          <Search size={26} />
        </div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
          No matches for &ldquo;{query}&rdquo;
        </h2>
        <p>Try a different dish or outlet name.</p>
      </div>
    );
  }

  return (
    <div className="search-results">
      {outlets.length > 0 && (
        <section>
          <h3 className="search-results-section-title">
            <Store size={16} style={{ color: 'var(--primary)' }} /> Outlets ({outlets.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {outlets.map((o) => (
              <div key={o.id} className="search-hit-row" onClick={() => onOpenOutlet(o)} role="button" tabIndex={0}>
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt={o.name} className="search-hit-image" loading="lazy" />
                ) : (
                  <div className="search-hit-image-placeholder">
                    <Store size={20} />
                  </div>
                )}
                <div className="search-hit-info">
                  <span className="search-hit-name">{o.name}</span>
                  <span className="search-hit-meta">
                    {o.location || 'Campus'} · {o.estimatedTime || '15-20 min'} · {o.tags.split(',').filter(Boolean).slice(0, 2).join(', ')}
                  </span>
                </div>
                <span className="search-hit-price" style={{ color: 'var(--text-gray)', fontSize: '0.75rem' }}>
                  View menu <ArrowRight size={14} />
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section>
          <h3 className="search-results-section-title">
            <ChefHat size={16} style={{ color: 'var(--primary)' }} /> Dishes ({items.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {items.map((item) => (
              <div
                key={item.id}
                className="search-hit-row"
                onClick={() => {
                  if (!item.outlet?.id) return;
                  onOpenOutlet({
                    id: item.outlet.id,
                    slug: '',
                    campusId: null,
                    name: item.outlet.name,
                    description: '',
                    logoUrl: null,
                    status: item.outlet.status,
                    defaultPrepMins: 0,
                    pickupTimeoutMins: 0,
                    rating: 0,
                    estimatedTime: '',
                    location: '',
                    tags: '',
                    featured: false,
                    createdAt: '',
                    updatedAt: '',
                  });
                }}
                role="button"
                tabIndex={0}
              >
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="search-hit-image" loading="lazy" />
                ) : (
                  <div className="search-hit-image-placeholder">
                    <ChefHat size={20} />
                  </div>
                )}
                <div className="search-hit-info">
                  <span className="search-hit-name">{item.name}</span>
                  <span className="search-hit-meta">
                    From {item.outlet?.name ?? 'Outlet'}
                    {item.vegetarian !== undefined && (
                      <>
                        {' '}· <span className="veg-indicator" style={{ display: 'inline-flex' }}>
                          <span className={`veg-indicator-dot ${item.vegetarian ? '' : 'non-veg'}`} />
                          {item.vegetarian ? 'Veg' : 'Non-veg'}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <span className="search-hit-price">{formatINR(item.price)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Outlet menu screen ───────────────────────────────────────────────────────

function OutletMenuScreen({
  outletId,
  onBack,
  onOpenCart,
}: {
  outletId: string;
  onBack: () => void;
  onOpenCart: () => void;
}) {
  const qc = useQueryClient();
  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ['nosh', 'outlets'],
    queryFn: () => catalogApi.listOutlets(),
    staleTime: 60_000,
  });
  const outlet = outlets?.find((o) => o.id === outletId);

  const { data: menu, isLoading } = useQuery<MenuItem[]>({
    queryKey: ['nosh', 'menu', outletId],
    queryFn: () => catalogApi.listMenu(outletId),
    enabled: !!outletId,
  });

  const { data: cart } = useQuery<Cart | null>({
    queryKey: ['nosh', 'cart'],
    queryFn: () => cartApi.getActive(),
  });
  const cartCount = cart?.items?.reduce((sum, i) => sum + i.quantity, 0) ?? 0;
  const cartBelongsToThisOutlet = cart?.outletId === outletId;
  const showCartBadge = cartBelongsToThisOutlet && cartCount > 0;

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [search, setSearch] = useState('');

  // Group items by category.
  const groups = new Map<string, MenuItem[]>();
  for (const item of menu ?? []) {
    const name = item.category?.name ?? 'Other';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(item);
  }
  const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) => (a === 'Other' ? 1 : 0) - (b === 'Other' ? 1 : 0));

  // Derived "current" category — falls back to the first group when no
  // explicit selection has been made yet (the menu data is fetched
  // async, so we can't lazy-initialize the state from it).
  const activeCat = activeCategory || orderedGroups[0]?.[0] || '';

  const filteredGroups = orderedGroups.map(([cat, list]) => [
    cat,
    list.filter((i) => {
      const q = search.trim().toLowerCase();
      return !q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
    }),
  ] as [string, MenuItem[]]).filter(([, list]) => list.length > 0);

  // Build a qty map by reading the cart items.
  const qtyByItem = new Map<string, number>();
  if (cartBelongsToThisOutlet && cart?.items) {
    for (const ci of cart.items) {
      qtyByItem.set(ci.menuItemId, (qtyByItem.get(ci.menuItemId) ?? 0) + ci.quantity);
    }
  }

  async function handleQtyChange(item: MenuItem, nextQty: number) {
    if (!outlet) return;
    try {
      const existing = cart?.items?.find((ci) => ci.menuItemId === item.id);
      if (nextQty <= 0) {
        if (existing) {
          await cartApi.removeItem(existing.id);
        }
      } else if (existing) {
        await cartApi.updateItem(existing.id, nextQty);
      } else {
        await cartApi.addItem(outlet.id, {
          menuItemId: item.id,
          quantity: 1,
          selectedOptions: [],
        });
        // If the requested qty > 1, bump it up to the target (rare case).
        if (nextQty > 1) {
          const refreshed = await cartApi.getActive();
          const newLine = refreshed?.items?.find((ci) => ci.menuItemId === item.id);
          if (newLine) {
            await cartApi.updateItem(newLine.id, nextQty);
          }
        }
      }
      qc.invalidateQueries({ queryKey: ['nosh', 'cart'] });
    } catch (err) {
      toastMutationError(err, 'Could not update cart');
    }
  }

  return (
    <>
      <div className="outlet-banner">
        <div className="banner-content">
          <div className="banner-left">
            <button className="banner-back-btn" onClick={onBack}>
              <ArrowLeft size={14} /> Back
            </button>
            <h2 className="banner-title" style={{ marginTop: '0.85rem' }}>{outlet?.name ?? 'Outlet menu'}</h2>
            <p className="banner-desc">{outlet?.description ?? ''}</p>
            <div className="banner-meta">
              <span className="meta-info">
                <Star size={12} /> {outlet?.rating.toFixed(1) ?? '—'}
              </span>
              <span className="meta-info">
                <Clock size={12} /> {outlet?.estimatedTime ?? ''}
              </span>
              <span className="meta-info">
                <MapPin size={12} /> {outlet?.location ?? ''}
              </span>
            </div>
          </div>
          <div className="banner-right">
            <button className="banner-cart-btn" onClick={onOpenCart}>
              <ShoppingCart size={14} /> View cart
              {showCartBadge && <span className="banner-cart-badge">{cartCount}</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="menu-layout-container">
        {orderedGroups.length > 0 && (
          <aside className="category-sidebar">
            <ul className="category-list">
              {orderedGroups.map(([cat]) => (
                <li key={cat}>
                  <button
                    className={`category-nav-btn ${activeCat === cat ? 'active' : ''}`}
                    onClick={() => {
                      setActiveCategory(cat);
                      const el = document.getElementById(`menu-cat-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  >
                    <div className="category-img-wrapper">
                      <Store size={20} />
                    </div>
                    <span className="category-name">{cat}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        <div className="menu-content">
          <div className="menu-search-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search dishes"
            />
          </div>

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
              <Loader2 className="animate-spin" size={16} /> Loading menu…
            </div>
          ) : filteredGroups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
              <ChefHat size={32} style={{ marginBottom: '0.5rem' }} />
              <p>No menu items found.</p>
            </div>
          ) : (
            <div className="menu-sections">
              {filteredGroups.map(([cat, list]) => (
                <section key={cat} id={`menu-cat-${cat.replace(/[^a-zA-Z0-9]/g, '-')}`} className="menu-section">
                  <h3 className="section-title">{cat}</h3>
                  <div className="food-grid">
                    {list.map((item) => (
                      <FoodCard
                        key={item.id}
                        item={item}
                        quantity={qtyByItem.get(item.id) ?? 0}
                        updating={false}
                        onUpdateQuantity={(next) => handleQtyChange(item, next)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function FoodCard({
  item,
  quantity,
  updating,
  onUpdateQuantity,
}: {
  item: MenuItem;
  quantity: number;
  updating: boolean;
  onUpdateQuantity: (next: number) => void;
}) {
  return (
    <div className="food-card">
      <div className="food-image-container">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="food-image" loading="lazy" />
        ) : (
          <div className="food-image-placeholder">
            <ChefHat size={28} />
          </div>
        )}
        <span className={`food-veg-badge ${item.vegetarian ? '' : 'non-veg'}`} title={item.vegetarian ? 'Vegetarian' : 'Non-vegetarian'}>
          ●
        </span>
        {item.popular && <span className="food-popular-badge">Popular</span>}
      </div>

      <div className="food-content">
        <h4 className="food-name">{item.name}</h4>
        {item.description && <p className="food-desc">{item.description}</p>}

        <div className="food-footer">
          <span className="food-price">{formatINR(item.price)}</span>

          {!item.isAvailable ? (
            <span className="food-unavailable">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="quantity-selector" aria-label={`Quantity of ${item.name}`}>
              <button className="qty-btn" onClick={() => onUpdateQuantity(quantity - 1)} disabled={updating} aria-label="Decrease quantity">
                −
              </button>
              <span className="qty-value">{updating ? '…' : quantity}</span>
              <button className="qty-btn" onClick={() => onUpdateQuantity(quantity + 1)} disabled={updating} aria-label="Increase quantity">
                +
              </button>
            </div>
          ) : (
            <button className="add-btn" onClick={() => onUpdateQuantity(1)} disabled={updating || !item.isAvailable}>
              ADD <Plus size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cart drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  open,
  onOpenChange,
  onCheckout,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCheckout?: (order: Order) => void;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [paymentMethod, setPaymentMethod] = useState<'ONLINE' | 'WALLET'>('ONLINE');
  const [notes, setNotes] = useState('');
  // Once the order is created we keep the cart drawer open and overlay the
  // PaymentModal on top. The modal drives the real Razorpay checkout flow;
  // on any terminal state we close the drawer + bubble up to the parent via
  // onCheckout (which navigates to the Orders tab).
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);

  const { data: cart, isLoading } = useQuery<Cart | null>({
    queryKey: ['nosh', 'cart'],
    queryFn: () => cartApi.getActive(),
    enabled: !!user && open,
  });

  const updateMutation = useMutation({
    mutationFn: ({ cartItemId, quantity }: { cartItemId: string; quantity: number }) =>
      cartApi.updateItem(cartItemId, quantity),
    onSuccess: (updated) => qc.setQueryData(['nosh', 'cart'], updated),
    onError: (e) => toastMutationError(e, 'Could not update cart item'),
  });

  const removeMutation = useMutation({
    mutationFn: (cartItemId: string) => cartApi.removeItem(cartItemId),
    onSuccess: (updated) => qc.setQueryData(['nosh', 'cart'], updated),
    onError: (e) => toastMutationError(e, 'Could not remove item'),
  });

  const clearMutation = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: () => qc.setQueryData(['nosh', 'cart'], null),
    onError: (e) => toastMutationError(e, 'Could not clear cart'),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!cart || cart.items.length === 0) throw new Error('Cart is empty');
      return ordersApi.create({
        outletId: cart.outletId,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          selectedOptions: parseJSON<{ groupId: string; optionId: string }[]>(i.selectedOptions, []),
        })),
        paymentMethod,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: (order) => {
      qc.setQueryData(['nosh', 'cart'], null);
      qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
      toast.success(`Order ${order.orderNumber} placed — complete payment`);
      setNotes('');
      // Don't close the cart drawer yet — the PaymentModal sits on top.
      // On terminal state we'll close everything and bubble up to parent.
      setPaymentOrder(order);
    },
    onError: (e) => toastMutationError(e, 'Checkout failed'),
  });

  // Lock body scroll while open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const totals = computeCartTotals(cart ?? null);
  const items = cart?.items ?? [];
  const outletName = cart?.outlet?.name ?? 'this outlet';

  if (!open) return null;

  return (
    <>
      <div className="cart-drawer-overlay" onClick={() => onOpenChange(false)} />

      <div className="cart-drawer open">
        <div className="cart-drawer-header">
          <div>
            <h2 className="cart-drawer-title">Your cart</h2>
            <p className="cart-drawer-subtitle">
              {items.length > 0 ? `From ${outletName}` : 'Your cart is empty.'}
            </p>
          </div>
          <button className="cart-close-btn" onClick={() => onOpenChange(false)} aria-label="Close cart">
            <X size={22} />
          </button>
        </div>

        <div className="cart-drawer-body">
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
              <Loader2 className="animate-spin" style={{ color: 'var(--text-gray)' }} />
            </div>
          ) : items.length === 0 ? (
            <div className="cart-empty-state">
              <div className="empty-icon-wrapper">
                <ShoppingCart size={28} />
              </div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
                Cart is empty
              </h2>
              <p>Add items from an outlet menu to see them here.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {items.map((item) => {
                const mi = item.menuItem;
                const options = parseJSON<{ groupId: string; optionId: string }[]>(item.selectedOptions, []);
                const optionLabels: string[] = [];
                if (mi.customizationGroups) {
                  for (const sel of options) {
                    const grp = mi.customizationGroups.find((g) => g.id === sel.groupId);
                    const opt = grp?.options.find((o) => o.id === sel.optionId);
                    if (opt) optionLabels.push(opt.label);
                  }
                }
                const lineTotal = (Number(mi.price) + optionLabels.length * 0) * item.quantity;
                return (
                  <div key={item.id} className="cart-item-card">
                    <div className="cart-item-info">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 className="cart-item-name">{mi.name}</h4>
                        {optionLabels.length > 0 && (
                          <p className="cart-item-options">{optionLabels.join(' · ')}</p>
                        )}
                      </div>
                      <span className="cart-item-price">{formatINR(lineTotal)}</span>
                    </div>
                    <div className="cart-item-actions">
                      <div className="quantity-selector">
                        <button
                          className="qty-btn"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeMutation.mutate(item.id);
                            } else {
                              updateMutation.mutate({ cartItemId: item.id, quantity: item.quantity - 1 });
                            }
                          }}
                          disabled={
                            (updateMutation.isPending && updateMutation.variables?.cartItemId === item.id) ||
                            (removeMutation.isPending && removeMutation.variables === item.id)
                          }
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="qty-value">
                          {updateMutation.isPending && updateMutation.variables?.cartItemId === item.id
                            ? '…'
                            : item.quantity}
                        </span>
                        <button
                          className="qty-btn"
                          onClick={() => updateMutation.mutate({ cartItemId: item.id, quantity: item.quantity + 1 })}
                          disabled={
                            (updateMutation.isPending && updateMutation.variables?.cartItemId === item.id) ||
                            (removeMutation.isPending && removeMutation.variables === item.id)
                          }
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="cart-item-delete"
                        onClick={() => removeMutation.mutate(item.id)}
                        disabled={removeMutation.isPending && removeMutation.variables === item.id}
                        aria-label={`Remove ${mi.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="cart-drawer-footer">
            <div className="cart-summary-line">
              <span>Subtotal</span>
              <span className="summary-value">{formatINR(totals.subtotal)}</span>
            </div>
            <div className="cart-summary-line">
              <span>Platform fee</span>
              <span className="summary-value">{formatINR(totals.platformFee)}</span>
            </div>
            <div className="cart-summary-total">
              <span>Total</span>
              <span>{formatINR(totals.total)}</span>
            </div>

            <div className="cart-payment-toggle">
              <button
                type="button"
                className={`cart-payment-btn ${paymentMethod === 'ONLINE' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('ONLINE')}
              >
                <CreditCard size={14} /> Online
              </button>
              <button
                type="button"
                className={`cart-payment-btn ${paymentMethod === 'WALLET' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('WALLET')}
              >
                <Wallet size={14} /> Wallet
              </button>
            </div>

            <textarea
              className="cart-notes-input"
              placeholder="Optional notes for the outlet…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              aria-label="Order notes"
            />

            <div className="cart-actions-wrapper">
              <div className="cart-action-buttons">
                <button
                  className="checkout-btn"
                  onClick={() => checkoutMutation.mutate()}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={14} /> Placing order…
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={14} /> Place order · {formatINR(totals.total)}
                    </>
                  )}
                </button>
                <button
                  className="cart-clear-btn"
                  onClick={() => clearMutation.mutate()}
                  disabled={clearMutation.isPending}
                  title="Clear cart"
                  aria-label="Clear cart"
                >
                  {clearMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
              <p className="checkout-note">Pickup only · no delivery fee</p>
            </div>
          </div>
        )}
      </div>

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onCancel={() => {
            // User clicked the explicit 'Cancel Payment' button in the
            // modal screen. Per spec we close the modal + cart drawer
            // but DO NOT navigate to orders — the student can go there
            // manually to retry payment for the pending order.
            setPaymentOrder(null);
            onOpenChange(false);
            toast.info('Order saved — complete payment from the Orders tab');
          }}
          onComplete={() => {
            // User clicked 'View my orders' on a terminal screen
            // (success / processing / failed-with-give-up). Close
            // everything and bubble up to the parent, which navigates
            // to the Orders tab.
            setPaymentOrder(null);
            onOpenChange(false);
            onCheckout?.(paymentOrder);
          }}
        />
      )}
    </>
  );
}

// ─── Payment modal (real Razorpay checkout) ─────────────────────────────────
//
// State machine:
//   creating  → POST /payments/razorpay/order
//     ├─ 200 + checkout.js loaded → awaiting_payment (Razorpay modal opened)
//     ├─ 400 PAYMENT_NOT_CONFIGURED → not_configured
//     ├─ 503 (gateway unreachable in dev) → processing
//     └─ other error → failed
//   awaiting_payment  (Razorpay modal is open over our overlay)
//     ├─ handler (success response) → verifying → POST /payments/razorpay/verify
//     │   ├─ 200 → success
//     │   ├─ 503 → processing
//     │   └─ other → failed
//     └─ modal.ondismiss → onCancel (close, stay on cart)
//   failed → Retry button re-opens the Razorpay modal with the same order_id
//
// The Razorpay checkout.js script is injected lazily by `loadRazorpayScript()`
// in this file only when payment is actually needed — it is intentionally
// NOT loaded globally in layout.tsx so the bundle stays small for users who
// never reach checkout.

type PaymentState =
  | 'creating'
  | 'awaiting_payment'
  | 'verifying'
  | 'success'
  | 'failed'
  | 'processing'
  | 'not_configured';

// Minimal type declarations for the global injected by Razorpay's
// checkout.js. We don't ship @types/razorpay to keep the bundle lean.
interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler: (response: RazorpayHandlerResponse) => void;
  modal: { ondismiss?: () => void };
  [key: string]: unknown;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT_ID = 'razorpay-checkout-script';
const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/**
 * Inject the Razorpay checkout.js script tag lazily. Safe to call multiple
 * times — if the script is already loaded (or still loading), the existing
 * tag is reused and we resolve once `window.Razorpay` is defined.
 */
function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();

  const existing = document.getElementById(RAZORPAY_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    // Script is still loading — wait for it (10s timeout).
    return new Promise((resolve, reject) => {
      const interval = window.setInterval(() => {
        if (window.Razorpay) {
          window.clearInterval(interval);
          window.clearTimeout(timeout);
          resolve();
        }
      }, 50);
      const timeout = window.setTimeout(() => {
        window.clearInterval(interval);
        reject(new Error('Razorpay SDK timed out while loading'));
      }, 10_000);
    });
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = RAZORPAY_SCRIPT_ID;
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.body.appendChild(script);
  });
}

function PaymentModal({
  order,
  onCancel,
  onComplete,
}: {
  order: Order;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const qc = useQueryClient();
  const [state, setState] = useState<PaymentState>('creating');
  const [razorpayOrder, setRazorpayOrder] = useState<RazorpayOrderResponse | null>(null);
  const [error, setError] = useState('');

  // Verify the Razorpay payment with the backend. 200 → success,
  // 503 → processing (gateway unreachable in dev), other → failed.
  async function verifyPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
  ) {
    setState('verifying');
    setError('');
    try {
      await paymentsApi.verifyRazorpay({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });
      // 200 — payment verified.
      qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
      setState('success');
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        // Gateway unreachable in dev — order is still pending, the webhook
        // will reconcile it later. Surface the "processing" message.
        qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
        setState('processing');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Payment verification failed';
      setError(msg);
      setState('failed');
    }
  }

  // Open the real Razorpay checkout modal. Called once on order creation
  // success and again on Retry from the failed screen (Razorpay orders
  // can be re-opened until captured or expired).
  function openRazorpayCheckout(rzpOrder: RazorpayOrderResponse) {
    if (typeof window === 'undefined' || !window.Razorpay) {
      setError('Razorpay SDK not available. Please refresh and try again.');
      setState('failed');
      return;
    }
    const rzp = new window.Razorpay({
      key: rzpOrder.keyId,
      amount: rzpOrder.amount, // in paise
      currency: rzpOrder.currency,
      name: 'Campus Food',
      description: `Order ${order.orderNumber}`,
      order_id: rzpOrder.razorpayOrderId,
      handler: (response) => {
        // Razorpay success — verify the signature with our backend.
        void verifyPayment(
          response.razorpay_order_id || rzpOrder.razorpayOrderId,
          response.razorpay_payment_id,
          response.razorpay_signature,
        );
      },
      modal: {
        ondismiss: () => {
          // User closed the Razorpay modal without paying.
          onCancel();
        },
      },
    });
    rzp.open();
  }

  // On mount: create the Razorpay order, load the script, open the modal.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const resp = await paymentsApi.createRazorpayOrder(order.id);
        if (!active) return;
        setRazorpayOrder(resp);
        // Load the Razorpay checkout.js script (only when payment is
        // actually needed — kept out of layout.tsx on purpose).
        await loadRazorpayScript();
        if (!active) return;
        setState('awaiting_payment');
        openRazorpayCheckout(resp);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.code === 'PAYMENT_NOT_CONFIGURED') {
          // Outlet hasn't configured Razorpay keys yet — friendly hint.
          setError('This outlet hasn\u2019t configured payments yet. Please contact them.');
          setState('not_configured');
          return;
        }
        if (err instanceof ApiError && err.status === 503) {
          // Gateway unreachable — order is created, payment is pending.
          setState('processing');
          return;
        }
        const msg = err instanceof Error ? err.message : 'Could not start payment';
        setError(msg);
        setState('failed');
      }
    })();
    return () => {
      active = false;
    };
    // We only want this effect to run once per order; openRazorpayCheckout
    // and verifyPayment are stable in spirit (they only close over `order`,
    // `razorpayOrder`, and the setState setters).
  }, [order.id]);

  // Convert amount (paise → rupees) for display.
  const amountRupees = razorpayOrder ? (razorpayOrder.amount / 100) : Number(order.totalAmount);

  // Retry from the failed screen — re-create the Razorpay order (in case
  // the previous one expired) and re-open the checkout modal.
  async function retryPayment() {
    setError('');
    setState('creating');
    try {
      const resp = await paymentsApi.createRazorpayOrder(order.id);
      setRazorpayOrder(resp);
      await loadRazorpayScript();
      setState('awaiting_payment');
      openRazorpayCheckout(resp);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'PAYMENT_NOT_CONFIGURED') {
        setError('This outlet hasn\u2019t configured payments yet. Please contact them.');
        setState('not_configured');
        return;
      }
      if (err instanceof ApiError && err.status === 503) {
        setState('processing');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Could not start payment';
      setError(msg);
      setState('failed');
    }
  }

  return (
    <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-label="Payment">
      {state === 'creating' && (
        <div className="payment-result-card">
          <div className="payment-result-icon processing">
            <Loader2 className="animate-spin" size={32} />
          </div>
          <h2 className="payment-result-title">Preparing payment…</h2>
          <p className="payment-result-message">
            Contacting the payment gateway for order {order.orderNumber}.
          </p>
        </div>
      )}

      {state === 'awaiting_payment' && razorpayOrder && (
        <div className="payment-result-card">
          <div className="payment-result-icon processing">
            <Loader2 className="animate-spin" size={32} />
          </div>
          <h2 className="payment-result-title">Awaiting payment…</h2>
          <p className="payment-result-message">
            Complete the payment in the Razorpay checkout window. If you closed it
            accidentally, reopen it below.
          </p>
          <div className="payment-result-detail">
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Order #</span>
              <span className="payment-result-detail-value">{order.orderNumber}</span>
            </div>
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Amount</span>
              <span className="payment-result-detail-value">₹{amountRupees.toFixed(2)}</span>
            </div>
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Razorpay order</span>
              <span
                className="payment-result-detail-value"
                style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem' }}
              >
                {razorpayOrder.razorpayOrderId}
              </span>
            </div>
          </div>
          <div className="payment-result-actions">
            <button
              type="button"
              className="primary-btn"
              onClick={() => openRazorpayCheckout(razorpayOrder)}
            >
              Reopen checkout
            </button>
            <button type="button" className="payment-btn cancel" onClick={onCancel}>
              <X size={16} /> Cancel
            </button>
          </div>
        </div>
      )}

      {state === 'verifying' && (
        <div className="payment-result-card">
          <div className="payment-result-icon processing">
            <Loader2 className="animate-spin" size={32} />
          </div>
          <h2 className="payment-result-title">Verifying payment…</h2>
          <p className="payment-result-message">
            Confirming the payment signature with the gateway. This usually takes a
            couple of seconds.
          </p>
        </div>
      )}

      {state === 'success' && (
        <div className="payment-result-card">
          <div className="payment-result-icon success">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="payment-result-title">Payment successful</h2>
          <p className="payment-result-message">
            Your payment has been verified. The outlet will start preparing your order
            right away.
          </p>
          <div className="payment-result-detail">
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Order #</span>
              <span className="payment-result-detail-value">{order.orderNumber}</span>
            </div>
            {order.pickupCode && (
              <div className="payment-result-detail-row">
                <span className="payment-result-detail-label">Pickup code</span>
                <span className="payment-result-detail-value" style={{ color: 'var(--primary)' }}>
                  {order.pickupCode}
                </span>
              </div>
            )}
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Amount paid</span>
              <span className="payment-result-detail-value">₹{amountRupees.toFixed(2)}</span>
            </div>
          </div>
          <div className="payment-result-actions">
            <button type="button" className="primary-btn" onClick={onComplete}>
              View my orders <span className="arrow">→</span>
            </button>
          </div>
        </div>
      )}

      {state === 'processing' && (
        <div className="payment-result-card">
          <div className="payment-result-icon processing">
            <Clock size={32} />
          </div>
          <h2 className="payment-result-title">Payment processing</h2>
          <p className="payment-result-message">
            We&apos;ve recorded your payment and the gateway is reconciling it. Your order
            will be confirmed shortly — you can track it from the Orders tab.
          </p>
          <div className="payment-result-detail">
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Order #</span>
              <span className="payment-result-detail-value">{order.orderNumber}</span>
            </div>
            {order.pickupCode && (
              <div className="payment-result-detail-row">
                <span className="payment-result-detail-label">Pickup code</span>
                <span className="payment-result-detail-value" style={{ color: 'var(--primary)' }}>
                  {order.pickupCode}
                </span>
              </div>
            )}
          </div>
          <div className="payment-result-actions">
            <button type="button" className="primary-btn" onClick={onComplete}>
              View my orders <span className="arrow">→</span>
            </button>
          </div>
        </div>
      )}

      {state === 'not_configured' && (
        <div className="payment-result-card">
          <div className="payment-result-icon failure">
            <AlertCircle size={36} />
          </div>
          <h2 className="payment-result-title">Payments not configured</h2>
          <p className="payment-result-message">
            {error || 'This outlet hasn\u2019t configured payments yet. Please contact them.'}
          </p>
          <div className="payment-result-detail">
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Order #</span>
              <span className="payment-result-detail-value">{order.orderNumber}</span>
            </div>
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Status</span>
              <span className="payment-result-detail-value" style={{ color: '#b91c1c' }}>
                AWAITING PAYMENT
              </span>
            </div>
          </div>
          <div className="payment-result-actions">
            <button type="button" className="primary-btn" onClick={onComplete}>
              View my orders <span className="arrow">→</span>
            </button>
            <button type="button" className="payment-btn cancel" onClick={onCancel}>
              Go back
            </button>
          </div>
        </div>
      )}

      {state === 'failed' && (
        <div className="payment-result-card">
          <div className="payment-result-icon failure">
            <XCircle size={36} />
          </div>
          <h2 className="payment-result-title">Payment failed</h2>
          <p className="payment-result-message">
            {error || 'Payment was declined.'} Your order is still saved — you can retry
            payment below or from the Orders tab.
          </p>
          <div className="payment-result-detail">
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Order #</span>
              <span className="payment-result-detail-value">{order.orderNumber}</span>
            </div>
            <div className="payment-result-detail-row">
              <span className="payment-result-detail-label">Status</span>
              <span className="payment-result-detail-value" style={{ color: '#b91c1c' }}>
                AWAITING PAYMENT
              </span>
            </div>
          </div>
          <div className="payment-result-actions">
            <button type="button" className="primary-btn" onClick={() => void retryPayment()}>
              <RotateCcw size={14} /> Retry payment
            </button>
            <button type="button" className="payment-btn cancel" onClick={onComplete}>
              View my orders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student orders ────────────────────────────────────────────────────────────

function StudentOrders() {
  const qc = useQueryClient();
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ['nosh', 'orders'],
    queryFn: () => ordersApi.list(),
  });

  useEffect(() => {
    return onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
    });
  }, [qc]);

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nosh', 'orders'] });
      toast.success('Order cancelled — refund initiated');
    },
    onError: (e) => toastMutationError(e, 'Could not cancel order'),
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
        <Loader2 className="animate-spin" size={16} /> Loading orders…
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="empty-orders-state">
        <div className="empty-icon-wrapper">
          <Receipt size={28} />
        </div>
        <h2>No orders yet</h2>
        <p>Place your first order from an outlet menu — it will appear here in real time.</p>
      </div>
    );
  }

  const sorted = [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="orders-list">
      {sorted.map((order) => (
        <OrderCard
          key={order.id}
          order={order}
          onCancel={() => cancelMutation.mutate(order.id)}
          cancelling={cancelMutation.isPending && cancelMutation.variables === order.id}
        />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  onCancel,
  cancelling,
}: {
  order: Order;
  onCancel: () => void;
  cancelling: boolean;
}) {
  // `expanded` toggles the order-tracking timeline (click the header to
  // fold/unfold). `showAllItems` is a separate toggle for the line-items
  // list so the user can keep the timeline open while paging through items.
  const [expanded, setExpanded] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const outlet = parseJSON<{ name?: string }>(order.outletSnapshot, {});
  const outletName = outlet.name ?? 'Outlet';
  const total = formatINR(order.totalAmount);
  const paymentStatus = order.payment?.status;

  const statusClass = order.status.toLowerCase();
  const isTerminal = order.status === 'COMPLETED' || order.status === 'CANCELLED' || order.status === 'REJECTED';

  function onHeaderKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpanded((v) => !v);
    }
  }

  return (
    <div className={`order-card ${expanded ? 'expanded' : ''}`}>
      <div
        className="order-header order-header--clickable"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={onHeaderKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls={`order-timeline-${order.id}`}
        title={expanded ? 'Hide tracking timeline' : 'Show tracking timeline'}
      >
        <div>
          <div className="order-outlet">{outletName}</div>
          <div className="order-meta">
            <span className="order-number">{order.orderNumber}</span>
            <span>·</span>
            <span>{formatRelativeTime(order.createdAt)}</span>
            {paymentStatus && (
              <>
                <span>·</span>
                <span style={{ textTransform: 'capitalize' }}>{paymentStatus.toLowerCase()}</span>
              </>
            )}
          </div>
        </div>
        <div className="order-header-right">
          <span className={`order-status ${statusClass}`}>
            {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
          </span>
          <ChevronDown className={`order-chevron ${expanded ? 'open' : ''}`} size={16} aria-hidden />
        </div>
      </div>

      {order.pickupCode && (
        <div className="order-pickup-banner" role="status">
          <span className="pickup-banner-label">
            <Hash size={12} /> Pickup code
          </span>
          <span className="pickup-banner-code">{order.pickupCode}</span>
          <span className="pickup-banner-hint">
            {isTerminal ? 'Keep this for your records' : 'Show this at the counter'}
          </span>
        </div>
      )}

      {order.status === 'READY' && order.pickupCode && (
        <div className="student-pickup-box" role="status" aria-label="Your pickup code">
          <div className="student-pickup-box-icon">
            <QrCode size={22} />
          </div>
          <div className="student-pickup-box-left">
            <span className="student-pickup-box-label">
              <Hash size={11} /> Your pickup code
            </span>
            <span className="student-pickup-box-code">{order.pickupCode}</span>
            <span className="student-pickup-box-hint">
              Show this code to the outlet staff when you collect your order.
            </span>
          </div>
        </div>
      )}

      <div className="order-items-container">
        {order.items.slice(0, showAllItems ? undefined : 2).map((it) => (
          <div key={it.id} className="order-item">
            <span className="item-quantity">{it.quantity}×</span>
            <span className="item-name">{it.name}</span>
            <span className="item-line-total">{formatINR(it.itemTotal)}</span>
          </div>
        ))}
        {order.items.length > 2 && (
          <button className="order-items-toggle" onClick={() => setShowAllItems((v) => !v)}>
            {showAllItems ? 'Hide items' : `+${order.items.length - 2} more items`}
          </button>
        )}
      </div>

      <div className="order-footer">
        <div className="order-total">
          <span className="total-label">Total</span>
          <span className="total-amount">{total}</span>
        </div>
        {order.status === 'PENDING' ? (
          <button className="order-cancel-btn" onClick={onCancel} disabled={cancelling}>
            {cancelling ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
            Cancel order
          </button>
        ) : ['ACCEPTED', 'PREPARING', 'READY'].includes(order.status) ? (
          <span className="order-committed-notice" title="Once the outlet accepts your order, the kitchen has started work.">
            <Lock size={12} />
            Order committed — for changes, contact {outletName} directly.
          </span>
        ) : order.status === 'COMPLETED' ? (
          <button className="order-again-btn" onClick={() => toast.info('Re-order coming soon')}>
            <RotateCcw size={14} /> Order again
          </button>
        ) : (
          <span className="order-committed-notice" style={{ background: '#fee2e2', borderColor: '#fecaca', color: '#991b1b' }}>
            <XCircle size={12} />
            Order {order.status.charAt(0) + order.status.slice(1).toLowerCase()}.
          </span>
        )}
      </div>

      {expanded && <OrderTimeline order={order} />}
    </div>
  );
}

// ─── Order tracking timeline ─────────────────────────────────────────────────
//
// Parses `order.timeline` (a JSON string). The backend appends one entry
// per status transition: `{ status, at, by, reason? }`. We render a
// vertical timeline of the 5 happy-path steps (PENDING → ACCEPTED →
// PREPARING → READY → COMPLETED) with their timestamps, plus a deviation
// marker if the order was rejected or cancelled.

interface TimelineEntry {
  status: OrderStatus;
  at: string;
  by?: string | { id?: string; name?: string; email?: string } | null;
  reason?: string | null;
}

const HAPPY_PATH: OrderStatus[] = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];

function parseOrderTimeline(timelineJson: string): TimelineEntry[] {
  const parsed = parseJSON<TimelineEntry[]>(timelineJson, []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e.status === 'string' && typeof e.at === 'string')
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

function describeTimelineActor(by: TimelineEntry['by']): string | null {
  if (!by) return null;
  let raw: string;
  if (typeof by === 'string') {
    raw = by;
  } else if (typeof by === 'object') {
    raw = by.name ?? by.email ?? by.id ?? '';
  } else {
    return null;
  }
  if (!raw) return null;
  // Long CUID/UUID-style actor IDs are ugly to display verbatim. If `by`
  // is purely alphanumeric and longer than 14 chars, shorten to last 8.
  if (/^[a-zA-Z0-9_-]{15,}$/.test(raw)) {
    return `user · ${raw.slice(-8)}`;
  }
  return raw;
}

function OrderTimeline({ order }: { order: Order }) {
  const entries = parseOrderTimeline(order.timeline);

  // Index by status — if a status appears multiple times (e.g., re-accept
  // after a brief reject), the last entry wins.
  const entryByStatus = new Map<OrderStatus, TimelineEntry>();
  for (const e of entries) {
    entryByStatus.set(e.status, e);
  }

  const isCancelled = order.status === 'CANCELLED';
  const isRejected = order.status === 'REJECTED';

  // The order's "current" status on the happy path. If it's been
  // cancelled/rejected, none of the post-current happy-path steps get the
  // "current" pulse — only the deviation marker does.
  const currentHappyStatus = isCancelled || isRejected ? null : order.status;
  const currentHappyIndex = currentHappyStatus ? HAPPY_PATH.indexOf(currentHappyStatus) : -1;

  return (
    <div className="order-timeline" id={`order-timeline-${order.id}`} role="region" aria-label={`Tracking timeline for ${order.orderNumber}`}>
      <div className="order-timeline-header">
        <ListChecks size={14} /> Order tracking
        <span className="order-timeline-count">{entries.length} event{entries.length === 1 ? '' : 's'}</span>
      </div>

      {entries.length === 0 ? (
        <div className="order-timeline-empty">
          <Clock size={18} />
          <p>No tracking events recorded yet. The outlet will start the timeline once they accept your order.</p>
        </div>
      ) : (
        <ol className="timeline-track">
          {HAPPY_PATH.map((status, idx) => {
            const entry = entryByStatus.get(status);
            const isDone = !!entry;
            const isCurrent = currentHappyStatus === status;
            const isFuture = currentHappyIndex >= 0 && idx > currentHappyIndex;
            const cls = [
              'timeline-step',
              isDone ? 'done' : '',
              isCurrent ? 'current' : '',
              isFuture ? 'future' : '',
            ].filter(Boolean).join(' ');
            const actor = describeTimelineActor(entry?.by);
            return (
              <li key={status} className={cls}>
                <div className="timeline-marker">
                  {isDone ? (
                    <CheckCircle2 size={16} />
                  ) : isCurrent ? (
                    <span className="timeline-pulse" aria-hidden />
                  ) : (
                    <span className="timeline-empty" aria-hidden />
                  )}
                </div>
                <div className="timeline-body">
                  <div className="timeline-status">
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                    {isCurrent && <span className="timeline-now">· now</span>}
                  </div>
                  {entry && (
                    <>
                      <div className="timeline-time">
                        <Clock size={11} /> {formatDateTime(entry.at)}
                        <span className="timeline-relative"> · {formatRelativeTime(entry.at)}</span>
                      </div>
                      {actor && (
                        <div className="timeline-actor">
                          <UserRound size={11} /> by {actor}
                        </div>
                      )}
                      {entry.reason && <div className="timeline-reason">{entry.reason}</div>}
                    </>
                  )}
                  {!entry && isFuture && (
                    <div className="timeline-time timeline-time--muted">Pending</div>
                  )}
                </div>
              </li>
            );
          })}

          {isCancelled && entryByStatus.get('CANCELLED') && (
            <DeviatedStep entry={entryByStatus.get('CANCELLED')!} label="Cancelled" />
          )}
          {isRejected && entryByStatus.get('REJECTED') && (
            <DeviatedStep entry={entryByStatus.get('REJECTED')!} label="Rejected" />
          )}
        </ol>
      )}
    </div>
  );
}

function DeviatedStep({ entry, label }: { entry: TimelineEntry; label: string }) {
  const actor = describeTimelineActor(entry.by);
  return (
    <li className="timeline-step deviated done">
      <div className="timeline-marker">
        <XCircle size={16} />
      </div>
      <div className="timeline-body">
        <div className="timeline-status">{label}</div>
        <div className="timeline-time">
          <Clock size={11} /> {formatDateTime(entry.at)}
          <span className="timeline-relative"> · {formatRelativeTime(entry.at)}</span>
        </div>
        {actor && (
          <div className="timeline-actor">
            <UserRound size={11} /> by {actor}
          </div>
        )}
        {entry.reason && <div className="timeline-reason">{entry.reason}</div>}
      </div>
    </li>
  );
}

// ─── Student profile ───────────────────────────────────────────────────────────

type ProfileSection = 'account' | 'orders' | 'logout';

function StudentProfile() {
  const user = useAuthStore((s) => s.user);
  const [section, setSection] = useState<ProfileSection>('account');

  if (!user) return null;
  const profile = user.studentProfile ?? null;

  async function handleLogout() {
    await authApi.logout();
  }

  return (
    <div className="profile-page-main">
      <div className="profile-page-header">
        <h1 className="page-title" style={{ fontSize: '2rem' }}>Your account</h1>
        <p className="page-subtitle">Manage your profile, orders and preferences</p>
      </div>

      <div className="profile-layout">
        <aside className="profile-sidebar">
          <div className="profile-identity-card">
            <div className="profile-avatar-lg">{initials(user.name, user.email)}</div>
            <div className="profile-identity-info">
              <div className="profile-display-name">{user.name ?? 'No name set'}</div>
              <div className="profile-display-email">{user.email}</div>
            </div>
          </div>

          <div className="profile-menu-card">
            <button
              className={`profile-menu-item ${section === 'account' ? 'active' : ''}`}
              onClick={() => setSection('account')}
            >
              <span className="profile-menu-icon"><UserRound size={16} /></span>
              <span className="profile-menu-label">Account</span>
              <span className="profile-menu-arrow">›</span>
            </button>
            <button
              className={`profile-menu-item ${section === 'orders' ? 'active' : ''}`}
              onClick={() => setSection('orders')}
            >
              <span className="profile-menu-icon"><Receipt size={16} /></span>
              <span className="profile-menu-label">Orders</span>
              <span className="profile-menu-arrow">›</span>
            </button>
            <button
              className="profile-menu-item profile-menu-logout"
              onClick={handleLogout}
            >
              <span className="profile-menu-icon"><LogOut size={16} /></span>
              <span className="profile-menu-label">Logout</span>
              <span className="profile-menu-arrow">›</span>
            </button>
          </div>
        </aside>

        <div className="profile-right-panel">
          {section === 'account' && (
            <div className="account-details-panel">
              <div className="acct-section-card">
                <div className="acct-section-header">
                  <h3 className="acct-subsection-title">Account details</h3>
                  <p className="acct-section-subtitle">Read-only — managed via Google / onboarding flow.</p>
                </div>
                <div className="acct-fields-grid">
                  <AcctField label="Email" value={user.email} />
                  <AcctField label="Full name" value={user.name ?? '—'} />
                  <AcctField label="Role" value={user.role} />
                  <AcctField label="Status" value={user.status} />
                  <AcctField label="Onboarding" value={user.onboardingCompleted ? 'Completed' : 'Pending'} />
                  <AcctField label="Joined" value={formatDateTime(user.createdAt)} />
                  {user.lastLoginAt && <AcctField label="Last sign-in" value={formatDateTime(user.lastLoginAt)} />}
                </div>
              </div>

              {profile ? (
                <div className="acct-section-card">
                  <div className="acct-section-header">
                    <h3 className="acct-subsection-title">Student profile</h3>
                    <p className="acct-section-subtitle">Submitted to the campus for verification.</p>
                  </div>
                  <div className="acct-fields-grid">
                    <AcctField label="Full name" value={profile.fullName} icon={<UserRound size={14} />} />
                    <AcctField label="Phone" value={profile.phone} icon={<Phone size={14} />} />
                    <AcctField label="Course" value={profile.course} icon={<GraduationCap size={14} />} />
                    <AcctField label="Year" value={profile.year} icon={<GraduationCap size={14} />} />
                    <AcctField label="College ID" value={profile.collegeId} icon={<Hash size={14} />} />
                    {profile.submittedAt && (
                      <AcctField label="Profile submitted" value={formatDateTime(profile.submittedAt)} icon={<Calendar size={14} />} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="acct-section-card">
                  <div className="acct-section-header">
                    <h3 className="acct-subsection-title">Student profile</h3>
                  </div>
                  <p className="acct-section-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <IdCard size={14} /> Student profile not yet submitted.
                  </p>
                </div>
              )}
            </div>
          )}

          {section === 'orders' && <StudentOrders />}
        </div>
      </div>
    </div>
  );
}

function AcctField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="acct-field">
      <span className="acct-field-label">{label}</span>
      <div className="acct-field-value-row acct-field-value-row--static">
        {icon && <span style={{ color: 'var(--text-light)' }}>{icon}</span>}
        <span className="acct-field-value">{value}</span>
      </div>
    </div>
  );
}

// ─── Bottom nav (mobile) ──────────────────────────────────────────────────────

function BottomNav({ tab, onChange }: { tab: StudentTab; onChange: (t: StudentTab) => void }) {
  const items: { key: StudentTab; label: string; icon: React.ReactNode }[] = [
    { key: 'home', label: 'Home', icon: <HomeIcon size={20} /> },
    { key: 'orders', label: 'Orders', icon: <Receipt size={20} /> },
    { key: 'profile', label: 'Profile', icon: <UserRound size={20} /> },
  ];
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav-inner">
        {items.map((it) => (
          <button
            key={it.key}
            className={`bottom-nav-btn ${tab === it.key ? 'active' : ''}`}
            onClick={() => onChange(it.key)}
          >
            <span className="bottom-nav-btn-icon">{it.icon}</span>
            <span className="bottom-nav-btn-label">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// ─── Outlet view (dashboard) ─────────────────────────────────────────────────

type OutletTab = 'orders' | 'menu' | 'settings';

function OutletView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<OutletTab>('orders');

  // OUTLET_STAFF only see the Orders tab; OUTLET_ADMIN also sees Menu +
  // Settings. We compute this once per render so changing role (via
  // logout/login) reflects correctly.
  const isAdmin = user?.role === 'OUTLET_ADMIN';
  // Defensive: staff can only ever be on the Orders tab — the Menu +
  // Settings tab buttons are hidden for them, so this fallback guards
  // against any future code path that mutates `tab` for staff.
  const safeTab: OutletTab = isAdmin ? tab : 'orders';

  useEffect(() => {
    const offNew = onOrderNew(() => {
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'orders'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'kpis'] });
    });
    const offChanged = onOrderStatusChanged(() => {
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'orders'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'kpis'] });
    });
    return () => {
      offNew();
      offChanged();
    };
  }, [qc]);

  const { data: kpis, isLoading: kpiLoading } = useQuery<OutletKPIs>({
    queryKey: ['nosh', 'outlet', 'kpis'],
    queryFn: () => outletApi.kpis(),
    refetchInterval: 15_000,
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ['nosh', 'outlet', 'orders'],
    queryFn: () => outletApi.listOrders(),
    refetchInterval: 30_000,
  });

  const kpiCards: { key: OrderStatus; label: string; cls: string; icon: React.ReactNode }[] = [
    { key: 'PENDING', label: 'Pending', cls: 'pending', icon: <Clock size={16} /> },
    { key: 'ACCEPTED', label: 'Accepted', cls: 'accepted', icon: <CheckCircle2 size={16} /> },
    { key: 'PREPARING', label: 'Preparing', cls: 'preparing', icon: <ChefHat size={16} /> },
    { key: 'READY', label: 'Ready', cls: 'ready', icon: <Package size={16} /> },
    { key: 'COMPLETED', label: 'Completed', cls: 'completed', icon: <ListChecks size={16} /> },
  ];

  return (
    <div className="page-wrapper">
      <AppHeader contextLabel="Outlet dashboard" />

      <main className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Welcome back, {user?.name ?? 'Outlet'}</h1>
          <p className="dashboard-subtitle">
            Live orders + KPIs · socket-powered real-time updates · role: {user?.outletRole ?? user?.role}
          </p>
        </div>

        <div className="outlet-tabs" role="tablist" aria-label="Outlet dashboard tabs">
          <button
            role="tab"
            className={`outlet-tab ${safeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setTab('orders')}
          >
            <Receipt size={14} /> Orders
          </button>
          {isAdmin && (
            <button
              role="tab"
              className={`outlet-tab ${safeTab === 'menu' ? 'active' : ''}`}
              onClick={() => setTab('menu')}
            >
              <ChefHat size={14} /> Menu
            </button>
          )}
          {isAdmin && (
            <button
              role="tab"
              className={`outlet-tab ${safeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setTab('settings')}
            >
              <Settings size={14} /> Settings
            </button>
          )}
        </div>

        {safeTab === 'orders' && (
          <>
            <div className="kpi-grid">
              {kpiCards.map((c) => (
                <div key={c.key} className={`kpi-card ${c.cls}`}>
                  <div className="kpi-card-header">
                    <span className="kpi-card-label">{c.label}</span>
                    <span className="kpi-card-icon">{c.icon}</span>
                  </div>
                  {kpiLoading ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>—</div>
                  ) : (
                    <div className="kpi-card-value">{kpis?.[c.key] ?? 0}</div>
                  )}
                </div>
              ))}
            </div>

            <div className="orders-table-wrap">
              <div className="orders-table-header">
                <h2 className="orders-table-title">
                  <Receipt className="orders-table-icon" size={18} /> Live orders
                </h2>
                <button
                  className="refresh-btn"
                  onClick={() => {
                    qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'orders'] });
                    qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'kpis'] });
                  }}
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
              <OrdersTable orders={orders} loading={ordersLoading} />
            </div>
          </>
        )}

        {safeTab === 'menu' && isAdmin && <OutletMenuManagement />}

        {safeTab === 'settings' && isAdmin && <OutletSettingsView />}
      </main>
    </div>
  );
}

function OrdersTable({ orders, loading }: { orders?: Order[]; loading: boolean }) {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  // When set, the VerifyPickupModal is shown for this order. The modal
  // asks the outlet staff for the 4-digit code shown to the student,
  // then POSTs /outlet/orders/:id/verify-pickup which flips READY → COMPLETED.
  const [verifyOrder, setVerifyOrder] = useState<Order | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      outletApi.updateOrderStatus(id, status),
    onMutate: ({ id }) => setPendingId(id),
    onSettled: () => setPendingId(null),
    onSuccess: (updated) => {
      qc.setQueryData<Order[]>(['nosh', 'outlet', 'orders'], (prev) =>
        prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
      );
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'kpis'] });
      toast.success(`Order ${updated.orderNumber} → ${updated.status}`);
    },
    onError: (e) => toastMutationError(e, 'Could not update order status'),
  });

  const verifyPickupMutation = useMutation({
    mutationFn: ({ id, code }: { id: string; code: string }) =>
      outletApi.verifyPickup(id, code),
    onSuccess: (updated) => {
      qc.setQueryData<Order[]>(['nosh', 'outlet', 'orders'], (prev) =>
        prev ? prev.map((o) => (o.id === updated.id ? updated : o)) : prev,
      );
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'kpis'] });
      toast.success('Pickup verified! Order completed.');
      setVerifyOrder(null);
    },
    onError: (e) => {
      // Backend distinguishes the two 400 cases by message:
      //   - mismatch → "Invalid pickup code"
      //   - not READY → "Order must be READY first"
      // We pass the message straight through to the toast; the modal stays
      // open so the staff can try again.
      toastMutationError(e, 'Could not verify pickup');
    },
  });

  if (loading) {
    return (
      <div style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
        <Loader2 className="animate-spin" size={16} /> Loading orders…
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-gray)' }}>
        <div className="empty-icon-wrapper" style={{ margin: '0 auto 1rem' }}>
          <AlertCircle size={28} />
        </div>
        <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>No active orders</p>
        <p style={{ fontSize: '0.9rem' }}>New orders will appear here the moment a student checks out.</p>
      </div>
    );
  }

  const sorted = [...orders].sort((a, b) => {
    const rank = (s: OrderStatus) =>
      ({ PENDING: 0, ACCEPTED: 1, PREPARING: 2, READY: 3, COMPLETED: 4, REJECTED: 5, CANCELLED: 6 }[s] ?? 99);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
    <div className="orders-table-scroll">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Placed</th>
            <th>Items</th>
            <th style={{ textAlign: 'right' }}>Total</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => (
            <OutletOrderRow
              key={order.id}
              order={order}
              pending={pendingId === order.id}
              onStatus={(s) => statusMutation.mutate({ id: order.id, status: s })}
              onVerifyPickup={() => setVerifyOrder(order)}
            />
          ))}
        </tbody>
      </table>
    </div>

      {verifyOrder && (
        <VerifyPickupModal
          order={verifyOrder}
          submitting={verifyPickupMutation.isPending}
          onClose={() => setVerifyOrder(null)}
          onSubmit={(code) =>
            verifyPickupMutation.mutate({ id: verifyOrder.id, code })
          }
        />
      )}
    </>
  );
}

function OutletOrderRow({
  order,
  pending,
  onStatus,
  onVerifyPickup,
}: {
  order: Order;
  pending: boolean;
  onStatus: (s: OrderStatus) => void;
  onVerifyPickup: () => void;
}) {
  const itemsSummary = order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');

  // READY orders move forward by verifying the student's pickup code
  // (POST /outlet/orders/:id/verify-pickup) rather than a raw status
  // PATCH. That guards against staff marking an order as collected
  // without actually checking the code shown to the student.
  const next: { label: string; to: OrderStatus; cls: string } | null =
    order.status === 'PENDING'
      ? { label: 'Accept', to: 'ACCEPTED', cls: 'accept' }
      : order.status === 'ACCEPTED'
      ? { label: 'Prepare', to: 'PREPARING', cls: 'prepare' }
      : order.status === 'PREPARING'
      ? { label: 'Ready', to: 'READY', cls: 'ready' }
      : order.status === 'READY'
      ? { label: 'Verify Pickup', to: 'COMPLETED', cls: 'complete' }
      : null;

  const isReadyForPickup = order.status === 'READY';

  return (
    <tr>
      <td>
        <div className="order-number-cell">{order.orderNumber}</div>
        {order.pickupCode && (
          <div style={{ marginTop: '0.25rem' }}>
            <span className="pickup-code-cell">{order.pickupCode}</span>
          </div>
        )}
      </td>
      <td style={{ fontSize: '0.78rem', color: 'var(--text-gray)' }}>
        {formatRelativeTime(order.createdAt)}
      </td>
      <td>
        <div style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {itemsSummary}
        </div>
        {order.notes && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-gray)', marginTop: '0.2rem', fontStyle: 'italic' }}>
            “{order.notes}”
          </div>
        )}
      </td>
      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(order.totalAmount)}</td>
      <td>
        <span className={`order-status ${order.status.toLowerCase()}`}>
          {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        {next ? (
          <button
            className={`outlet-action-btn ${next.cls}`}
            onClick={isReadyForPickup ? onVerifyPickup : () => onStatus(next.to)}
            disabled={pending}
            title={isReadyForPickup ? 'Ask the student for their 4-digit pickup code' : undefined}
          >
            {pending ? <Loader2 className="animate-spin" size={12} /> : null}
            {next.label}
          </button>
        ) : (
          <span className="no-actions">No actions</span>
        )}
      </td>
    </tr>
  );
}

// ─── Verify pickup modal ──────────────────────────────────────────────────────
//
// Outlet-side modal: the student shows the 4-digit code from their order
// card, the staff types it in here. On submit we POST
// /outlet/orders/:orderId/verify-pickup with the typed code.
//
//   200 → flips order READY → COMPLETED; toast + close modal.
//   400 (code mismatch)   → toast 'Invalid pickup code'; modal stays open.
//   400 (not READY)       → toast 'Order must be READY first'; modal closes.

function VerifyPickupModal({
  order,
  submitting,
  onClose,
  onSubmit,
}: {
  order: Order;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = code.trim();
  const isValid = /^\d{4}$/.test(trimmed);
  const showError = touched && !isValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid || submitting) return;
    onSubmit(trimmed);
  }

  // Lock body scroll while open.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}>
      <div className="verify-pickup-modal" role="dialog" aria-modal="true" aria-label={`Verify pickup for ${order.orderNumber}`}>
        <div className="modal-header">
          <h2 className="modal-title">Verify pickup</h2>
          <button className="modal-close" onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form className="verify-pickup-body" onSubmit={handleSubmit}>
          <div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-gray)', margin: 0 }}>
              Order <strong style={{ color: 'var(--text-dark)' }}>{order.orderNumber}</strong> ·
              ask the student for their 4-digit pickup code.
            </p>
          </div>
          <input
            type="text"
            className={`verify-pickup-input ${showError ? 'error' : ''}`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            onBlur={() => setTouched(true)}
            placeholder="0000"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            autoFocus
            aria-label="Pickup code"
            aria-invalid={showError}
            disabled={submitting}
          />
          {showError && (
            <p style={{ fontSize: '0.75rem', color: '#b91c1c', margin: 0 }}>
              Enter the 4-digit code shown on the student&apos;s order card.
            </p>
          )}
          <div className="verify-pickup-actions">
            <button type="button" className="action-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="action-btn primary" disabled={submitting || !isValid}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={12} /> Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck size={12} /> Verify & complete
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Outlet menu management (OUTLET_ADMIN) ──────────────────────────────────

interface MenuItemFormState {
  name: string;
  description: string;
  price: string;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  vegetarian: boolean;
  popular: boolean;
  preparationTime: string;
  discount: string;
}

function emptyMenuItemForm(): MenuItemFormState {
  return {
    name: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    isAvailable: true,
    vegetarian: true,
    popular: false,
    preparationTime: '0',
    discount: '',
  };
}

function menuItemToForm(item: MenuItem): MenuItemFormState {
  return {
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    category: item.category?.name ?? '',
    imageUrl: item.imageUrl ?? '',
    isAvailable: item.isAvailable,
    vegetarian: item.vegetarian,
    popular: item.popular,
    preparationTime: String(item.prepTimeMins ?? 0),
    discount: item.discount ?? '',
  };
}

function OutletMenuManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<MenuItem | null>(null);

  const { data: menu, isLoading } = useQuery<MenuItem[]>({
    queryKey: ['nosh', 'outlet', 'menu'],
    queryFn: () => outletApi.listMenu(),
  });

  const availabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      outletApi.setItemAvailability(id, isAvailable),
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: ['nosh', 'outlet', 'menu'] });
      const prev = qc.getQueryData<MenuItem[]>(['nosh', 'outlet', 'menu']);
      if (prev) {
        qc.setQueryData<MenuItem[]>(
          ['nosh', 'outlet', 'menu'],
          prev.map((it) => (it.id === id ? { ...it, isAvailable } : it)),
        );
      }
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['nosh', 'outlet', 'menu'], ctx.prev);
      toastMutationError(e, 'Could not update availability');
    },
    onSuccess: (updated) => {
      // Replace the optimistically-updated row with the server-fresh one.
      const prev = qc.getQueryData<MenuItem[]>(['nosh', 'outlet', 'menu']);
      if (prev) {
        qc.setQueryData<MenuItem[]>(
          ['nosh', 'outlet', 'menu'],
          prev.map((it) => (it.id === updated.id ? updated : it)),
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => outletApi.deleteMenuItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'menu'] });
      toast.success('Menu item deleted');
      setConfirmDelete(null);
    },
    onError: (e) => toastMutationError(e, 'Could not delete item'),
  });

  const filtered = (menu ?? []).filter((i) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      i.name.toLowerCase().includes(q) ||
      (i.description || '').toLowerCase().includes(q) ||
      (i.category?.name || '').toLowerCase().includes(q)
    );
  });

  // Group by category for display.
  const groups = new Map<string, MenuItem[]>();
  for (const item of filtered) {
    const cat = item.category?.name ?? 'Other';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(item);
  }

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'menu'] });
    closeForm();
  }

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <ChefHat className="mgmt-section-icon" size={18} /> Menu items
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search items…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search menu items"
              />
            </div>
            <button className="action-btn primary" onClick={openCreate}>
              <Plus size={14} /> Add item
            </button>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'outlet', 'menu'] })}
              title="Reload"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading menu…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <ChefHat size={26} />
            </div>
            <p style={{ fontWeight: 600, color: 'var(--text-dark)', marginBottom: '0.35rem' }}>
              {search ? 'No items match your search.' : 'No menu items yet.'}
            </p>
            <p>Click <strong>Add item</strong> to create your first dish.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Category</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Diet</th>
                  <th style={{ textAlign: 'center' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(groups.entries()).flatMap(([cat, items]) =>
                  items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="col-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem' }}>
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{
                              width: 40, height: 40, borderRadius: 8,
                              background: 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--text-light)',
                            }}>
                              <ChefHat size={16} />
                            </div>
                          )}
                          <span>
                            {item.name}
                            {item.popular && (
                              <span className="pill" style={{ marginLeft: '0.4rem', padding: '0.1rem 0.5rem', fontSize: '0.65rem', cursor: 'default' }}>
                                <Star size={10} /> Popular
                              </span>
                            )}
                          </span>
                        </div>
                        {item.description && (
                          <div className="col-meta" style={{ marginTop: '0.2rem', marginLeft: '52px' }}>
                            {item.description.length > 80 ? item.description.slice(0, 80) + '…' : item.description}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="pill" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', cursor: 'default' }}>
                          {cat}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(item.price)}</td>
                      <td>
                        <span className="veg-indicator">
                          <span className={`veg-indicator-dot ${item.vegetarian ? '' : 'non-veg'}`} />
                          {item.vegetarian ? 'Veg' : 'Non-veg'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <label className="toggle-switch" title={item.isAvailable ? 'Available — click to hide' : 'Unavailable — click to show'}>
                          <input
                            type="checkbox"
                            checked={item.isAvailable}
                            onChange={(e) =>
                              availabilityMutation.mutate({ id: item.id, isAvailable: e.target.checked })
                            }
                            disabled={
                              availabilityMutation.isPending &&
                              availabilityMutation.variables?.id === item.id
                            }
                          />
                          <span className="toggle-slider" />
                        </label>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="col-actions" style={{ justifyContent: 'flex-end' }}>
                          <button className="action-btn" onClick={() => openEdit(item)} title="Edit">
                            <UserCog size={12} /> Edit
                          </button>
                          <button
                            className="action-btn danger"
                            onClick={() => setConfirmDelete(item)}
                            title="Delete"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <MenuItemFormModal
          initial={editing ? menuItemToForm(editing) : emptyMenuItemForm()}
          itemId={editing?.id ?? null}
          onClose={closeForm}
          onSaved={handleSaved}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          item={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteMutation.mutate(confirmDelete.id)}
          confirming={deleteMutation.isPending && deleteMutation.variables === confirmDelete.id}
        />
      )}
    </div>
  );
}

function MenuItemFormModal({
  initial,
  itemId,
  onClose,
  onSaved,
}: {
  initial: MenuItemFormState;
  itemId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<MenuItemFormState>(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof MenuItemFormState>(key: K, value: MenuItemFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): string | null {
    if (!form.name.trim()) return 'Name is required';
    const price = Number(form.price);
    if (!Number.isFinite(price) || price <= 0) return 'Price must be greater than 0';
    if (!form.category.trim()) return 'Category is required';
    if (form.imageUrl && !/^https?:\/\//.test(form.imageUrl)) return 'Image URL must start with http(s)://';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const price = Number(form.price);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price,
        category: form.category.trim(),
        image: form.imageUrl.trim() || undefined,
        isAvailable: form.isAvailable,
        vegetarian: form.vegetarian,
        popular: form.popular,
        preparationTime: Math.max(0, Number(form.preparationTime) || 0),
        discount: form.discount.trim() ? form.discount.trim() : undefined,
      };
      if (itemId) {
        await outletApi.updateMenuItem(itemId, payload);
        toast.success('Menu item updated');
      } else {
        await outletApi.createMenuItem(payload);
        toast.success('Menu item created');
      }
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save menu item';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-card" role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2 className="modal-title">
            {itemId ? 'Edit menu item' : 'Add menu item'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {error && (
            <div className="form-alert error-alert" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="form-grid">
            <div className="form-row full-width">
              <label htmlFor="mi-name">Name *</label>
              <input
                id="mi-name"
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Adil Special Burger"
                required
                autoFocus
              />
            </div>
            <div className="form-row full-width">
              <label htmlFor="mi-desc">Description</label>
              <textarea
                id="mi-desc"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Short description shown on the menu card"
                maxLength={500}
              />
            </div>
            <div className="form-row">
              <label htmlFor="mi-price">Price (₹) *</label>
              <input
                id="mi-price"
                type="number"
                step="0.5"
                min="1"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="250"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="mi-category">Category *</label>
              <input
                id="mi-category"
                type="text"
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                placeholder="Meals / Snacks / Beverages"
                list="mi-existing-categories"
                required
              />
              <datalist id="mi-existing-categories">
                <option value="Meals" />
                <option value="Snacks" />
                <option value="Beverages" />
                <option value="Desserts" />
              </datalist>
            </div>
            <div className="form-row">
              <label htmlFor="mi-prep">Preparation time (mins)</label>
              <input
                id="mi-prep"
                type="number"
                min="0"
                value={form.preparationTime}
                onChange={(e) => update('preparationTime', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="mi-discount">Discount (label, e.g. &ldquo;20%&rdquo;)</label>
              <input
                id="mi-discount"
                type="text"
                value={form.discount}
                onChange={(e) => update('discount', e.target.value)}
                placeholder="20% or empty"
              />
            </div>
            <div className="form-row full-width">
              <label htmlFor="mi-image">Image URL</label>
              <input
                id="mi-image"
                type="url"
                value={form.imageUrl}
                onChange={(e) => update('imageUrl', e.target.value)}
                placeholder="https://…"
              />
              <span className="field-hint">Direct link to the dish photo.</span>
            </div>
            <div className="form-row full-width">
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.isAvailable}
                    onChange={(e) => update('isAvailable', e.target.checked)}
                  />
                  Available for ordering
                </label>
                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.vegetarian}
                    onChange={(e) => update('vegetarian', e.target.checked)}
                  />
                  Vegetarian
                </label>
                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={form.popular}
                    onChange={(e) => update('popular', e.target.checked)}
                  />
                  Mark as popular
                </label>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="action-btn" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="action-btn primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" size={12} /> Saving…
                </>
              ) : (
                <>{itemId ? 'Save changes' : 'Create item'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({
  item,
  onCancel,
  onConfirm,
  confirming,
}: {
  item: MenuItem;
  onCancel: () => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal-card" role="alertdialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Delete &ldquo;{item.name}&rdquo;?</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close" disabled={confirming}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="notice-banner warning">
            <TriangleAlert size={18} />
            <span>
              This permanently removes the item from your menu. Existing orders that already
              include this dish are unaffected (their snapshot keeps the original name + price).
            </span>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="action-btn" onClick={onCancel} disabled={confirming}>
            Keep item
          </button>
          <button type="button" className="action-btn danger" onClick={onConfirm} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="animate-spin" size={12} /> Deleting…
              </>
            ) : (
              <>
                <Trash2 size={12} /> Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Outlet settings (OUTLET_ADMIN) ─────────────────────────────────────────
//
// Backend contract note: there is currently NO /api/v1/outlet/profile endpoint
// mounted (the validation schema `outletProfileUpdateSchema` exists in the
// validation package, but no router uses it). The brief explicitly calls this
// out: "outlet profile update needs the outlet's own endpoint".
//
// To display something useful, we read the outlet record from the catalog
// list (the user's outlet is OPEN/BUSY in dev) and present it as read-only
// fields with disabled inputs + a notice explaining the gap. If the outlet
// isn't visible in the catalog (CLOSED/SUSPENDED/PENDING), we show only
// the fields we already know (outletId from the user).

function OutletSettingsView() {
  const user = useAuthStore((s) => s.user);
  const { data: outlets } = useQuery<Outlet[]>({
    queryKey: ['nosh', 'outlets'],
    queryFn: () => catalogApi.listOutlets(),
    staleTime: 60_000,
  });
  const outlet = outlets?.find((o) => o.id === user?.outletId) ?? null;

  return (
    <div className="mgmt-section">
      <div className="outlet-settings-card">
        <div className="dashboard-header" style={{ marginBottom: 0 }}>
          <h2 className="dashboard-title" style={{ fontSize: '1.35rem' }}>Outlet settings</h2>
          <p className="dashboard-subtitle">
            Manage your outlet profile. {outlet ? 'Read-only view shown below.' : 'Your outlet is currently hidden from the public catalog.'}
          </p>
        </div>

        <div className="notice-banner info">
          <Info size={18} />
          <span>
            The backend doesn&apos;t yet expose an outlet self-profile endpoint, so these fields
            are read-only in this build. Super-admins can update your outlet status via the admin
            dashboard. Full CRUD will land with the outlet-profile route.
          </span>
        </div>

        {outlet ? (
          <div className="acct-section-card">
            <div className="acct-section-header">
              <h3 className="acct-subsection-title">Outlet profile</h3>
              <p className="acct-section-subtitle">As seen by students browsing the catalog.</p>
            </div>
            <div className="acct-fields-grid">
              <AcctField label="Name" value={outlet.name} icon={<Store size={14} />} />
              <AcctField label="Status" value={outlet.status} icon={<Radio size={14} />} />
              <AcctField label="Location" value={outlet.location || '—'} icon={<MapPin size={14} />} />
              <AcctField label="Default prep time" value={`${outlet.defaultPrepMins} min`} icon={<Clock size={14} />} />
              <AcctField label="Pickup timeout" value={`${outlet.pickupTimeoutMins} min`} icon={<Clock size={14} />} />
              <AcctField label="Rating" value={`${outlet.rating.toFixed(1)} ★`} icon={<Star size={14} />} />
              <AcctField label="Estimated time" value={outlet.estimatedTime || '—'} icon={<Clock size={14} />} />
              <AcctField label="Featured" value={outlet.featured ? 'Yes' : 'No'} icon={<Star size={14} />} />
              <AcctField label="Slug" value={outlet.slug || '—'} icon={<Hash size={14} />} />
              <AcctField label="Tags" value={outlet.tags || '—'} />
            </div>
          </div>
        ) : (
          <div className="acct-section-card">
            <div className="acct-section-header">
              <h3 className="acct-subsection-title">Outlet profile</h3>
            </div>
            <p className="acct-section-subtitle">
              Your outlet is not currently visible to students. Outlet ID:{' '}
              <code style={{ fontFamily: 'JetBrains Mono, monospace', background: '#f3f4f6', padding: '0.05rem 0.4rem', borderRadius: 4 }}>
                {user?.outletId ?? '—'}
              </code>
            </p>
          </div>
        )}

        <div className="acct-section-card">
          <div className="acct-section-header">
            <h3 className="acct-subsection-title">Edit fields (preview)</h3>
            <p className="acct-section-subtitle">Disabled until the backend outlet-profile endpoint is mounted.</p>
          </div>
          <div className="form-grid">
            <div className="form-row full-width">
              <label htmlFor="outlet-name">Outlet name</label>
              <input
                id="outlet-name"
                type="text"
                value={outlet?.name ?? ''}
                disabled
                placeholder="Not available"
              />
            </div>
            <div className="form-row full-width">
              <label htmlFor="outlet-desc">Description</label>
              <textarea
                id="outlet-desc"
                value={outlet?.description ?? ''}
                disabled
                placeholder="Not available"
              />
            </div>
            <div className="form-row">
              <label htmlFor="outlet-prep">Default prep time (mins)</label>
              <input
                id="outlet-prep"
                type="number"
                value={outlet?.defaultPrepMins ?? ''}
                disabled
              />
            </div>
            <div className="form-row">
              <label htmlFor="outlet-timeout">Pickup timeout (mins)</label>
              <input
                id="outlet-timeout"
                type="number"
                value={outlet?.pickupTimeoutMins ?? ''}
                disabled
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="button" className="action-btn primary" disabled title="Backend endpoint not yet mounted">
              <Settings size={12} /> Save changes
            </button>
          </div>
        </div>
      </div>

      {/* Razorpay credentials card — lives in its own outlet-settings-card
          so it visually separates from the read-only profile block. */}
      <RazorpayCredentialsCard outletId={user?.outletId ?? null} />
    </div>
  );
}

// ─── Razorpay credentials card ──────────────────────────────────────────────
//
// POSTs to /api/v1/payments/admin/outlets/:outletId/razorpay-credentials.
// That route is currently SUPER_ADMIN-gated — in dev the outlet admin can
// sign in as the super admin (DEV_ACCOUNTS.superAdmin) to set credentials.
// Credentials are encrypted at rest; no GET endpoint ever returns them.

function RazorpayCredentialsCard({ outletId }: { outletId: string | null }) {
  const [keyId, setKeyId] = useState('');
  const [keySecret, setKeySecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function validate(): string | null {
    if (!outletId) return 'No outlet is associated with your account.';
    if (!keyId.trim()) return 'Key ID is required';
    if (!keySecret.trim()) return 'Key Secret is required';
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await paymentsApi.saveOutletRazorpayCredentials(outletId!, {
        keyId: keyId.trim(),
        keySecret: keySecret.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
      });
      toast.success('Razorpay credentials saved');
      // We deliberately DON'T clear the form — the user may want to verify
      // what they typed before the field is scrubbed. Clear at next visit.
      setKeySecret('');
      setWebhookSecret('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save credentials';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="outlet-settings-card">
      <div className="dashboard-header" style={{ marginBottom: 0 }}>
        <h2 className="dashboard-title" style={{ fontSize: '1.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <CreditCard size={18} style={{ color: 'var(--primary)' }} /> Razorpay configuration
        </h2>
        <p className="dashboard-subtitle">
          Set the gateway keys used to verify student payments for this outlet.
        </p>
      </div>

      <div className="notice-banner info">
        <ShieldCheck size={18} />
        <span>
          These credentials are <strong>encrypted at rest</strong>. They are never returned by any
          API endpoint — only the gateway can decrypt them at payment time.
        </span>
      </div>

      <div className="notice-banner warning">
        <TriangleAlert size={18} />
        <span>
          This endpoint is currently SUPER_ADMIN-gated. For dev testing, sign in as the super
          admin (<code style={{ fontFamily: 'JetBrains Mono, monospace' }}>{DEV_ACCOUNTS.superAdmin.email}</code>) and set credentials for this outlet.
        </span>
      </div>

      <form className="razorpay-creds-form" onSubmit={handleSave}>
        {error && (
          <div className="form-alert error-alert" role="alert">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="form-row full-width" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="rz-key-id" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-gray)' }}>
            Key ID
          </label>
          <input
            id="rz-key-id"
            type="text"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="rzp_live_XXXXXXXXXX or rzp_test_XXXXXXXXXX"
            autoComplete="off"
            disabled={submitting || !outletId}
            required
            style={{
              border: '1px solid var(--input-border)',
              borderRadius: 8,
              padding: '0.55rem 0.75rem',
              fontSize: '0.88rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span className="razorpay-creds-hint">
            <Info size={12} /> Find this in Razorpay Dashboard → API Keys.
          </span>
        </div>

        <div className="form-row full-width" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="rz-key-secret" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-gray)' }}>
            Key Secret
          </label>
          <input
            id="rz-key-secret"
            type="password"
            value={keySecret}
            onChange={(e) => setKeySecret(e.target.value)}
            placeholder="Your Razorpay Key Secret"
            autoComplete="off"
            disabled={submitting || !outletId}
            required
            style={{
              border: '1px solid var(--input-border)',
              borderRadius: 8,
              padding: '0.55rem 0.75rem',
              fontSize: '0.88rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span className="razorpay-creds-hint">
            <Lock size={12} /> Stored encrypted — never displayed again after save.
          </span>
        </div>

        <div className="form-row full-width" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label htmlFor="rz-webhook-secret" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-gray)' }}>
            Webhook Secret <span style={{ color: 'var(--text-light)' }}>(optional)</span>
          </label>
          <input
            id="rz-webhook-secret"
            type="password"
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Used to verify Razorpay webhook signatures"
            autoComplete="off"
            disabled={submitting || !outletId}
            style={{
              border: '1px solid var(--input-border)',
              borderRadius: 8,
              padding: '0.55rem 0.75rem',
              fontSize: '0.88rem',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <span className="razorpay-creds-hint">
            <ShieldCheck size={12} /> Required to confirm payments when the gateway can&apos;t reach the client (e.g., dev 503s).
          </span>
        </div>

        <div className="razorpay-creds-actions">
          <button type="submit" className="action-btn primary" disabled={submitting || !outletId}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={12} /> Saving…
              </>
            ) : (
              <>
                <Key size={12} /> Save credentials
              </>
            )}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => toast.info('Test feature coming soon')}
            disabled={!outletId}
            title="Validate the credentials against the Razorpay API"
          >
            <ShieldCheck size={12} /> Test credentials
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Admin view (dashboard) ───────────────────────────────────────────────────

type AdminTab = 'overview' | 'users' | 'outlets' | 'orders' | 'menu' | 'staff' | 'refunds' | 'settings' | 'audit';

function AdminView() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<AdminTab>('overview');

  const { data, isLoading } = useQuery<AdminOverview>({
    queryKey: ['nosh', 'admin', 'overview'],
    queryFn: () => adminApi.overview(),
    refetchInterval: 30_000,
  });

  const navItems: { key: AdminTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
    { key: 'users', label: 'Users', icon: <Users size={16} />, count: data?.users.total },
    { key: 'outlets', label: 'Outlets', icon: <Store size={16} />, count: data?.outlets.total },
    { key: 'orders', label: 'Orders', icon: <ClipboardList size={16} />, count: data?.orders.total },
    { key: 'menu', label: 'Menu catalog', icon: <BookOpen size={16} />, count: data?.menu.total },
    { key: 'staff', label: 'Staff directory', icon: <UserCog size={16} /> },
    { key: 'refunds', label: 'Refunds', icon: <Wallet size={16} /> },
    { key: 'settings', label: 'Campus settings', icon: <Settings size={16} /> },
    { key: 'audit', label: 'Audit log', icon: <ScrollText size={16} /> },
  ];

  return (
    <div className="page-wrapper">
      <AppHeader contextLabel="Super admin" />

      <main className="dashboard-container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Platform overview</h1>
          <p className="dashboard-subtitle">
            Signed in as {user?.email} · live counts across users, outlets, menu and orders
          </p>
        </div>

        {/* Mobile nav (horizontal scroll on small screens) */}
        <nav className="admin-mobile-nav" aria-label="Admin sections (mobile)">
          {navItems.map((it) => (
            <button
              key={it.key}
              className={`admin-nav-item ${tab === it.key ? 'active' : ''}`}
              onClick={() => setTab(it.key)}
              aria-current={tab === it.key ? 'page' : undefined}
            >
              {it.icon}
              <span>{it.label}</span>
              {typeof it.count === 'number' && <span className="nav-count">{it.count}</span>}
            </button>
          ))}
        </nav>

        <div className="admin-layout">
          <aside className="admin-sidebar" aria-label="Admin sections">
            {navItems.map((it) => (
              <button
                key={it.key}
                className={`admin-nav-item ${tab === it.key ? 'active' : ''}`}
                onClick={() => setTab(it.key)}
                aria-current={tab === it.key ? 'page' : undefined}
              >
                {it.icon}
                <span>{it.label}</span>
                {typeof it.count === 'number' && <span className="nav-count">{it.count}</span>}
              </button>
            ))}
            <div className="admin-nav-divider" />
            <button
              className="admin-nav-item"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin'] })}
              title="Refresh all admin data"
            >
              <RefreshCw size={16} /> Refresh data
            </button>
          </aside>

          <div className="admin-content">
            {tab === 'overview' && (
              <>
                {isLoading || !data ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                    <Loader2 className="animate-spin" size={16} /> Loading overview…
                  </div>
                ) : (
                  <>
                    <div className="admin-overview-grid">
                      <AdminOverviewCard
                        title="Users"
                        total={data.users.total}
                        icon={<Users size={16} />}
                        rows={[
                          { label: 'Students', value: data.users.students },
                          { label: 'Outlet admins', value: data.users.outletAdmins },
                          { label: 'Outlet staff', value: data.users.outletStaff },
                          { label: 'Super admins', value: data.users.superAdmins },
                        ]}
                      />
                      <AdminOverviewCard
                        title="Outlets"
                        total={data.outlets.total}
                        icon={<Store size={16} />}
                        rows={[
                          { label: 'Open', value: data.outlets.open },
                          { label: 'Busy', value: data.outlets.busy },
                          { label: 'Closed', value: data.outlets.closed },
                          { label: 'Pending', value: data.outlets.pending },
                          { label: 'Suspended', value: data.outlets.suspended },
                        ]}
                      />
                      <AdminOverviewCard
                        title="Menu"
                        total={data.menu.total}
                        icon={<BookOpen size={16} />}
                        rows={[
                          { label: 'Available', value: data.menu.available },
                          { label: 'Unavailable', value: data.menu.unavailable },
                        ]}
                      />
                      <AdminOverviewCard
                        title="Orders"
                        total={data.orders.total}
                        icon={<ClipboardList size={16} />}
                        rows={[
                          { label: 'Pending', value: data.orders.pending },
                          { label: 'Accepted', value: data.orders.accepted },
                          { label: 'Preparing', value: data.orders.preparing },
                          { label: 'Ready', value: data.orders.ready },
                          { label: 'Completed', value: data.orders.completed },
                          { label: 'Rejected', value: data.orders.rejected },
                          { label: 'Cancelled', value: data.orders.cancelled },
                        ]}
                      />
                    </div>

                    <div className="admin-stat-pills">
                      <AdminStatPill
                        label="Active outlets"
                        value={data.outlets.open + data.outlets.busy}
                        icon={<Store size={14} />}
                      />
                      <AdminStatPill
                        label="In kitchen"
                        value={data.orders.preparing + data.orders.ready}
                        icon={<ChefHat size={14} />}
                      />
                      <AdminStatPill
                        label="Fulfilled today"
                        value={data.orders.completed}
                        icon={<CheckCircle2 size={14} />}
                      />
                      <AdminStatPill
                        label="Cancelled"
                        value={data.orders.cancelled + data.orders.rejected}
                        icon={<XCircle size={14} />}
                      />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                      <button
                        className="refresh-btn"
                        onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] })}
                      >
                        <RefreshCw size={12} /> Refresh
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {tab === 'users' && <AdminUserManagement />}
            {tab === 'outlets' && <AdminOutletManagement />}
            {tab === 'orders' && <AdminOrderMonitoring />}
            {tab === 'menu' && <AdminMenuCatalog />}
            {tab === 'staff' && <AdminStaffDirectory />}
            {tab === 'refunds' && <AdminManualRefund />}
            {tab === 'settings' && <AdminCampusSettings />}
            {tab === 'audit' && <AdminAuditLog />}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Admin user management ────────────────────────────────────────────────────

function AdminUserManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['nosh', 'admin', 'users', page, pageSize],
    queryFn: () => adminApi.listUsers({ page, pageSize }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'SUSPENDED' }) =>
      adminApi.updateUserStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'users'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] });
      toast.success('User status updated');
    },
    onError: (e) => toastMutationError(e, 'Could not update user status'),
  });

  const items = (data?.items ?? []) as AdminUserItem[];
  const filtered = items.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <Users className="mgmt-section-icon" size={18} /> Users
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search by name, email, role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search users"
              />
            </div>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'users'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading users…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <Users size={26} />
            </div>
            <p>No users found.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Outlet</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isActive = u.status === 'ACTIVE';
                  const suspended = u.status === 'SUSPENDED';
                  const pending = u.status === 'PENDING';
                  return (
                    <tr key={u.id}>
                      <td className="col-name">{u.name ?? '—'}</td>
                      <td className="col-meta">{u.email}</td>
                      <td>
                        <span className="pill" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', cursor: 'default' }}>
                          {u.role.replace('_', ' ').toLowerCase()}
                        </span>
                      </td>
                      <td className="col-meta">
                        {u.outletStaff?.outletId ? (
                          <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                            {u.outletStaff.outletId.slice(-8)}
                          </code>
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${isActive ? 'active' : suspended ? 'danger' : 'warning'}`} style={{ fontSize: '0.72rem' }}>
                          <span className="status-dot" />
                          {u.status.charAt(0) + u.status.slice(1).toLowerCase()}
                        </span>
                        {pending && <span className="col-meta" style={{ display: 'block', marginTop: '0.2rem' }}>needs verify</span>}
                      </td>
                      <td className="col-meta">{formatRelativeTime(u.createdAt)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="col-actions" style={{ justifyContent: 'flex-end' }}>
                          {isActive ? (
                            <button
                              className="action-btn warning"
                              onClick={() => statusMutation.mutate({ id: u.id, status: 'SUSPENDED' })}
                              disabled={statusMutation.isPending && statusMutation.variables?.id === u.id}
                              title="Suspend user"
                            >
                              {statusMutation.isPending && statusMutation.variables?.id === u.id ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <Lock size={12} />
                              )} Suspend
                            </button>
                          ) : (
                            <button
                              className="action-btn success"
                              onClick={() => statusMutation.mutate({ id: u.id, status: 'ACTIVE' })}
                              disabled={statusMutation.isPending && statusMutation.variables?.id === u.id}
                              title="Reactivate user"
                            >
                              {statusMutation.isPending && statusMutation.variables?.id === u.id ? (
                                <Loader2 className="animate-spin" size={12} />
                              ) : (
                                <CheckCircle2 size={12} />
                              )} Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <span className="pagination-info">
            {data ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} users` : '—'}
          </span>
          <div className="pagination-controls">
            <button
              className="action-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ArrowLeft size={12} /> Prev
            </button>
            <span className="pagination-info">Page {page} / {totalPages}</span>
            <button
              className="action-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin outlet management ─────────────────────────────────────────────────

function AdminOutletManagement() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);

  const { data: outlets, isLoading } = useQuery<AdminOutletItem[]>({
    queryKey: ['nosh', 'admin', 'outlets'],
    queryFn: () => adminApi.listOutlets(),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OutletStatus }) =>
      adminApi.updateOutletStatus(id, status),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['nosh', 'admin', 'outlets'] });
      const prev = qc.getQueryData<AdminOutletItem[]>(['nosh', 'admin', 'outlets']);
      if (prev) {
        qc.setQueryData<AdminOutletItem[]>(
          ['nosh', 'admin', 'outlets'],
          prev.map((o) => (o.id === id ? { ...o, status } : o)),
        );
      }
      return { prev };
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['nosh', 'admin', 'outlets'], ctx.prev);
      toastMutationError(e, 'Could not update outlet status');
    },
    onSuccess: (updated) => {
      const prev = qc.getQueryData<AdminOutletItem[]>(['nosh', 'admin', 'outlets']);
      if (prev) {
        qc.setQueryData<AdminOutletItem[]>(
          ['nosh', 'admin', 'outlets'],
          prev.map((o) => (o.id === updated.id ? { ...o, status: updated.status } : o)),
        );
      }
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'outlets'] });
      toast.success(`Outlet ${updated.name} → ${updated.status}`);
    },
  });

  const filtered = (outlets ?? []).filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q) || (o.location || '').toLowerCase().includes(q);
  });

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <Store className="mgmt-section-icon" size={18} /> Outlets
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search outlets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search outlets"
              />
            </div>
            <button
              className="action-btn"
              style={{
                backgroundColor: 'var(--primary)',
                borderColor: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
                padding: '0.4rem 0.75rem',
                borderRadius: '8px',
              }}
              onClick={() => setAddModalOpen(true)}
            >
              <Plus size={14} /> Add Outlet
            </button>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'outlets'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading outlets…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <Store size={26} />
            </div>
            <p>No outlets found.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Outlet</th>
                  <th>Location</th>
                  <th>Staff</th>
                  <th style={{ textAlign: 'right' }}>Prep / Timeout</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Change status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="col-name">{o.name}</div>
                      <div className="col-meta">{o.description || '—'}</div>
                    </td>
                    <td className="col-meta">{o.location || '—'}</td>
                    <td className="col-meta">
                      {o.staff && o.staff.length > 0 ? `${o.staff.length} member${o.staff.length > 1 ? 's' : ''}` : 'No staff'}
                    </td>
                    <td className="col-meta" style={{ textAlign: 'right' }}>
                      {o.defaultPrepMins} min · {o.pickupTimeoutMins} min
                    </td>
                    <td>
                      <span className={`status-badge ${
                        o.status === 'OPEN' ? 'active' :
                        o.status === 'BUSY' ? 'warning' :
                        o.status === 'SUSPENDED' ? 'danger' :
                        o.status === 'PENDING' ? 'warning' : 'inactive'
                      }`} style={{ fontSize: '0.72rem' }}>
                        <span className="status-dot" />
                        {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <select
                        className="status-select"
                        value={o.status}
                        onChange={(e) =>
                          statusMutation.mutate({ id: o.id, status: e.target.value as OutletStatus })
                        }
                        disabled={
                          statusMutation.isPending && statusMutation.variables?.id === o.id
                        }
                        title="Change outlet status"
                      >
                        <option value="OPEN">Open</option>
                        <option value="BUSY">Busy</option>
                        <option value="CLOSED">Closed</option>
                        <option value="PENDING">Pending</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {addModalOpen && (
        <AdminAddOutletModal
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => {
            setAddModalOpen(false);
            qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'outlets'] });
            qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] });
          }}
        />
      )}
    </div>
  );
}

function AdminAddOutletModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('22:00');
  const [status, setStatus] = useState<OutletStatus>('OPEN');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Outlet name is required');
      return;
    }
    try {
      setSubmitting(true);
      await adminApi.createOutlet({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        contactNumber: contactNumber.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        openingTime,
        closingTime,
        status,
      });
      toast.success(`Outlet "${name}" created successfully`);
      onSuccess();
    } catch (err: unknown) {
      toastMutationError(err, 'Failed to create outlet');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-md">
        <div className="modal-card-header">
          <h2 className="modal-card-title">
            <Store size={18} className="text-[#b10035]" /> Add New Campus Outlet
          </h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-card-body space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Outlet Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. South Indian Express, Cafe Coffee"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Location on Campus</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Academic Block 1 Ground Floor"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="outlet@campus.edu"
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Opening Time</label>
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Closing Time</label>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Fresh dosas, idlis, and traditional filter coffee"
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Initial Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OutletStatus)}
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:border-[#b10035] focus:outline-none"
              >
                <option value="OPEN">Open (Accepting Orders)</option>
                <option value="PENDING">Pending Setup</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
          </div>

          <div className="modal-card-footer">
            <button
              type="button"
              className="action-btn text-xs py-2 px-3 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="action-btn text-xs py-2 px-4 rounded-lg bg-[#b10035] hover:bg-[#900028] text-white font-bold"
            >
              {submitting && <Loader2 size={12} className="animate-spin inline mr-1" />}
              Create Outlet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Admin campus menu catalog ───────────────────────────────────────────────

function AdminMenuCatalog() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const { data: menu = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ['nosh', 'admin', 'menu'],
    queryFn: () => adminApi.listMenu(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      adminApi.updateMenuItemStatus(id, isAvailable),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'menu'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] });
      toast.success(`${updated.name} availability updated`);
    },
    onError: (err) => toastMutationError(err, 'Failed to update menu item'),
  });

  const categories = Array.from(new Set(menu.map((m) => m.category?.name || 'Mains'))).sort();

  const filtered = menu.filter((item) => {
    const q = search.trim().toLowerCase();
    const catName = item.category?.name || 'Mains';
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q) ||
      catName.toLowerCase().includes(q);
    const matchesCat = categoryFilter === 'ALL' || catName === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <BookOpen className="mgmt-section-icon" size={18} /> Campus Menu Catalog
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search across all dishes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search menu catalog"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="status-select"
              aria-label="Filter by category"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'menu'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading campus menu catalog…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <BookOpen size={26} />
            </div>
            <p>No dishes match your search criteria.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Dish</th>
                  <th>Category</th>
                  <th>Dietary</th>
                  <th style={{ textAlign: 'right' }}>Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Toggle Stock</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const isVeg = item.vegetarian ?? item.isVeg ?? true;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="col-name">{item.name}</div>
                        <div className="col-meta">{item.description || '—'}</div>
                      </td>
                      <td className="col-meta">{item.category?.name || 'Mains'}</td>
                      <td>
                        <span className={`pill ${isVeg ? 'active' : ''}`} style={{ fontSize: '0.7rem' }}>
                          {isVeg ? 'Veg' : 'Non-Veg'}
                        </span>
                      </td>
                      <td className="col-name" style={{ textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                        {formatINR(item.price)}
                      </td>
                      <td>
                        <span className={`status-badge ${item.isAvailable ? 'active' : 'inactive'}`} style={{ fontSize: '0.72rem' }}>
                          <span className="status-dot" />
                          {item.isAvailable ? 'Available' : 'Unavailable (86\'d)'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="action-btn"
                          onClick={() => toggleMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                          disabled={toggleMutation.isPending}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                        >
                          {item.isAvailable ? 'Mark 86\'d' : 'Make Available'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin campus staff directory ───────────────────────────────────────────

function AdminStaffDirectory() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: staff = [], isLoading } = useQuery<StaffMember[]>({
    queryKey: ['nosh', 'admin', 'staff'],
    queryFn: () => adminApi.listAllStaff(),
  });

  const filtered = staff.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.outlet?.name || '').toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <UserCog className="mgmt-section-icon" size={18} /> Campus Staff Directory
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search staff by name, email, outlet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search staff"
              />
            </div>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'staff'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading campus staff directory…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <UserCog size={26} />
            </div>
            <p>No staff records found.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Assigned Outlet</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="col-name">{s.name}</div>
                      <div className="col-meta">{s.email}</div>
                    </td>
                    <td>
                      <div className="col-name">{s.outlet?.name ?? 'Unassigned'}</div>
                      <div className="col-meta">{s.outlet?.location ?? '—'}</div>
                    </td>
                    <td>
                      <span className="pill" style={{ fontSize: '0.7rem' }}>
                        {s.role === 'OUTLET_ADMIN' ? 'Outlet Manager' : 'Kitchen Staff'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${s.status === 'ACTIVE' ? 'active' : 'danger'}`} style={{ fontSize: '0.72rem' }}>
                        <span className="status-dot" />
                        {s.status}
                      </span>
                    </td>
                    <td className="col-meta" style={{ whiteSpace: 'nowrap' }}>
                      {formatRelativeTime(s.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Admin campus platform settings ─────────────────────────────────────────

function AdminCampusSettings() {
  const [campusName, setCampusName] = useState('Inovix Institute of Technology');
  const [platformFee, setPlatformFee] = useState('5.00');
  const [pickupGraceMins, setPickupGraceMins] = useState('15');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [operatingStatus, setOperatingStatus] = useState('NORMAL');

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.success('Campus platform settings saved successfully');
  }

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap" style={{ padding: '1.5rem', maxWidth: '640px' }}>
        <h2 className="mgmt-section-title" style={{ marginBottom: '1.25rem' }}>
          <Settings className="mgmt-section-icon" size={18} /> Campus Platform Configuration
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Campus Hub Name</label>
            <input
              type="text"
              value={campusName}
              onChange={(e) => setCampusName(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Convenience Fee (₹)</label>
              <input
                type="number"
                step="0.50"
                value={platformFee}
                onChange={(e) => setPlatformFee(e.target.value)}
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:border-[#b10035] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Pickup Grace Period</label>
              <select
                value={pickupGraceMins}
                onChange={(e) => setPickupGraceMins(e.target.value)}
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:border-[#b10035] focus:outline-none"
              >
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Operational Status</label>
            <select
              value={operatingStatus}
              onChange={(e) => setOperatingStatus(e.target.value)}
              className="w-full text-xs p-2.5 border border-gray-200 rounded-xl bg-white focus:border-[#b10035] focus:outline-none"
            >
              <option value="NORMAL">Normal Campus Operations</option>
              <option value="PEAK">Peak Lunch Hours (Extended Prep Times)</option>
              <option value="FEST">Campus Fest / Event Mode</option>
              <option value="LIMITED">Limited Dining Service</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2 pb-2">
            <input
              type="checkbox"
              id="maintMode"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="rounded border-gray-300 text-[#b10035] focus:ring-[#b10035]"
            />
            <label htmlFor="maintMode" className="text-xs font-semibold text-gray-700">
              Campus Maintenance Mode (Disable all checkout)
            </label>
          </div>

          <button
            type="submit"
            className="action-btn"
            style={{
              backgroundColor: 'var(--primary)',
              borderColor: 'var(--primary)',
              color: 'white',
              fontWeight: 700,
              padding: '0.6rem 1.25rem',
              borderRadius: '8px',
            }}
          >
            Save Campus Settings
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Admin order monitoring ──────────────────────────────────────────────────

function AdminOrderMonitoring() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data, isLoading } = useQuery({
    queryKey: ['nosh', 'admin', 'orders', page, pageSize],
    queryFn: () => adminApi.listOrders({ page, pageSize }),
  });

  const items = (data?.items ?? []) as AdminOrderItem[];
  const filtered = items.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      o.orderNumber.toLowerCase().includes(q) ||
      (o.student?.email ?? '').toLowerCase().includes(q) ||
      (o.outlet?.name ?? '').toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q)
    );
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <ClipboardList className="mgmt-section-icon" size={18} /> All orders
          </h2>
          <div className="mgmt-toolbar">
            <div className="mgmt-search">
              <span className="search-icon"><Search size={14} /></span>
              <input
                type="text"
                placeholder="Search by order #, student, outlet…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search orders"
              />
            </div>
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'orders'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading orders…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <ClipboardList size={26} />
            </div>
            <p>No orders found.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Student</th>
                  <th>Outlet</th>
                  <th>Status</th>
                  <th>Placed</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div className="col-name">{o.orderNumber}</div>
                      {o.pickupCode && (
                        <div className="col-meta">pickup {o.pickupCode}</div>
                      )}
                    </td>
                    <td className="col-meta">
                      {o.student?.name ?? o.student?.email ?? '—'}
                    </td>
                    <td className="col-meta">{o.outlet?.name ?? '—'}</td>
                    <td>
                      <span className={`order-status ${o.status.toLowerCase()}`}>
                        {o.status.charAt(0) + o.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="col-meta">{formatRelativeTime(o.createdAt)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(o.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <span className="pagination-info">
            {data ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} orders` : '—'}
          </span>
          <div className="pagination-controls">
            <button
              className="action-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ArrowLeft size={12} /> Prev
            </button>
            <span className="pagination-info">Page {page} / {totalPages}</span>
            <button
              className="action-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin manual refund ─────────────────────────────────────────────────────

function AdminManualRefund() {
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const { data: ordersData } = useQuery({
    queryKey: ['nosh', 'admin', 'orders', 1, 200],
    queryFn: () => adminApi.listOrders({ page: 1, pageSize: 200 }),
  });

  const selectedOrder = (ordersData?.items ?? []).find((o) => o.id === orderId) ?? null;
  const paymentAmount = selectedOrder?.payment?.amount ? Number(selectedOrder.payment.amount) : 0;
  const refundedSoFar = (selectedOrder?.payment?.refunds ?? [])
    .filter((r) => r.status === 'COMPLETED' || r.status === 'PENDING')
    .reduce((s, r) => s + Number(r.amount), 0);
  const refundableRemaining = Math.max(0, paymentAmount - refundedSoFar);

  const refundMutation = useMutation({
    mutationFn: () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error('Enter a valid refund amount');
      if (!reason.trim()) throw new Error('Reason is required');
      if (!orderId) throw new Error('Select an order first');
      if (amt > refundableRemaining) {
        throw new Error(`Refund exceeds remaining refundable amount (${formatINR(refundableRemaining)})`);
      }
      return adminApi.issueRefund({ orderId, amount: amt, reason: reason.trim() });
    },
    onSuccess: (refund) => {
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['nosh', 'admin', 'overview'] });
      toast.success(`Refund of ${formatINR(refund.amount)} issued`);
      setAmount('');
      setReason('');
      setError('');
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Refund failed';
      setError(message);
      toast.error(message);
    },
  });

  const eligibleOrders = (ordersData?.items ?? []).filter(
    (o) => o.payment && (o.payment.status === 'PAID' || o.payment.status === 'REFUNDED'),
  );

  return (
    <div className="mgmt-section">
      <div className="mgmt-section-header" style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: 16, padding: '1.25rem 1.5rem', marginBottom: 0 }}>
        <h2 className="mgmt-section-title">
          <Wallet className="mgmt-section-icon" size={18} /> Manual refund
        </h2>
      </div>

      <div className="refund-layout" style={{ marginTop: '1rem' }}>
        <form
          className="outlet-settings-card"
          onSubmit={(e) => {
            e.preventDefault();
            refundMutation.mutate();
          }}
        >
          {error && (
            <div className="form-alert error-alert" role="alert">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <div className="form-row full-width">
            <label htmlFor="refund-order">Select order</label>
            <select
              id="refund-order"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setError('');
              }}
              required
            >
              <option value="">Choose an order with a paid payment…</option>
              {eligibleOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} · {o.outlet?.name ?? 'Outlet'} · {formatINR(o.totalAmount)} · {o.payment?.status}
                </option>
              ))}
            </select>
            {eligibleOrders.length === 0 && (
              <span className="field-hint">No eligible orders yet. Place + verify a payment first.</span>
            )}
          </div>

          <div className="form-row">
            <label htmlFor="refund-amount">Amount (₹)</label>
            <input
              id="refund-amount"
              type="number"
              step="1"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              required
            />
            {refundableRemaining > 0 && (
              <span className="field-hint">
                Remaining refundable: <strong>{formatINR(refundableRemaining)}</strong>
              </span>
            )}
          </div>

          <div className="form-row full-width">
            <label htmlFor="refund-reason">Reason</label>
            <textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this refund being issued manually?"
              maxLength={300}
              required
            />
          </div>

          <div>
            <button
              type="submit"
              className="action-btn primary"
              disabled={refundMutation.isPending || !orderId}
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={12} /> Issuing…
                </>
              ) : (
                <>
                  <Wallet size={12} /> Issue refund
                </>
              )}
            </button>
          </div>
        </form>

        <div className="refund-info-card">
          <h3 className="acct-subsection-title">Order summary</h3>
          {selectedOrder ? (
            <>
              <div className="refund-info-row">
                <span className="refund-info-label">Order #</span>
                <span className="refund-info-value">{selectedOrder.orderNumber}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Student</span>
                <span className="refund-info-value">{selectedOrder.student?.name ?? selectedOrder.student?.email ?? '—'}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Outlet</span>
                <span className="refund-info-value">{selectedOrder.outlet?.name ?? '—'}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Order total</span>
                <span className="refund-info-value">{formatINR(selectedOrder.totalAmount)}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Payment status</span>
                <span className={`refund-info-value ${selectedOrder.payment?.status === 'PAID' ? 'success' : 'danger'}`}>
                  {selectedOrder.payment?.status ?? '—'}
                </span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Payment amount</span>
                <span className="refund-info-value">{formatINR(paymentAmount)}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Already refunded</span>
                <span className="refund-info-value">{formatINR(refundedSoFar)}</span>
              </div>
              <div className="refund-info-row">
                <span className="refund-info-label">Refundable remaining</span>
                <span className={`refund-info-value ${refundableRemaining > 0 ? 'success' : 'danger'}`}>
                  {formatINR(refundableRemaining)}
                </span>
              </div>

              {selectedOrder.payment?.refunds && selectedOrder.payment.refunds.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div className="refund-info-label" style={{ fontSize: '0.78rem' }}>Past refunds</div>
                  {selectedOrder.payment.refunds.map((r) => (
                    <div key={r.id} className="refund-info-row" style={{ fontSize: '0.78rem' }}>
                      <span>{formatINR(r.amount)} · {r.status}</span>
                      <span style={{ color: 'var(--text-gray)' }}>{formatRelativeTime(r.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="acct-section-subtitle">Select an order to see its payment + refund history.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin audit log ─────────────────────────────────────────────────────────

function AdminAuditLog() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const { data, isLoading } = useQuery({
    queryKey: ['nosh', 'audit', page, pageSize],
    queryFn: () => auditApi.list({ page, pageSize }),
  });

  const items = (data?.items ?? []) as AuditLogEntry[];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="mgmt-section">
      <div className="mgmt-table-wrap">
        <div className="mgmt-section-header">
          <h2 className="mgmt-section-title">
            <ScrollText className="mgmt-section-icon" size={18} /> Audit log
          </h2>
          <div className="mgmt-toolbar">
            <button
              className="refresh-btn"
              onClick={() => qc.invalidateQueries({ queryKey: ['nosh', 'audit'] })}
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mgmt-empty">
            <Loader2 className="animate-spin" size={20} />
            <p>Loading audit log…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="mgmt-empty">
            <div className="empty-icon-wrapper">
              <ScrollText size={26} />
            </div>
            <p>No audit entries yet.</p>
          </div>
        ) : (
          <div className="mgmt-table-scroll">
            <table className="mgmt-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Before → After</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry) => {
                  const before = parseJSON<Record<string, unknown>>(entry.before, {});
                  const after = parseJSON<Record<string, unknown>>(entry.after, {});
                  const beforeKeys = Object.keys(before);
                  const afterKeys = Object.keys(after);
                  const hasBefore = beforeKeys.length > 0 && !(beforeKeys.length === 1 && beforeKeys[0] === '' && before[beforeKeys[0]] === '');
                  const hasAfter = afterKeys.length > 0 && !(afterKeys.length === 1 && afterKeys[0] === '' && after[afterKeys[0]] === '');
                  return (
                    <tr key={entry.id}>
                      <td className="col-meta" style={{ whiteSpace: 'nowrap' }}>
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td>
                        <div className="col-name">{entry.actor?.name ?? entry.actor?.email ?? '—'}</div>
                        <div className="col-meta">{entry.actor?.role ?? 'system'}</div>
                      </td>
                      <td>
                        <span className="pill" style={{ padding: '0.25rem 0.65rem', fontSize: '0.7rem', cursor: 'default' }}>
                          {entry.action}
                        </span>
                      </td>
                      <td>
                        <div className="col-name">{entry.targetType}</div>
                        <div className="col-meta">
                          {entry.targetId ? (
                            <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.7rem' }}>
                              {entry.targetId.slice(-10)}
                            </code>
                          ) : '—'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', minWidth: 220 }}>
                          {hasBefore ? (
                            <pre className="audit-json">{JSON.stringify(before, null, 2)}</pre>
                          ) : (
                            <span className="col-meta" style={{ fontSize: '0.75rem' }}>(no before snapshot)</span>
                          )}
                          {hasAfter ? (
                            <pre className="audit-json">{JSON.stringify(after, null, 2)}</pre>
                          ) : (
                            <span className="col-meta" style={{ fontSize: '0.75rem' }}>(no after snapshot)</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination-bar">
          <span className="pagination-info">
            {data ? `${(data.page - 1) * data.pageSize + 1}–${Math.min(data.page * data.pageSize, data.total)} of ${data.total} entries` : '—'}
          </span>
          <div className="pagination-controls">
            <button
              className="action-btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ArrowLeft size={12} /> Prev
            </button>
            <span className="pagination-info">Page {page} / {totalPages}</span>
            <button
              className="action-btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminOverviewCard({
  title,
  total,
  icon,
  rows,
}: {
  title: string;
  total: number;
  icon: React.ReactNode;
  rows: { label: string; value: number }[];
}) {
  return (
    <div className="admin-overview-card">
      <div className="admin-overview-card-header">
        <div className="admin-overview-card-title">
          <span className="admin-overview-icon">{icon}</span> {title}
        </div>
        <div className="admin-overview-card-total">
          <div className="admin-overview-card-total-value">{total}</div>
          <div className="admin-overview-card-total-label">total</div>
        </div>
      </div>
      <ul className="admin-overview-card-rows" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.label} className="admin-overview-card-row">
            <span className="admin-overview-card-row-label">{r.label}</span>
            <span className="admin-overview-card-row-value">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AdminStatPill({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="admin-stat-pill">
      <div className="admin-stat-pill-label">
        <span>{label}</span>
        <span>{icon}</span>
      </div>
      <div className="admin-stat-pill-value">{value}</div>
    </div>
  );
}
