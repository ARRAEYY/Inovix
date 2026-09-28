import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const OutletAdminMobileHeader = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <>
      <header className="outlet-mobile-header mobile-only">
        <div className="nosh-logo">
          <img src="/logo.png" alt="Nosh" style={{ height: '36px' }} />
        </div>
        <button className="menu-btn" onClick={() => setDrawerOpen(true)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </header>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="drawer-overlay mobile-only" onClick={() => setDrawerOpen(false)}></div>
      )}

      {/* Mobile Drawer */}
      <div className={`outlet-drawer mobile-only ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="nosh-logo">
            <img src="/logo.png" alt="Nosh" style={{ height: '36px' }} />
          </div>
          <button className="close-btn" onClick={() => setDrawerOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="drawer-nav">
          <NavLink 
            to="/outlet/admin" 
            end
            className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            Dashboard
          </NavLink>
          <NavLink 
            to="/outlet/admin/orders" 
            className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            Orders
          </NavLink>
          <NavLink 
            to="/outlet/admin/menu" 
            className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            Menu
          </NavLink>
          <NavLink 
            to="/outlet/admin/staff" 
            className={({ isActive }) => `drawer-link ${isActive ? 'active' : ''}`}
            onClick={() => setDrawerOpen(false)}
          >
            Staff
          </NavLink>
        </nav>

        <div className="drawer-footer">
          <button className="logout-btn" onClick={() => {
            setDrawerOpen(false);
            logout();
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '8px'}}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default OutletAdminMobileHeader;
