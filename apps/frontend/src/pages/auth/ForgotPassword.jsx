import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  const navigate = useNavigate();

  // Countdown timer for resend email
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => {
        setResendCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const validateEmail = (val) => {
    if (!val.trim()) {
      return 'College email is required';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      return 'Please enter a valid email address';
    }
    return '';
  };

  const handleSendEmail = async (e) => {
    if (e) e.preventDefault();
    setGeneralError('');

    const validationErr = validateEmail(email);
    if (validationErr) {
      setEmailError(validationErr);
      return;
    }

    setEmailError('');
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email);
      setIsEmailSent(true);
      setResendCountdown(30); // 30s countdown before allowing next resend
    } catch (err) {
      setGeneralError(err.message || 'Unable to send temporary password. Please verify your email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = () => {
    if (resendCountdown > 0 || isSubmitting) return;
    handleSendEmail();
  };

  return (
    <div className="login-container">
      {/* Left Column / Static Hero */}
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

      {/* Right Column / Forgot Password Card */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="card-title">Forgot password</h2>

          {generalError && (
            <div className="form-alert error-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{generalError}</span>
            </div>
          )}

          {isEmailSent && (
            <div className="form-alert success-alert" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>
                Temporary password sent to your registered email. Check your inbox and return to sign in.
              </span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSendEmail} noValidate>
            <div className={`input-group ${emailError ? 'has-error' : ''}`}>
              <label htmlFor="email">College email</label>
              <input
                type="email"
                id="email"
                placeholder="you@campus.edu"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError('');
                  if (generalError) setGeneralError('');
                }}
                disabled={isSubmitting || (isEmailSent && resendCountdown > 0)}
                required
              />
              {emailError && <span className="field-error">{emailError}</span>}
            </div>

            {/* Send / Email Sent Button */}
            {isEmailSent ? (
              <button
                type="button"
                className="primary-btn btn-sent"
                disabled
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Email sent
              </button>
            ) : (
              <button
                type="submit"
                className="primary-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" />
                    Sending email...
                  </span>
                ) : (
                  <>
                    Send email <span className="arrow">→</span>
                  </>
                )}
              </button>
            )}

            {/* Resend Email Section */}
            {isEmailSent && (
              <div className="resend-container">
                <span className="resend-text">Didn’t receive the email?</span>
                <button
                  type="button"
                  className="resend-btn"
                  onClick={handleResend}
                  disabled={resendCountdown > 0 || isSubmitting}
                >
                  {resendCountdown > 0 ? `Resend email in ${resendCountdown}s` : 'Resend email'}
                </button>
              </div>
            )}
          </form>

          {/* Back to Login Link */}
          <div className="auth-footer" style={{ marginTop: '1.75rem' }}>
            <Link to="/" className="auth-switch-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="arrow">←</span> Return to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
