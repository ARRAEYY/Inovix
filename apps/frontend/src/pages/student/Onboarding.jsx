import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import { useAuth } from '../../hooks/useAuth';
import client from '../../services/api/client';

// Student onboarding — shown after the first Google login (when
// onboardingCompleted === false). The student fills in their profile
// (fullName, phone, course, year, collegeId) + sets a password so they
// can also login with email+password as a fallback.
// Backend: POST /api/v1/onboarding with { password, profile: {...} }
const Onboarding = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    phone: '',
    course: '',
    year: '',
    collegeId: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      setLoading(true);
      const res = await client.post('/onboarding', {
        password: formData.password,
        profile: {
          fullName: formData.fullName,
          phone: formData.phone,
          course: formData.course,
          year: formData.year,
          collegeId: formData.collegeId,
        },
      });
      if (res.data?.success) {
        // Update the stored user so onboardingCompleted is true
        const updatedUser = res.data.data?.user;
        if (updatedUser) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        navigate('/student');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper bg-white">
      <Header title="Complete Your Profile" showBack={false} />
      <main className="explore-container" style={{ maxWidth: '500px' }}>
        <div className="page-header">
          <h1 className="page-title">Welcome to Nosh!</h1>
          <p className="page-subtitle">Complete your profile to start ordering from campus outlets.</p>
        </div>
        {error && <div style={{ color: '#b10035', fontSize: '0.9rem', marginBottom: '1rem' }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Full Name</label>
            <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required
              style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Phone (10 digits)</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required pattern="[0-9]{10}"
              placeholder="9876543210"
              style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Course</label>
              <input type="text" name="course" value={formData.course} onChange={handleChange} required
                placeholder="B.Tech CSE"
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Year</label>
              <input type="text" name="year" value={formData.year} onChange={handleChange} required
                placeholder="2nd Year"
                style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>College ID</label>
            <input type="text" name="collegeId" value={formData.collegeId} onChange={handleChange} required
              placeholder="RHX2024001"
              style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
          </div>
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '0.75rem' }}>
              Set a password so you can also login with your email (optional — you can always use Google).
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Password (8+ chars)</label>
                <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength="8"
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>Confirm Password</label>
                <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength="8"
                  style={{ width: '100%', padding: '0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.95rem' }} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={loading} className="primary-btn" style={{ marginTop: '0.5rem' }}>
            {loading ? 'Saving…' : 'Complete Profile'}
          </button>
          <button type="button" onClick={() => { logout(); navigate('/'); }}
            style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.85rem' }}>
            Logout instead
          </button>
        </form>
      </main>
    </div>
  );
};

export default Onboarding;
