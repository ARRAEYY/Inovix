import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../../services/api/client';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      await client.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#faf5f6', padding: '1rem' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', maxWidth: '400px', width: '100%', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>Forgot Password</h1>
        {sent ? (
          <div>
            <p style={{ color: '#374151', fontSize: '0.95rem', lineHeight: 1.5 }}>
              If an account exists for <strong>{email}</strong>, a 6-digit reset code has been sent to that email.
            </p>
            <button onClick={() => navigate(`/reset-password?email=${encodeURIComponent(email)}`)}
              className="primary-btn" style={{ width: '100%', marginTop: '1.5rem' }}>
              Enter Reset Code →
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
              Enter your email and we'll send you a 6-digit code to reset your password.
            </p>
            {error && <div style={{ color: '#b10035', fontSize: '0.85rem' }}>{error}</div>}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="you@rishihood.edu.in"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
            <button type="submit" disabled={loading} className="primary-btn" style={{ width: '100%' }}>
              {loading ? 'Sending…' : 'Send Reset Code'}
            </button>
            <Link to="/" style={{ textAlign: 'center', color: '#b10035', fontSize: '0.85rem', textDecoration: 'none' }}>
              ← Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
