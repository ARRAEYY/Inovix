import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Total items across every outlet cart in localStorage (carts are keyed
// per outlet: nosh:cart:<outletId>).
const readCartTotals = () => {
  try {
    const carts = [];
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('nosh:cart:')) continue;
      const parsed = JSON.parse(localStorage.getItem(key) || '{}');
      const count = Object.values(parsed).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
      if (count > 0) {
        carts.push({ outletId: key.replace('nosh:cart:', ''), count });
        total += count;
      }
    }
    return { total, carts };
  } catch {
    return { total: 0, carts: [] };
  }
};

// Student bottom navigation (§13): Home | Orders | Cart | Profile.
// The Cart tab aggregates every outlet cart, shows a badge, and jumps to
// the outlet menu with the drawer open.
const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [cartInfo, setCartInfo] = useState(readCartTotals);

  // Keep the cart badge fresh: our own cart writes dispatch
  // 'nosh:cart-changed'; other tabs fire the native 'storage' event.
  useEffect(() => {
    const refresh = () => setCartInfo(readCartTotals());
    window.addEventListener('nosh:cart-changed', refresh);
    window.addEventListener('storage', refresh);
    // Also re-read when navigating between pages (cart may have been
    // placed or cleared on another screen).
    refresh();
    return () => {
      window.removeEventListener('nosh:cart-changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [location.pathname]);

  const openCart = useCallback(() => {
    if (cartInfo.total === 0) {
      navigate('/student');
      toast('Your cart is empty — explore outlets to add items');
      return;
    }
    // Jump to the outlet whose cart is active; OutletMenu listens for
    // 'nosh:open-cart' and opens the drawer on arrival.
    navigate(`/student/outlet/${cartInfo.carts[0].outletId}`);
    setTimeout(() => window.dispatchEvent(new CustomEvent('nosh:open-cart')), 350);
  }, [cartInfo, navigate]);

  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      ),
      path: '/student',
      action: () => navigate('/student'),
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      ),
      path: '/student/orders',
      action: () => navigate('/student/orders'),
    },
    {
      id: 'cart',
      label: 'Cart',
      badge: cartInfo.total || null,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      ),
      action: openCart,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      ),
      path: '/student/profile',
      action: () => navigate('/student/profile'),
    },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      {navItems.map(item => {
        const isActive = item.path
          && (location.pathname === item.path
            || (item.path !== '/student' && location.pathname.startsWith(item.path + '/')));

        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={item.action}
            aria-label={item.badge ? `${item.label} (${item.badge} items)` : item.label}
          >
            <span className="bottom-nav-icon">
              {item.icon}
              {item.badge && <span className="bottom-nav-badge">{item.badge}</span>}
            </span>
            <span className="bottom-nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
