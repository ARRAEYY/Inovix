import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import OutletLayout from '../../components/layout/OutletLayout';
import EditProfileModal from '../../components/outlet/EditProfileModal';

// Helper to map mock outlet IDs to names without changing backend
const getOutletName = (id) => {
  const map = {
    'outlet-1': 'The Commons',
    'outlet-2': 'Brew & Bites',
    'mock-outlet-adil': 'Adilreyaz Outlet'
  };
  return map[id] || 'Nosh Outlet';
};

const OutletProfile = () => {
  const { user, logout, updateProfile } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const outletName = getOutletName(user?.outletId);

  // Generate initials for avatar placeholder
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleUpdateProfile = async (data) => {
    await updateProfile(data);
    setIsEditModalOpen(false);
  };

  return (
    <OutletLayout>
      <div className="outlet-profile-page">
        <div className="dashboard-header-row profile-header-row">
          <div>
            <h1 className="dashboard-title">Profile</h1>
            <p className="dashboard-subtitle">Manage your staff account and outlet information.</p>
          </div>
          <button className="btn-secondary" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>

        <div className="profile-layout-grid">
          {/* LEFT COLUMN: Profile Card */}
          <div className="profile-card-container">
            <div className="profile-card">
              <div className="profile-avatar-large">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Profile" />
                ) : (
                  <span>{getInitials(user?.name || outletName)}</span>
                )}
              </div>
              
              <h2 className="profile-name">{user?.name || `${outletName} Staff`}</h2>
              <p className="profile-role">Staff</p>
              <p className="profile-outlet-text">{outletName}</p>
              
              <button 
                className="btn-secondary btn-edit-profile"
                onClick={() => setIsEditModalOpen(true)}
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: Info Cards */}
          <div className="profile-info-container">
            <div className="info-card">
              <h3 className="info-card-title">Outlet Information</h3>
              <div className="info-list">
                <div className="info-row">
                  <span className="info-label">Outlet</span>
                  <span className="info-value">{outletName}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Outlet ID</span>
                  <span className="info-value">{user?.outletId || 'N/A'}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Role</span>
                  <span className="info-value">Staff</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Status</span>
                  <span className="info-value status-active">
                    <span className="status-dot"></span> Active
                  </span>
                </div>
              </div>
            </div>

            <div className="info-card">
              <h3 className="info-card-title">Account Information</h3>
              <div className="info-list">
                <div className="info-row">
                  <span className="info-label">Full Name</span>
                  <span className="info-value">{user?.name || `${outletName} Staff`}</span>
                </div>
                {user?.email && (
                  <div className="info-row">
                    <span className="info-label">Email</span>
                    <span className="info-value">{user.email}</span>
                  </div>
                )}
                <div className="info-row">
                  <span className="info-label">Role</span>
                  <span className="info-value">Staff</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Outlet</span>
                  <span className="info-value">{outletName}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <EditProfileModal 
          user={user} 
          onClose={() => setIsEditModalOpen(false)} 
          onSubmit={handleUpdateProfile} 
        />
      )}
    </OutletLayout>
  );
};

export default OutletProfile;
