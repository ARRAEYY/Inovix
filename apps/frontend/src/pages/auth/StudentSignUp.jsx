import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const StudentSignUp = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const prefillName = location.state?.fullName || location.state?.name || '';
  const prefillEmail = location.state?.email || '';
  const isGoogleRedirect = !!location.state?.isGoogleAuth || !!location.state?.email;

  const [formData, setFormData] = useState({
    fullName: prefillName,
    email: prefillEmail,
    enrollmentNumber: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (location.state?.fullName || location.state?.email) {
      setFormData((prev) => ({
        ...prev,
        fullName: location.state.fullName || location.state.name || prev.fullName,
        email: location.state.email || prev.email,
      }));
    }
  }, [location.state]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateField = (name, value, allValues = formData) => {
    let error = '';
    switch (name) {
      case 'fullName':
        if (!value.trim()) {
          error = 'Full name is required';
        } else if (value.trim().length < 2) {
          error = 'Full name must be at least 2 characters';
        }
        break;
      case 'email':
        if (!value.trim()) {
          error = 'College email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          error = 'Please enter a valid email address';
        }
        break;
      case 'enrollmentNumber':
        if (!value.trim()) {
          error = 'Enrollment number is required';
        } else if (value.trim().length < 3) {
          error = 'Please enter a valid enrollment number';
        }
        break;
      case 'phoneNumber':
        if (!value.trim()) {
          error = 'Phone number is required';
        } else {
          const digits = value.replace(/\D/g, '');
          if (digits.length < 10) {
            error = 'Please enter a valid 10-digit phone number';
          }
        }
        break;
      case 'password':
        if (!value) {
          error = 'Password is required';
        } else if (value.length < 6) {
          error = 'Password must be at least 6 characters';
        }
        break;
      case 'confirmPassword':
        if (!value) {
          error = 'Please confirm your password';
        } else if (value !== allValues.password) {
          error = 'Passwords do not match';
        }
        break;
      default:
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedForm = { ...formData, [name]: value };
    setFormData(updatedForm);

    if (touched[name]) {
      const fieldError = validateField(name, value, updatedForm);
      setErrors((prev) => ({ ...prev, [name]: fieldError }));
    }

    if (name === 'password' && touched.confirmPassword) {
      const confirmError = validateField('confirmPassword', formData.confirmPassword, updatedForm);
      setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
    }
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const fieldError = validateField(name, value, formData);
    setErrors((prev) => ({ ...prev, [name]: fieldError }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');

    const allTouched = {
      fullName: true,
      email: true,
      enrollmentNumber: true,
      phoneNumber: true,
      password: true,
      confirmPassword: true,
    };
    setTouched(allTouched);

    const validationErrors = {};
    let hasError = false;

    Object.keys(formData).forEach((field) => {
      const error = validateField(field, formData[field], formData);
      if (error) {
        validationErrors[field] = error;
        hasError = true;
      }
    });

    setErrors(validationErrors);

    if (hasError) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Save local user profile
      const existingUsers = JSON.parse(localStorage.getItem('nosh_registered_users') || '[]');
      const filtered = existingUsers.filter((u) => u.email?.toLowerCase() !== formData.email.toLowerCase().trim());
      filtered.push({
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        enrollmentNumber: formData.enrollmentNumber.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
      });
      localStorage.setItem('nosh_registered_users', JSON.stringify(filtered));

      await new Promise((resolve) => setTimeout(resolve, 800));

      setIsSuccess(true);
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      setGeneralError(err.message || 'Registration failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-container signup-container">
      {/* Left Column / Hero */}
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
            Create your account to order from campus outlets, skip lines, and enjoy fresh meals instantly.
          </p>
        </div>
      </div>

      {/* Right Column / Sign Up Card */}
      <div className="login-right signup-right">
        <div className="login-card signup-card">
          <h2 className="card-title">Create account</h2>

          {isGoogleRedirect && (formData.email || prefillEmail) && (
            <div className="form-alert info-alert" role="status">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>
                Google account connected (<strong>{formData.email || prefillEmail}</strong>). Please complete the remaining fields to finish registration.
              </span>
            </div>
          )}

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

          {isSuccess && (
            <div className="form-alert success-alert" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Account created successfully! Redirecting to sign in...</span>
            </div>
          )}

          <form className="login-form signup-form" onSubmit={handleSubmit} noValidate>
            {/* Full Name */}
            <div className={`input-group ${touched.fullName && errors.fullName ? 'has-error' : ''}`}>
              <label htmlFor="fullName">
                Full Name <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  placeholder="e.g. Alex Sharma"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="name"
                  aria-invalid={!!(touched.fullName && errors.fullName)}
                  aria-describedby={touched.fullName && errors.fullName ? 'fullName-error' : undefined}
                  required
                />
              </div>
              {touched.fullName && errors.fullName && (
                <span id="fullName-error" className="field-error">
                  {errors.fullName}
                </span>
              )}
            </div>

            {/* College Email */}
            <div className={`input-group ${touched.email && errors.email ? 'has-error' : ''}`}>
              <label htmlFor="email">
                College Email <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="e.g. alex.s@rishihood.edu.in"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="email"
                  aria-invalid={!!(touched.email && errors.email)}
                  aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
                  required
                />
              </div>
              {touched.email && errors.email && (
                <span id="email-error" className="field-error">
                  {errors.email}
                </span>
              )}
            </div>

            {/* Enrollment Number */}
            <div className={`input-group ${touched.enrollmentNumber && errors.enrollmentNumber ? 'has-error' : ''}`}>
              <label htmlFor="enrollmentNumber">
                Enrollment Number <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="text"
                  id="enrollmentNumber"
                  name="enrollmentNumber"
                  placeholder="e.g. 2024RU102"
                  value={formData.enrollmentNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="off"
                  aria-invalid={!!(touched.enrollmentNumber && errors.enrollmentNumber)}
                  aria-describedby={touched.enrollmentNumber && errors.enrollmentNumber ? 'enrollmentNumber-error' : undefined}
                  required
                />
              </div>
              {touched.enrollmentNumber && errors.enrollmentNumber && (
                <span id="enrollmentNumber-error" className="field-error">
                  {errors.enrollmentNumber}
                </span>
              )}
            </div>

            {/* Phone Number */}
            <div className={`input-group ${touched.phoneNumber && errors.phoneNumber ? 'has-error' : ''}`}>
              <label htmlFor="phoneNumber">
                Phone Number <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper">
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  placeholder="e.g. 9876543210"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="tel"
                  aria-invalid={!!(touched.phoneNumber && errors.phoneNumber)}
                  aria-describedby={touched.phoneNumber && errors.phoneNumber ? 'phoneNumber-error' : undefined}
                  required
                />
              </div>
              {touched.phoneNumber && errors.phoneNumber && (
                <span id="phoneNumber-error" className="field-error">
                  {errors.phoneNumber}
                </span>
              )}
            </div>

            {/* Password */}
            <div className={`input-group ${touched.password && errors.password ? 'has-error' : ''}`}>
              <label htmlFor="password">
                Password <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  aria-invalid={!!(touched.password && errors.password)}
                  aria-describedby={touched.password && errors.password ? 'password-error' : undefined}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {touched.password && errors.password && (
                <span id="password-error" className="field-error">
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm Password */}
            <div className={`input-group ${touched.confirmPassword && errors.confirmPassword ? 'has-error' : ''}`}>
              <label htmlFor="confirmPassword">
                Confirm Password <span className="required-star" aria-hidden="true">*</span>
              </label>
              <div className="input-wrapper password-wrapper">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  autoComplete="new-password"
                  aria-invalid={!!(touched.confirmPassword && errors.confirmPassword)}
                  aria-describedby={touched.confirmPassword && errors.confirmPassword ? 'confirmPassword-error' : undefined}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1 4.24 4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <span id="confirmPassword-error" className="field-error">
                  {errors.confirmPassword}
                </span>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="primary-btn signup-btn"
              disabled={isSubmitting || isSuccess}
            >
              {isSubmitting ? (
                <span className="btn-loading-content">
                  <span className="btn-spinner" />
                  Creating account...
                </span>
              ) : isSuccess ? (
                'Account Created!'
              ) : (
                <>
                  Create Account <span className="arrow">→</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default StudentSignUp;
