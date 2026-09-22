import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import client from '../../services/api/client';

const StudentLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/student');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    }
  };

  // Decode JWT payload helper
  const decodeJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  };

  const handleGoogleCredentialResponse = async (response) => {
    setError('');
    setIsGoogleLoading(true);

    try {
      const credential = response?.credential;
      if (!credential) {
        throw new Error('No Google credential returned');
      }

      const payload = decodeJwt(credential);
      const googleName = payload?.name || '';
      const googleEmail = payload?.email || '';

      // Verify with backend
      try {
        const backendRes = await client.post('/auth/google', { credential });
        if (backendRes.data?.success && backendRes.data?.data) {
          const { user, accessToken } = backendRes.data.data;
          if (!backendRes.data.message?.includes('registration') && user?.onboardingCompleted !== false) {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('user', JSON.stringify(user));
            navigate('/student');
            return;
          }
        }
      } catch (backendErr) {
        // Fallback to signup with prefilled details
      }

      navigate('/signup', {
        state: {
          fullName: googleName,
          email: googleEmail,
          isGoogleAuth: true,
        },
      });
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  useEffect(() => {
    const googleClientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const initializeGoogleGsi = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleGoogleCredentialResponse,
        });
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogleGsi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogleGsi;
      document.body.appendChild(script);
    }
  }, []);

  const handleGoogleButtonClick = () => {
    setError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      const googleClientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID;
      if (googleClientId) {
        window.google?.accounts?.id?.prompt();
      } else {
        navigate('/signup', {
          state: {
            isGoogleAuth: true,
          },
        });
      }
    }
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="brand">
          <Link to="/" className="brand-link">
            <span className="brand-name">nosh</span>
          </Link>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">
            Good food.
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

          <button 
            type="button" 
            className="google-btn"
            onClick={handleGoogleButtonClick}
            disabled={isGoogleLoading}
          >
            {isGoogleLoading ? (
              <span className="btn-loading-content">
                <span className="btn-spinner" style={{ borderColor: 'rgba(0,0,0,0.15)', borderTopColor: 'var(--text-dark)' }} />
                Connecting to Google...
              </span>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentLogin;
