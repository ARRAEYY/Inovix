import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useGoogleAuth } from '../../hooks/useGoogleAuth';

const StudentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();
  const { login } = useAuth();

  // Google OAuth — the redirect flow. signInWithGoogle() navigates to
  // GET /api/v1/auth/google, which 302s to Google, which redirects back
  // to /api/v1/auth/google/callback, which sets the refresh cookie and
  // 302s to /inovix-app/?google_login=success|error. AuthContext handles
  // the success case (refresh + fetch user + navigate). Here we only show
  // errors that came back via the URL params.
  const { signInWithGoogle } = useGoogleAuth({
    onSuccess: (user) => {
      if (user?.role === 'SUPER_ADMIN') navigate('/admin');
      else if (user?.role === 'OUTLET_ADMIN') navigate('/outlet/admin');
      else if (user?.role === 'OUTLET_STAFF') navigate('/outlet');
      else navigate('/student');
    },
  });

  // Show any Google OAuth error that came back via ?google_login=error&reason=...
  useEffect(() => {
    const g = searchParams.get('google_login');
    const reason = searchParams.get('reason');
    if (g === 'error' && reason) {
      setError(`Google login failed: ${decodeURIComponent(reason)}`);
      // Clean the URL so the error doesn't persist on refresh.
      searchParams.delete('google_login');
      searchParams.delete('reason');
      setSearchParams(searchParams, { replace: true });
    } else if (g === 'success') {
      // AuthContext should have picked this up + navigated; if we land here
      // with success but no user, the refresh probably failed. Clean up.
      searchParams.delete('google_login');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      // `login()` returns the user object (see AuthContext) — route the
      // user to the dashboard that matches their actual role. Without
      // this, a SUPER_ADMIN who uses the student login page lands on
      // `/student`, fails the STUDENT role guard, and gets bounced back
      // to `/` (looks like a failed login).
      const user = await login(email, password);
      if (user?.role === 'SUPER_ADMIN') {
        navigate('/admin');
      } else if (user?.role === 'OUTLET_ADMIN' || user?.role === 'OUTLET_STAFF') {
        navigate(user.role === 'OUTLET_ADMIN' ? '/outlet/admin' : '/outlet');
      } else {
        // Students who haven't completed onboarding → redirect to the
        // onboarding page (same as the Google callback path).
        if (!user?.onboardingCompleted) {
          navigate('/student/onboarding');
        } else {
          navigate('/student');
        }
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };
  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand">
          <img src="/logo.png" alt="Nosh" style={{ height: '72px' }} />
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Good food.<br />
            <span className="highlight"> Zero waiting.</span>
          </h1>
          <p className="hero-description">
            Order from your favorite campus outlets
            <br />
            and pick it up when it’s ready
          </p>
        </div>
      </div>

      <div className="login-right">
        <div className="login-card">
          <p className="card-subheading">Student Login</p>
          <h2 className="card-title">Welcome</h2>

          <form className="login-form" onSubmit={handleLogin}>
            <div className="input-group">
              <label htmlFor="email">College email</label>
              <input 
                type="email" 
                id="email" 
                placeholder="you@campus.edu" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
                required
              />
              <div className="forgot-password-container">
                <Link to="/forgot-password" className="forgot-password">Forgot password?</Link>
              </div>
            </div>

            {error && <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 500, marginTop: '0.25rem' }}>{error}</p>}

            <button type="submit" className="primary-btn">
              Sign in <span className="arrow">→</span>
            </button>
          </form>

          <div className="divider">
            <span>or</span>
          </div>

          <button type="button" className="google-btn" onClick={signInWithGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
