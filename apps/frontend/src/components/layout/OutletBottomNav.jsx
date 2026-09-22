import React from 'react';
import { NavLink } from 'react-router-dom';

const OutletBottomNav = () => {
  return (
    <nav className="outlet-bottom-nav mobile-only">
      <NavLink 
        to="/outlet" 
        end
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
        <span className="nav-label">Dashboard</span>
      </NavLink>

      <NavLink 
        to="/outlet/menu" 
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
        <span className="nav-label">Menu</span>
      </NavLink>

      <NavLink 
        to="/outlet/profile" 
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
      >
        <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <span className="nav-label">Profile</span>
      </NavLink>
    </nav>
  );
};

export default OutletBottomNav;
