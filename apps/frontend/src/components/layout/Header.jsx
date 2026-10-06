import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import NotificationsDropdown from '../notifications/NotificationsDropdown';
import BackButton from '../common/BackButton';

const Header = ({ cartCount, onCartClick, title, subtitle, showBack = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="main-header">
      <div className="header-container">
        <div className="brand">
          {showBack && (
            <BackButton
              className="mobile-only"
              style={{ marginRight: '1rem' }}
            />
          )}
          {/* Logo is constant across every page — clicking it goes home. */}
          <img
            src="/logo.png"
            alt="Nosh"
            onClick={() => navigate('/student')}
            style={{ height: '36px', cursor: 'pointer' }}
          />
          {title && (
            <div className="header-titles" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.15rem', marginLeft: '0.75rem' }}>
              <span className="brand-name dynamic-title" style={{ fontSize: '1.3rem', lineHeight: '1.2', fontWeight: 800 }}>{title}</span>
              {subtitle && <span className="header-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {subtitle}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 10l5 5 5-5z"></path>
                </svg>
              </span>}
            </div>
          )}
        </div>

        <div className="header-right">
          {/* Notifications bell + dropdown — students only (gated inside) */}
          <NotificationsDropdown />
          {cartCount !== undefined && (
            <button className="icon-btn" style={{ position: 'relative' }} title="Cart" onClick={onCartClick}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              {cartCount > 0 && (
                <span className="cart-badge" style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-7px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontSize: '0.62rem',
                  fontWeight: 'bold',
                  minWidth: '17px',
                  height: '17px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fff',
                  padding: '0 2px'
                }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}


          <div className="profile-wrapper desktop-only" ref={dropdownRef}>
            <button
              className={`profile-btn ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <div className="profile-avatar">
                {getInitials(user?.name)}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', color: 'var(--text-light)' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {dropdownOpen && (
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <p className="dropdown-name">{user?.name || 'Student'}</p>
                  <p className="dropdown-email">{user?.email || 'student@campus.edu'}</p>
                </div>

                <div className="dropdown-divider"></div>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/student/profile?view=account');
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Account
                </button>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/student/profile?view=settings');
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  Settings
                </button>

                <div className="dropdown-divider"></div>

                <button
                  className="dropdown-item"
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/student/orders');
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  Your orders
                </button>

                <button className="dropdown-item" onClick={logout}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
