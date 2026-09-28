import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

// Helper to map mock outlet IDs to names without changing backend
const getOutletName = (id) => {
  const map = {
    'outlet-1': 'The Commons',
    'outlet-2': 'Brew & Bites',
    'mock-outlet-adil': 'Adilreyaz Outlet'
  };
  return map[id] || 'Nosh Outlet';
};

const OutletMobileHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const outletName = getOutletName(user?.outletId);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <header className="outlet-mobile-header mobile-only">
      <div className="mobile-header-left">
        <div className="nosh-logo">
          <img src="/logo.png" alt="Nosh" style={{ height: '36px' }} />
        </div>
      </div>
      <div className="mobile-header-right">
        <button 
          className="header-profile-btn" 
          onClick={() => navigate('/outlet/profile')}
          aria-label="Go to profile"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="header-avatar-img" />
          ) : (
            <div className="header-avatar-initials">
              {getInitials(user?.name || outletName)}
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

export default OutletMobileHeader;
