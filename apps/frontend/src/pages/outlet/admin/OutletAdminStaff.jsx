import React, { useState, useEffect } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import { getStaff, createStaff, updateStaffStatus } from '../../../services/outletAdminService';

const AddStaffModal = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onAdd(formData);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add staff');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Add Staff Member</h2>
        {error && <div className="error-message" style={{ marginBottom: '16px' }}>{error}</div>}
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Full Name</label>
            <input 
              type="text" 
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Email</label>
            <input 
              type="email" 
              required
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Phone Number (Optional)</label>
            <input 
              type="tel" 
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              value={formData.phone}
              onChange={e => setFormData({...formData, phone: e.target.value})}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: '500' }}>Password</label>
            <input 
              type="password" 
              required
              minLength="6"
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'white', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={loading} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: '500' }}>
              {loading ? 'Adding...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OutletAdminStaff = () => {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchStaff = async () => {
    try {
      const data = await getStaff();
      setStaff(data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleAddStaff = async (staffData) => {
    await createStaff(staffData);
    fetchStaff(); // Refresh list
  };

  const handleToggleStatus = async (staffId, currentStatus) => {
    if (currentStatus === 'ACTIVE') {
      const confirm = window.confirm('Deactivate Staff?\n\nThey will no longer be able to access the outlet staff dashboard.');
      if (!confirm) return;
    }
    
    try {
      const newStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
      await updateStaffStatus(staffId, newStatus);
      fetchStaff(); // Refresh list
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    }
  };

  return (
    <OutletAdminLayout>
      <div className="dashboard-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="dashboard-title">Staff Management</h1>
          <p className="dashboard-subtitle">Manage staff members for your outlet.</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddModalOpen(true)}
        >
          + Add Staff
        </button>
      </div>

      {loading ? (
        <p>Loading staff...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : staff.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          No staff members found. Add some to get started!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {staff.map(member => (
            <div key={member.id} style={{
              background: 'white',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              {/* Top Section: Avatar + Info */}
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <img 
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=f4f4f5&color=3f3f46&size=128`} 
                  alt={member.name}
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>{member.name}</h3>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500' }}>Outlet Staff</p>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      background: member.status === 'ACTIVE' ? '#dcfce7' : '#e5e7eb',
                      color: member.status === 'ACTIVE' ? '#16a34a' : '#6b7280',
                      marginTop: '4px'
                    }}>
                      {member.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Details Row */}
              <div style={{ display: 'flex', gap: '20px', color: '#6b7280', fontSize: '0.85rem', fontWeight: '600', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                  <span style={{ textTransform: 'uppercase' }}>{member.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                  <span style={{ textTransform: 'uppercase' }}>{member.phone || 'N/A'}</span>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex' }}>
                <button 
                  onClick={() => handleToggleStatus(member.id, member.status)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: '1px solid',
                    borderColor: member.status === 'ACTIVE' ? '#ef4444' : '#10b981',
                    color: member.status === 'ACTIVE' ? '#ef4444' : '#10b981',
                    cursor: 'pointer',
                    fontWeight: '600',
                    padding: '10px 0',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = member.status === 'ACTIVE' ? '#fef2f2' : '#ecfdf5';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {member.status === 'ACTIVE' ? 'Deactivate Account' : 'Activate Account'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddStaffModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onAdd={handleAddStaff}
      />
    </OutletAdminLayout>
  );
};

export default OutletAdminStaff;
