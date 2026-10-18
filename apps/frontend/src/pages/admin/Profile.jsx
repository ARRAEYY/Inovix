import React, { useState } from 'react';
import AdminLayout from '../../components/layout/AdminLayout';
import { useAuth } from '../../hooks/useAuth';
import client from '../../services/api/client';
import { toast } from 'react-hot-toast';

const Profile = () => {
  const { user, logout, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.name || '');
  const [emailDraft, setEmailDraft] = useState(user?.email || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [status, setStatus] = useState(null); // { ok: boolean, text: string }

  const handleSave = async () => {
    const name = nameDraft.trim();
    if (!name) {
      setStatus({ ok: false, text: 'Name cannot be empty' });
      toast.error('Name cannot be empty');
      return;
    }
    try {
      setSaving(true);
      setStatus(null);
      const updated = await updateProfile({ name });
      if (updated) {
        setStatus({ ok: true, text: 'Profile updated successfully' });
        toast.success('Profile updated successfully');
      } else {
        setStatus({ ok: false, text: 'Could not update profile' });
        toast.error('Could not update profile');
      }
    } catch (err) {
      setStatus({ ok: false, text: err.message || 'Could not update profile' });
      toast.error(err.message || 'Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toast.error('Please enter both current and new password');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    try {
      setChangingPassword(true);
      await client.patch('/auth/me/password', { oldPassword, newPassword });
      setOldPassword('');
      setNewPassword('');
      toast.success('Password changed successfully');
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm('Are you sure you want to discard your changes?')) {
      setNameDraft(user?.name || '');
      setEmailDraft(user?.email || '');
      setStatus(null);
    }
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '40px' }}>
        
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '1.75rem', fontWeight: '800', color: '#111827', letterSpacing: '-0.5px' }}>
            Admin Profile
          </h1>
          <p style={{ margin: 0, color: '#4b5563', fontSize: '0.95rem' }}>
            Manage your Super Admin credentials and account settings.
          </p>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px' }}>
            <div style={{ 
              width: '76px', height: '76px', borderRadius: '50%', background: '#b10035', color: 'white', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: '800' 
            }}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem', fontWeight: '800', color: '#111827' }}>
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
                  Active Super Admin
                </span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '28px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Role</span>
              <span style={{ color: '#b10035', fontWeight: '700' }}>Super Admin (Platform Owner)</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Full Name</span>
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'center' }}>
              <span style={{ fontWeight: '600', color: '#374151' }}>Email Address</span>
              <input
                type="email"
                value={emailDraft}
                disabled
                style={{ ...inputStyle, background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
              />
            </div>

            <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '20px', display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: '600', color: '#374151', paddingTop: '8px' }}>Security</span>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="password"
                  placeholder="Current password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{ width: '160px', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
                />
                <input
                  type="password"
                  placeholder="New password (8+)"
                  minLength="8"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ width: '160px', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
                />
                <button
                  type="submit"
                  disabled={changingPassword}
                  style={{ padding: '9px 18px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', opacity: changingPassword ? 0.7 : 1 }}
                >
                  {changingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>

          {status && (
            <div style={{
              marginTop: '16px',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
              fontWeight: 600,
              background: status.ok ? '#ecfdf5' : '#fef2f2',
              color: status.ok ? '#10b981' : '#b10035',
              border: `1px solid ${status.ok ? '#a7f3d0' : '#fecaca'}`,
            }}>
              {status.text}
            </div>
          )}

          <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '32px', paddingTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={handleDiscard} disabled={saving} style={{ padding: '10px 20px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
              Discard Changes
            </button>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 22px', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '600', opacity: saving ? 0.7 : 1 }}>
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
  padding: '10px 14px',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  fontSize: '0.95rem'
};

export default Profile;
