import React, { useState, useEffect } from 'react';

// Slide-over cart / checkout (§10): order summary → items → pickup info →
// total → place order. Kept deliberately short — prepaid via Razorpay, no
// address needed (campus pickup).
const CartDrawer = ({ isOpen, onClose, cart, menuItems, outletName, onUpdateQuantity, onOrderNow, placingOrder }) => {
  const [notes, setNotes] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  // Must be chosen before the order can be placed ('' = not chosen yet).
  const [orderType, setOrderType] = useState('');

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
      <div className={`cart-drawer ${isOpen ? 'open' : ''}`} role="dialog" aria-label={`Cart from ${outletName}`}>
        <div className="cart-drawer-header">
          <div className="cart-drawer-title-group">
            <h2 className="cart-drawer-title">Your cart</h2>
            <p className="cart-drawer-subtitle">From {outletName}</p>
          </div>
          <button className="cart-close-btn" onClick={onClose} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div className="cart-drawer-body">
          {cartEntries.length === 0 ? (
            <div className="cart-empty-state">
              <div className="cart-empty-icon" aria-hidden="true">🛒</div>
              <p>Your cart is empty.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>Add items from the menu to place an order.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {cartEntries.map(([itemId, qty]) => {
                const item = menuItems.find(i => i.id === itemId);
                if (!item) return null;
                return (
                  <div key={itemId} className="cart-item-card">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">₹{item.price} × {qty}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="cart-item-line-total">₹{item.price * qty}</span>
                      <div className="cart-item-qty">
                        <button onClick={() => onUpdateQuantity(itemId, qty - 1)} aria-label={`Remove one ${item.name}`}>−</button>
                        <span aria-live="polite">{qty}</span>
                        <button onClick={() => onUpdateQuantity(itemId, qty + 1)} aria-label={`Add one ${item.name}`}>+</button>
                      </div>
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
            <label className="cart-drawer-field-label" htmlFor="cart-notes">Order notes</label>
            <input
              id="cart-notes"
              type="text"
              className="cart-drawer-input"
              placeholder="e.g., less spicy, no onions"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {/* Scheduling (optional pickup time — within 6 hours) */}
            <label className="cart-drawer-field-label" htmlFor="cart-pickup-time">Pickup time (optional, within 6h)</label>
            <input
              id="cart-pickup-time"
              type="datetime-local"
              className="cart-drawer-input"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={minStr}
              max={maxStr}
            />
            <div className="cart-drawer-summary">
              <div className="summary-row"><span>Subtotal</span><span>₹{subtotal}</span></div>
              <div className="summary-row"><span>Platform fee</span><span>₹{platformFee}</span></div>
              <div className="summary-row total"><span>Total</span><span>₹{total}</span></div>
            </div>
            {/* Order type — required (§checkout): the CTA stays disabled
                until the student picks how they'll receive the order. */}
            <label className="cart-drawer-field-label">Order type</label>
            <div className="order-type-toggle" role="radiogroup" aria-label="Order type">
              <button
                type="button"
                role="radio"
                aria-checked={orderType === 'TAKEAWAY'}
                className={`order-type-option ${orderType === 'TAKEAWAY' ? 'selected' : ''}`}
                onClick={() => setOrderType('TAKEAWAY')}
              >
                🥡 Takeaway
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={orderType === 'DINE_IN'}
                className={`order-type-option ${orderType === 'DINE_IN' ? 'selected' : ''}`}
                onClick={() => setOrderType('DINE_IN')}
              >
                🍽️ Dine in
              </button>
            </div>
            {orderType === '' && (
              <p className="order-type-required">Please choose how you'll get your order.</p>
            )}
            <button
              className="checkout-btn"
              disabled={placingOrder || orderType === ''}
              onClick={() => onOrderNow({ notes: notes.trim() || undefined, scheduledFor: scheduledTime ? new Date(scheduledTime).toISOString() : undefined, orderType })}
            >
              {orderType === '' ? 'Select order type to continue' : placingOrder ? 'Placing order…' : `Place Order — ₹${total}`}
            </button>
            <p className="checkout-note">Prepaid · secured by Razorpay</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
