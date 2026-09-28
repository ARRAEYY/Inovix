import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import client from '../../services/api/client';
import { toast } from 'react-hot-toast';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: searchParams.get('email') || '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      setLoading(true);
      await client.post('/auth/reset-password', {
        email: formData.email,
        otp: formData.otp,
        newPassword: formData.newPassword,
      });
      toast('Password reset successfully! Please login with your new password.');
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf5f6', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Reset Password</h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
          Enter the 6-digit code sent to your email + your new password.
        </p>
        {error && <div style={{ color: '#b10035', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input type="email" name="email" value={formData.email} onChange={handleChange} required placeholder="Email"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          <input type="text" name="otp" value={formData.otp} onChange={handleChange} required maxLength="6" placeholder="6-digit code"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem', letterSpacing: '0.5rem', textAlign: 'center' }} />
          <input type="password" name="newPassword" value={formData.newPassword} onChange={handleChange} required minLength="8" placeholder="New password (8+ chars)"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength="8" placeholder="Confirm new password"
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          <button type="submit" disabled={loading} className="primary-btn" style={{ width: '100%' }}>
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
          <Link to="/forgot-password" style={{ textAlign: 'center', color: '#b10035', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Didn't get the code? Resend
          </Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
