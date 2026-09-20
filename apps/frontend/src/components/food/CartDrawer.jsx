import React, { useEffect } from 'react';

const CartDrawer = ({ isOpen, onClose, cart, menuItems, outletName, onUpdateQuantity }) => {
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

  const cartEntries = Object.entries(cart).filter(([id, qty]) => qty > 0);
  
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
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
          
          <button 
            className="checkout-btn" 
            disabled={cartEntries.length === 0}
            onClick={() => alert('Proceeding to checkout!')}
          >
            Checkout <span className="arrow">›</span>
          </button>
          <p className="checkout-note">Pickup only · no delivery fee</p>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
