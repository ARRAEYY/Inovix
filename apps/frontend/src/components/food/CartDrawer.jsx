import React, { useEffect } from 'react';

/**
 * CartDrawer — accepts a server-side Cart object:
 *   { id, items: [{ id, menuItemId, quantity, menuItem: { name, price, imageUrl } }], expiresAt, ... }
 *
 * Computes totals from cart.items. If cart is null/empty, shows empty state.
 */
const CartDrawer = ({ isOpen, onClose, cart, outletName, onUpdateQuantity, onCheckout, isCheckingOut }) => {
  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const items = (cart?.items ?? []).filter((i) => i.quantity > 0);
  const subtotal = items.reduce((sum, i) => sum + Number(i.menuItem?.price ?? 0) * i.quantity, 0);
  const platformFee = items.length > 0 ? 5 : 0;
  const total = subtotal + platformFee;

  if (!isOpen) return null;

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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--text-gray)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="cart-drawer-body">
          {items.length === 0 ? (
            <div className="cart-empty-state">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="cart-items-list">
              {items.map((ci) => (
                <div key={ci.id} className="cart-item-card">
                  <div className="cart-item-info">
                    <h4 className="cart-item-name">{ci.menuItem?.name || 'Item'}</h4>
                    <span className="cart-item-price">₹{Number(ci.menuItem?.price ?? 0) * ci.quantity}</span>
                  </div>
                  <div className="cart-item-actions">
                    <div className="quantity-selector">
                      <button className="qty-btn" onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity - 1)}>−</button>
                      <span className="qty-value">{ci.quantity}</span>
                      <button className="qty-btn" onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity + 1)}>+</button>
                    </div>
                    <button className="cart-item-delete" onClick={() => onUpdateQuantity(ci.menuItemId, 0)} title="Remove item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
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

          <div className="cart-action-buttons">
            <button
              className="checkout-btn schedule-btn"
              disabled={items.length === 0 || isCheckingOut}
              onClick={() => alert('Scheduling is not yet supported in V1.')}
            >
              Schedule
            </button>
            <button
              className="checkout-btn order-now-btn"
              disabled={items.length === 0 || isCheckingOut}
              onClick={onCheckout}
            >
              {isCheckingOut ? 'Placing order…' : 'Order Now'} <span className="arrow">›</span>
            </button>
          </div>
          <p className="checkout-note">Pickup only · no delivery fee</p>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
