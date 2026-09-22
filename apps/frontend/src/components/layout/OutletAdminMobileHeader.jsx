import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

const OutletAdminMobileHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const initials = user?.name ? user.name.charAt(0).toUpperCase() : 'A';

  return (
    <>
      <header className="outlet-mobile-header mobile-only">
        <div className="nosh-logo">
          <img src="/logo.png" alt="Nosh" style={{ height: '36px' }} />
        </div>
        
        <div style={{ position: 'relative' }}>
          <button 
            className="header-profile-btn" 
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <div className="header-avatar-initials">{initials}</div>
          </button>

          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: '0',
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              padding: '8px',
              minWidth: '150px',
              zIndex: 100
            }}>
              <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', marginBottom: '4px' }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', color: '#111827' }}>{user?.name || 'Admin'}</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Admin</p>
              </div>
              <button 
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '8px', 
                  background: 'none', 
                  border: 'none', 
                  color: '#b10035', 
                  fontWeight: 600, 
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  borderRadius: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Invisible overlay to close dropdown when clicking outside */}
      {menuOpen && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 90 }}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </>
  );
};

export default OutletAdminMobileHeader;
