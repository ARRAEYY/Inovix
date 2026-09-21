import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const Header = ({ cartCount, onCartClick }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
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
    <header className="bg-card/80 backdrop-blur-lg border-b border-border sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-md shadow-primary/30">
            <span className="text-primary-foreground font-extrabold text-sm">n</span>
          </div>
          <span className="font-extrabold text-xl tracking-tight text-foreground">nosh</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Cart */}
          {cartCount !== undefined && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="relative p-2.5 rounded-lg hover:bg-muted text-foreground transition-colors"
              title="Cart"
              onClick={onCartClick}
              aria-label="Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              <AnimatePresence>
                {cartCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[0.65rem] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                  >
                    {cartCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          )}

          {/* Notifications */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="relative p-2.5 rounded-lg hover:bg-muted text-foreground transition-colors"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </motion.button>

          {/* Profile */}
          <div className="relative" ref={dropdownRef}>
            <button
              className={`flex items-center gap-1 p-1 pr-2 rounded-lg hover:bg-muted transition-colors ${dropdownOpen ? 'bg-muted' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-label="Profile menu"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-sm">
                {getInitials(user?.name)}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 origin-top-right"
                >
                  <div className="px-4 py-3 border-b border-border bg-muted/30">
                    <p className="font-semibold text-foreground text-sm truncate">{user?.name || 'Student'}</p>
                    <p className="text-muted-foreground text-xs truncate">{user?.email || ''}</p>
                  </div>
                  <div className="py-1">
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2.5"
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/student/orders');
                      }}
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Your orders
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors flex items-center gap-2.5"
                      onClick={logout}
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
