import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const OutletMobileHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Outlet name comes straight from the auth payload (GET /auth/me returns
  // user.outlet). No client-side ID → name mapping — the JWT is the source
  // of truth, same as OutletSidebar.jsx.
  const outletName = user?.outlet?.name || 'Nosh Outlet';

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
