import React, { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../hooks/useAuth';

const Profile = () => {
  const { user, logout } = useAuth();
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      alert('Profile updated successfully!');
    }, 1000);
  };

  const handleDiscard = () => {
    if (window.confirm('Are you sure you want to discard your changes?')) {
      alert('Changes discarded');
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
            Profile
          </h1>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
            Manage your Super Admin account.
          </p>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
            <div style={{ 
              width: '80px', height: '80px', borderRadius: '50%', background: '#b10035', color: 'white', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: '800' 
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.5rem', fontWeight: '800', color: '#111827' }}>
                {user?.name || 'Admin User'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#4b5563', fontWeight: '500' }}>{user?.email}</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: '#10b981'
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                  Active
                </span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="profile-form-row">
              <span style={{ fontWeight: '600', color: '#374151' }}>Role</span>
              <span style={{ color: '#111827', fontWeight: '500' }}>Super Admin (Unchangeable)</span>
            </div>
            
            
            <div className="profile-form-row">
              <span style={{ fontWeight: '600', color: '#374151' }}>Full Name</span>
              <input 
                type="text" 
                defaultValue={user?.name || ''} 
                style={inputStyle}
              />
            </div>
            
            
            <div className="profile-form-row">
              <span style={{ fontWeight: '600', color: '#374151' }}>Email Address</span>
              <input 
                type="email" 
                defaultValue={user?.email || ''} 
                style={inputStyle}
              />
            </div>

            <div className="profile-form-row">
              <span style={{ fontWeight: '600', color: '#374151' }}>Change Password</span>
              <button onClick={() => alert('Password reset link sent to your email!')} style={{ justifySelf: 'flex-start', padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                Send Reset Link
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '32px', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={handleDiscard} disabled={saving} style={{ padding: '10px 20px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
              Discard Changes
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
};

// Extracted styles
const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  border: '1px solid #e5e7eb',
  padding: '32px',
  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
};

const inputStyle = {
  width: '100%',
  maxWidth: '400px',
  padding: '10px 16px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem'
};

export default Profile;
