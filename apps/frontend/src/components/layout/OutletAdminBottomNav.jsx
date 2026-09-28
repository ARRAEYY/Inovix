import React from 'react';
import { NavLink } from 'react-router-dom';

const OutletAdminBottomNav = () => {
  return (
    <nav className="outlet-bottom-nav mobile-only" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
      <NavLink 
        to="/outlet/admin" 
        end
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span className="nav-label" style={{ fontSize: '0.7rem' }}>Dashboard</span>
      </NavLink>

      <NavLink 
        to="/outlet/admin/orders" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"></polyline>
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
        </svg>
        <span className="nav-label" style={{ fontSize: '0.7rem' }}>Orders</span>
      </NavLink>

      <NavLink 
        to="/outlet/admin/menu" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
        <span className="nav-label" style={{ fontSize: '0.7rem' }}>Menu</span>
      </NavLink>

      <NavLink 
        to="/outlet/admin/staff" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
        <span className="nav-label" style={{ fontSize: '0.7rem' }}>Staff</span>
      </NavLink>
    </nav>
  );
};

export default OutletAdminBottomNav;
