import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { notificationService } from '../../services/api/notificationService';
import BackButton from '../common/BackButton';

const Header = ({ cartCount, onCartClick, title, subtitle, showBack = false }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Fetch unread notification count — shown as a badge on the bell icon.
  // Only for students (outlet staff get notifications via the outlet
  // dashboard, not the Header).
  useEffect(() => {
    if (!user || user.role !== 'STUDENT') return;
    let active = true;
    const fetchUnread = async () => {
      try {
        const res = await notificationService.list({ unread: true, pageSize: 1 });
        if (active) setUnreadCount(res.data?.unreadCount ?? res.data?.total ?? 0);
      } catch { /* badge is decorative — ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000); // refresh every 30s
    return () => { active = false; clearInterval(interval); };
  }, [user]);

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
          {title ? (
            <>
              <div className="header-titles mobile-only" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', gap: '0.15rem' }}>
                <span className="brand-name dynamic-title" style={{ fontSize: '1.3rem', lineHeight: '1.2', fontWeight: 800 }}>{title}</span>
                {subtitle && <span className="header-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-gray)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {subtitle}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z"></path>
                  </svg>
                </span>}
              </div>
              <img src="/logo.png" alt="Nosh" className="desktop-only" style={{ height: '44px' }} />
            </>
          ) : (
            <img src="/logo.png" alt="Nosh" style={{ height: '36px' }} />
          )}
        </div>

        <div className="header-right">
          {/* Notifications bell — students only */}
          {user?.role === 'STUDENT' && (
            <button
              onClick={() => navigate('/student/profile?view=notifications')}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
              aria-label="Notifications"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 2, right: 2,
                  background: '#b10035', color: 'white',
                  borderRadius: '999px', fontSize: '0.65rem',
                  fontWeight: 700, minWidth: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}
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
                  top: '-5px',
                  right: '-5px',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
