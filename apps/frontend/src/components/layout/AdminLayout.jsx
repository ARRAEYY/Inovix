import React from 'react';
import AdminSidebar from './AdminSidebar';
import { NavLink } from 'react-router-dom';
import '../../styles/outlet-dashboard.css';

const AdminLayout = ({ children }) => {
  return (
    <div className="outlet-layout">
      <AdminSidebar />
      
      <div className="outlet-main-wrapper">
        {/* Mobile Header */}
        <header className="mobile-header mobile-only">
          <div className="mobile-header-content">
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#111827' }}>Nosh</h1>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#b10035', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '700' }}>
              SA
            </div>
          </div>
        </header>

        <main className="outlet-main-content">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="mobile-bottom-nav mobile-only">
        <NavLink to="/admin" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/admin/outlets" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Outlets</span>
        </NavLink>
        <NavLink to="/admin/orders" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>Orders</span>
        </NavLink>
        <NavLink to="/admin/profile" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default AdminLayout;
