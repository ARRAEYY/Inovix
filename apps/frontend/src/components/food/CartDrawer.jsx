import React, { useState, useEffect, useMemo } from 'react';

// Slide-over cart / checkout (§10): order summary → items → pickup info →
// total → place order. Kept deliberately short — prepaid via Razorpay, no
// address needed (campus pickup).
const CartDrawer = ({ isOpen, onClose, cart = {}, menuItems = [], outletName, onUpdateQuantity, onOrderNow, placingOrder }) => {
  const [notes, setNotes] = useState('');
  // Must be chosen before the order can be placed ('' = not chosen yet).
  const [orderType, setOrderType] = useState('');

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Resolve cart entries to structured items with guaranteed names and prices.
  // Supports both object entries { id, name, price, quantity } and simple number entries { [id]: qty }.
  const resolvedItems = useMemo(() => {
    return Object.entries(cart || {})
      .map(([itemId, val]) => {
        const qty = typeof val === 'object' && val !== null ? Number(val.quantity) : Number(val);
        if (!qty || qty <= 0) return null;

        // Try to match against menuItems (string-safe)
        const menuItem = (menuItems || []).find(
          (i) => String(i.id) === String(itemId) || String(i._id) === String(itemId)
        );

        const name = menuItem?.name || (typeof val === 'object' && val.name ? val.name : null);
        const price = menuItem ? Number(menuItem.price) : (typeof val === 'object' && val.price != null ? Number(val.price) : null);
        const image = menuItem?.imageUrl || menuItem?.image || (typeof val === 'object' ? val.image : null);

        // If the item cannot be resolved and has no name/price (e.g. stale key from an old database),
        // we omit it so it doesn't show as a ghost zero-price item.
        if (!name && price === null) return null;

        return {
          id: itemId,
          name: name || 'Item',
          price: price || 0,
          quantity: qty,
          image,
        };
      })
      .filter(Boolean);
  }, [cart, menuItems]);

  const subtotal = resolvedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const platformFee = resolvedItems.length > 0 ? 5 : 0;
  const total = subtotal + platformFee;

  if (!isOpen) return null;

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
          {resolvedItems.length === 0 ? (
            <div className="cart-empty-state">
              {/* Friendly empty-cart illustration — Nosh brand tints */}
              <svg className="cart-empty-illustration" viewBox="0 0 220 180" role="img" aria-label="An empty bowl illustration">
                <circle cx="110" cy="86" r="80" fill="rgba(177, 0, 53, 0.045)" />
                <circle cx="110" cy="86" r="54" fill="rgba(177, 0, 53, 0.06)" />
                <g stroke="rgba(177, 0, 53, 0.4)" strokeWidth="2" strokeLinecap="round">
                  <line x1="40" y1="46" x2="47" y2="53" /><line x1="47" y1="46" x2="40" y2="53" />
                  <line x1="176" y1="34" x2="183" y2="41" /><line x1="183" y1="34" x2="176" y2="41" />
                  <line x1="196" y1="96" x2="203" y2="103" /><line x1="203" y1="96" x2="196" y2="103" />
                </g>
                <circle cx="58" cy="120" r="4" fill="none" stroke="rgba(177, 0, 53, 0.35)" strokeWidth="2" />
                <circle cx="168" cy="128" r="4" fill="none" stroke="rgba(177, 0, 53, 0.35)" strokeWidth="2" />
                <g stroke="rgba(177, 0, 53, 0.3)" strokeWidth="2" strokeLinecap="round">
                  <line x1="66" y1="148" x2="71" y2="153" /><line x1="71" y1="148" x2="66" y2="153" />
                  <line x1="148" y1="156" x2="153" y2="161" /><line x1="153" y1="156" x2="148" y2="161" />
                </g>
                <g stroke="#12151c" strokeWidth="3.5" strokeLinecap="round">
                  <line x1="110" y1="34" x2="110" y2="48" />
                  <line x1="88" y1="38" x2="94" y2="51" />
                  <line x1="132" y1="38" x2="126" y2="51" />
                </g>
                <path d="M128 62 q16 -14 34 -10" fill="none" stroke="rgba(177, 0, 53, 0.55)" strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" />
                <path d="M48 92 h124 a62 58 0 0 1 -124 0 z" fill="#F6CFDA" stroke="#12151c" strokeWidth="4" strokeLinejoin="round" />
                <rect x="94" y="146" width="32" height="9" rx="3" fill="#F6CFDA" stroke="#12151c" strokeWidth="3.5" />
                <circle cx="92" cy="112" r="4" fill="#12151c" />
                <circle cx="128" cy="112" r="4" fill="#12151c" />
                <path d="M103 122 q7 5 14 0" fill="none" stroke="#12151c" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="78" cy="120" r="3.5" fill="rgba(177, 0, 53, 0.35)" />
                <circle cx="142" cy="120" r="3.5" fill="rgba(177, 0, 53, 0.35)" />
              </svg>
              <p className="cart-empty-title">Your cart is empty</p>
              <p className="cart-empty-sub">Looks like you haven't added anything to your cart yet</p>
            </div>
          ) : (
            <>
              <div className="cart-items-list">
                {resolvedItems.map((item) => (
                  <div key={item.id} className="cart-item-card">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">₹{item.price} × {item.quantity}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <span className="cart-item-line-total">₹{item.price * item.quantity}</span>
                      <div className="cart-item-qty">
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity - 1, item)} aria-label={`Remove one ${item.name}`}>−</button>
                        <span aria-live="polite">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1, item)} aria-label={`Add one ${item.name}`}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Order notes — last of the order list */}
                <div className="cart-notes-block">
                  <label className="cart-drawer-field-label" htmlFor="cart-notes">Order notes</label>
                  <input
                    id="cart-notes"
                    type="text"
                    className="cart-drawer-input"
                    placeholder="e.g., less spicy, no onions"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ marginBottom: 0 }}
                  />
                </div>
              </div>
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
                  Takeaway
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={orderType === 'DINE_IN'}
                  className={`order-type-option ${orderType === 'DINE_IN' ? 'selected' : ''}`}
                  onClick={() => setOrderType('DINE_IN')}
                >
                  Dine in
                </button>
              </div>
              {orderType === '' && (
                <p className="order-type-required">Please choose how you'll get your order.</p>
              )}
            </>
          )}
        </div>
        {resolvedItems.length > 0 && (
          <div className="cart-drawer-footer">
            <button
              className="checkout-btn order-now-btn"
              disabled={placingOrder || orderType === '' || subtotal <= 0}
              onClick={() => onOrderNow({
                notes: notes.trim() || undefined,
                orderType,
              })}
            >
              {orderType === ''
                ? 'Select order type'
                : placingOrder ? 'Placing…' : `Order now — ₹${total}`}
            </button>
            <p className="checkout-note">Prepaid · secured by Razorpay</p>
          </div>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
