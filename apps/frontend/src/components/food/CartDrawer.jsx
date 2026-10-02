import React, { useState, useEffect } from 'react';

const CartDrawer = ({ isOpen, onClose, cart, menuItems, outletName, onUpdateQuantity, onOrderNow, placingOrder }) => {
  const [notes, setNotes] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const cartEntries = Object.entries(cart).filter(([id, qty]) => qty > 0);
  const subtotal = cartEntries.reduce((total, [itemId, qty]) => {
    const item = menuItems.find(i => i.id === itemId);
    return total + (item ? item.price * qty : 0);
  }, 0);
  const platformFee = cartEntries.length > 0 ? 5 : 0;
  const total = subtotal + platformFee;
  if (!isOpen) return null;

  // Min datetime for the picker: now; max: 6 hours forward
  const now = new Date();
  const maxTime = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const minStr = now.toISOString().slice(0, 16);
  const maxStr = maxTime.toISOString().slice(0, 16);

  return (
    <>
      <div className="cart-drawer-overlay" onClick={onClose}></div>
      <div className={`cart-drawer ${isOpen ? 'open' : ''}`}>
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-group">
            <h2 className="cart-drawer-title">Your cart</h2>
            <p className="cart-drawer-subtitle">From {outletName}</p>
          </div>
          <button className="cart-close-btn" onClick={onClose} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="cart-drawer-body">
          {cartEntries.length === 0 ? (
            <div className="cart-empty-state"><p>Your cart is empty.</p></div>
          ) : (
            <div className="cart-items-list">
              {cartEntries.map(([itemId, qty]) => {
                const item = menuItems.find(i => i.id === itemId);
                if (!item) return null;
                return (
                  <div key={itemId} className="cart-item-card">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">₹{item.price}</span>
                    </div>
                    <div className="cart-item-qty">
                      <button onClick={() => onUpdateQuantity(itemId, qty - 1)}>−</button>
                      <span>{qty}</span>
                      <button onClick={() => onUpdateQuantity(itemId, qty + 1)}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {cartEntries.length > 0 && (
          <div className="cart-drawer-footer">
            {/* Order notes */}
            <input type="text" placeholder="Order notes (e.g., less spicy, no onions)" value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '0.5rem' }} />
            {/* Scheduling (optional pickup time — within 6 hours) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Pickup time:</label>
              <input type="datetime-local" value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                min={minStr} max={maxStr}
                style={{ padding: '0.4rem', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '0.8rem', flex: 1, minWidth: 0 }} />
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>(optional, within 6h)</span>
            </div>
            <div className="cart-drawer-summary">
              <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
              <div className="summary-row"><span>Platform fee</span><span>₹{platformFee}</span></div>
              <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
            </div>
            <button className="checkout-btn" disabled={placingOrder}
              onClick={() => onOrderNow({ notes: notes.trim() || undefined, scheduledFor: scheduledTime ? new Date(scheduledTime).toISOString() : undefined })}>
              {placingOrder ? 'Placing order…' : `Place order · ₹${total}`}
            </button>
            <p className="checkout-note">Prepaid · Razorpay secured payment</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
