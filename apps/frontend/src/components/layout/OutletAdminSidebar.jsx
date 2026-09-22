import React from 'react';
import { NavLink } from 'react-router-dom';
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

const OutletAdminSidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="outlet-sidebar desktop-only">
      <div className="sidebar-header">
        <div className="nosh-logo">
          <img src="/logo.png" alt="Nosh" style={{ height: '44px' }} />
        </div>
        <div className="sidebar-identity">
          <div className="identity-outlet">{getOutletName(user?.outletId)}</div>
          <div className="identity-role">Admin</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink 
          to="/outlet/admin" 
          end
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          Dashboard
        </NavLink>
        <NavLink 
          to="/outlet/admin/orders" 
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4"></polyline>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          Orders
        </NavLink>
        <NavLink 
          to="/outlet/admin/menu" 
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Menu
        </NavLink>
        <NavLink 
          to="/outlet/admin/staff" 
          className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          Staff
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={logout}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
};

export default OutletAdminSidebar;
