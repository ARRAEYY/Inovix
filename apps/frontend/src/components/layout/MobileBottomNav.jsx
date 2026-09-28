import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const MobileBottomNav = ({ onCartClick, cartItemCount }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
      path: '/student',
      action: () => navigate('/student')
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
      path: '/student/orders',
      action: () => navigate('/student/orders')
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      ),
      path: location.pathname,
      action: () => window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      path: '/student/profile',
      action: () => navigate('/student/profile')
    }
  ];

  const isMenuPage = location.pathname.includes('/outlet/');
  const visibleNavItems = navItems.filter(item => {
    if (item.id === 'menu') return isMenuPage;
    return true;
  });

  return (
    <nav className="mobile-bottom-nav">
      {visibleNavItems.map(item => {
        const isActive = item.id === 'menu' 
          ? isMenuPage 
          : (location.pathname === item.path || (item.path !== '/student' && item.path && location.pathname.startsWith(item.path + '/')));

        
        return (
          <button 
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={item.action}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
