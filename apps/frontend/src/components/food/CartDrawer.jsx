import React, { useEffect, useState } from 'react';

const CartDrawer = ({ isOpen, onClose, cart, menuItems = [], outletName, onUpdateQuantity }) => {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const cartEntries = Object.entries(cart || {}).filter(([id, qty]) => qty > 0);
  
  const subtotal = cartEntries.reduce((total, [itemId, qty]) => {
    const item = menuItems.find(i => i.id === itemId);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const platformFee = cartEntries.length > 0 ? 5 : 0;
  const total = subtotal + platformFee;

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="cart-drawer-overlay" onClick={onClose}></div>
      
      {/* Drawer */}
      <div className={`cart-drawer ${isOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-group">
            <h2 className="cart-drawer-title">Your cart</h2>
            <p className="cart-drawer-subtitle">From {outletName}</p>
          </div>
          <button className="cart-close-btn" onClick={onClose} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="cart-drawer-body">
          {cartEntries.length === 0 ? (
            <div className="cart-empty-state">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {cartEntries.map(([itemId, qty]) => {
                const item = menuItems.find(i => i.id === itemId);
                if (!item) return null;
                return (
                  <div key={itemId} className="cart-item-card">
                    <div className="cart-item-info">
                      <h4 className="cart-item-name">{item.name}</h4>
                      <span className="cart-item-price">₹{item.price * qty}</span>
                    </div>
                    <div className="cart-item-actions">
                      <div className="quantity-selector">
                        <button className="qty-btn" onClick={() => onUpdateQuantity(itemId, qty - 1)}>−</button>
                        <span className="qty-value">{qty}</span>
                        <button className="qty-btn" onClick={() => onUpdateQuantity(itemId, qty + 1)}>+</button>
                      </div>
                      <button className="cart-item-delete" onClick={() => onUpdateQuantity(itemId, 0)} title="Remove item">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cart-drawer-footer">
          <div className="cart-summary-line">
            <span className="summary-label">Subtotal</span>
            <span className="summary-value">₹{subtotal}</span>
          </div>
          <div className="cart-summary-line">
            <span className="summary-label">Platform fee</span>
            <span className="summary-value">₹{platformFee}</span>
          </div>
          <div className="cart-summary-total">
            <span className="total-label">Total</span>
            <span className="total-value">₹{total}</span>
          </div>

          <CartFooterActions cartEntries={cartEntries} total={total} />

          <p className="checkout-note">Pickup only · no delivery fee</p>
        </div>
      </div>
    </>
  );
};

/* ─── Schedule / Order flow (inline, no extra page) ──────────── */
const CartFooterActions = ({ cartEntries, total }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedTime, setSelectedTime] = useState('');

  const isDisabled = cartEntries.length === 0;

  /** Time slots every 15 min from (now + 30 min) → 22:00 IST */
  const getTimeSlots = () => {
    const slots = [];
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + 330 * 60000); // IST = UTC+5:30

    const start = new Date(ist);
    start.setMinutes(Math.ceil((start.getMinutes() + 30) / 15) * 15, 0, 0);

    const end = new Date(ist);
    end.setHours(22, 0, 0, 0);

    const cursor = new Date(start);
    while (cursor <= end) {
      const h = cursor.getHours();
      const m = cursor.getMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      const label = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      slots.push({ value: `${h}:${m.toString().padStart(2, '0')}`, label });
      cursor.setMinutes(cursor.getMinutes() + 15);
    }
    return slots;
  };

  const getTodayLabel = () => {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utcMs + 330 * 60000);
    return ist.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const timeSlots = getTimeSlots();

  return (
    <div className="cart-actions-wrapper">
      {/* Schedule card — appears only after clicking Schedule */}
      {isScheduling && (
        <div className="schedule-card">
          <p className="schedule-date-label">
            <span className="schedule-cal-icon"></span> {getTodayLabel()}
          </p>
          <select
            className="schedule-time-select"
            value={selectedTime}
            onChange={e => setSelectedTime(e.target.value)}
          >
            <option value="">Select pickup time…</option>
            {timeSlots.length > 0 ? (
              timeSlots.map(slot => (
                <option key={slot.value} value={slot.label}>{slot.label}</option>
              ))
            ) : (
              <option disabled>No more pickups today</option>
            )}
          </select>
        </div>
      )}

      {/* Buttons: single Schedule Order → when time chosen, else pair */}
      {selectedTime ? (
        <button
          className="checkout-btn schedule-order-btn"
          disabled={isDisabled}
          onClick={() => alert(`Order scheduled for ${selectedTime}! Total ₹${total}`)}
        >
          Schedule Order →
        </button>
      ) : (
        <div className="cart-action-buttons">
          <button
            className="checkout-btn schedule-btn"
            disabled={isDisabled}
            onClick={() => { setIsScheduling(true); setSelectedTime(''); }}
          >
            Schedule
          </button>
          <button
            className="checkout-btn order-now-btn"
            disabled={isDisabled}
            onClick={() => alert(`Order placed! Total ₹${total}`)}
          >
            Order Now <span className="arrow">›</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CartDrawer;
