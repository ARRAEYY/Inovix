import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import { cacheGetStale } from '../../services/cache/localCache';
import { toast } from 'react-hot-toast';

const Cart = () => {
  const navigate = useNavigate();
  const [cartsData, setCartsData] = useState([]);
  const [outletsMap, setOutletsMap] = useState({});

  // Read all cached outlets for display names and info
  useEffect(() => {
    try {
      const cached = cacheGetStale('outlets');
      if (cached?.data && Array.isArray(cached.data)) {
        const map = {};
        for (const o of cached.data) {
          map[o.id] = o;
        }
        setOutletsMap(map);
      }
    } catch {
      // Ignore cache read failures
    }
  }, []);

  // Read all outlet carts from localStorage
  const loadCarts = useCallback(() => {
    try {
      const foundCarts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('nosh:cart:')) continue;
        const outletId = key.replace('nosh:cart:', '');
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);

        // Normalize items
        const items = Object.entries(parsed)
          .map(([itemId, val]) => {
            const qty = typeof val === 'object' && val !== null ? Number(val.quantity) : Number(val);
            if (!qty || qty <= 0) return null;
            const name = typeof val === 'object' && val?.name ? val.name : 'Item';
            const price = typeof val === 'object' && val?.price != null ? Number(val.price) : 0;
            const image = typeof val === 'object' ? val?.image : null;
            return {
              id: itemId,
              name,
              price,
              quantity: qty,
              image,
            };
          })
          .filter(Boolean);

        if (items.length > 0) {
          const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          foundCarts.push({
            outletId,
            items,
            subtotal,
            platformFee: 5,
            total: subtotal + 5,
          });
        }
      }
      setCartsData(foundCarts);
    } catch {
      setCartsData([]);
    }
  }, []);

  useEffect(() => {
    loadCarts();
    const handleStorageChange = () => loadCarts();
    window.addEventListener('nosh:cart-changed', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('nosh:cart-changed', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadCarts]);

  const totalCartCount = useMemo(() => {
    return cartsData.reduce((sum, c) => sum + c.items.reduce((iSum, item) => iSum + item.quantity, 0), 0);
  }, [cartsData]);

  const handleUpdateQuantity = (outletId, itemId, newQty) => {
    try {
      const key = `nosh:cart:${outletId}`;
      const raw = localStorage.getItem(key);
      const cart = raw ? JSON.parse(raw) : {};
      if (newQty <= 0) {
        delete cart[itemId];
      } else if (typeof cart[itemId] === 'object' && cart[itemId] !== null) {
        cart[itemId] = { ...cart[itemId], quantity: newQty };
      } else {
        cart[itemId] = newQty;
      }
      if (Object.keys(cart).length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(cart));
      }
      window.dispatchEvent(new CustomEvent('nosh:cart-changed'));
      loadCarts();
    } catch (err) {
      console.error('Failed to update cart quantity:', err);
    }
  };

  const handleClearCart = (outletId) => {
    try {
      localStorage.removeItem(`nosh:cart:${outletId}`);
      window.dispatchEvent(new CustomEvent('nosh:cart-changed'));
      loadCarts();
      toast('Cart cleared');
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  const handleProceedToCheckout = (outletId) => {
    navigate(`/student/outlet/${outletId}`);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('nosh:open-cart'));
    }, 350);
  };

  return (
    <div className="page-wrapper cart-page-wrapper">
      <Header showBack={true} />

      <main className="cart-page-main" style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem 6rem', minHeight: 'calc(100vh - 140px)' }}>
        <h1 className="page-title" style={{ marginBottom: '1.25rem' }}>Your Cart</h1>

        {totalCartCount === 0 ? (
          <div className="cart-page-empty-card" style={{
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: '1rem',
          }}>
            {/* Friendly Empty Cart Illustration */}
            <svg
              className="cart-empty-illustration"
              viewBox="0 0 220 180"
              role="img"
              aria-label="An empty bowl illustration"
              style={{ width: '180px', maxWidth: '85%', marginBottom: '1.25rem' }}
            >
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

            <h1 style={{
              fontSize: '1.45rem',
              fontWeight: 800,
              color: 'var(--text-dark)',
              margin: '0 0 0.5rem',
              letterSpacing: '-0.02em',
            }}>
              Your cart is empty
            </h1>
            <p style={{
              fontSize: '0.95rem',
              color: 'var(--text-gray)',
              maxWidth: '320px',
              lineHeight: 1.5,
              margin: '0 0 1.75rem',
            }}>
              Looks like you haven't added anything to your cart yet. Discover dishes from your favorite campus outlets!
            </p>

            <button
              type="button"
              className="primary-btn"
              onClick={() => navigate('/student')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.75rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '12px',
                minWidth: '200px',
                boxShadow: '0 4px 14px rgba(177, 0, 53, 0.25)',
              }}
            >
              <span>Explore Outlets</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        ) : (
          <div className="cart-outlets-list" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {cartsData.map((outletCart) => {
              const outlet = outletsMap[outletCart.outletId];
              const outletName = outlet?.name || 'Campus Outlet';

              return (
                <div
                  key={outletCart.outletId}
                  className="cart-outlet-card"
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-dark)' }}>
                        {outletName}
                      </h2>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                        {outletCart.items.length} {outletCart.items.length === 1 ? 'item' : 'items'} in cart
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearCart(outletCart.outletId)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-gray)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        padding: '0.25rem 0.5rem',
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="cart-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                    {outletCart.items.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 0',
                          borderBottom: '1px dashed #f3f4f6',
                        }}
                      >
                        <div style={{ flex: 1, paddingRight: '0.75rem' }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                            {item.name}
                          </p>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-gray)' }}>
                            ₹{item.price} each
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', minWidth: '40px', textAlign: 'right' }}>
                            ₹{item.price * item.quantity}
                          </span>
                          <div className="cart-item-qty" style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(outletCart.outletId, item.id, item.quantity - 1)}
                              aria-label={`Decrease ${item.name}`}
                              style={{ width: '28px', height: '28px', border: 'none', background: '#f9fafb', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
                            >
                              −
                            </button>
                            <span style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 700 }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(outletCart.outletId, item.id, item.quantity + 1)}
                              aria-label={`Increase ${item.name}`}
                              style={{ width: '28px', height: '28px', border: 'none', background: '#f9fafb', cursor: 'pointer', fontSize: '1rem', fontWeight: 600 }}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ background: '#fafafa', borderRadius: '12px', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '0.35rem' }}>
                      <span>Subtotal</span>
                      <span>₹{outletCart.subtotal}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '0.35rem' }}>
                      <span>Platform fee</span>
                      <span>₹{outletCart.platformFee}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 800, color: 'var(--text-dark)', paddingTop: '0.35rem', borderTop: '1px solid #e5e7eb' }}>
                      <span>Total</span>
                      <span>₹{outletCart.total}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => handleProceedToCheckout(outletCart.outletId)}
                      style={{
                        flex: 1,
                        minWidth: '180px',
                        padding: '0.75rem 1rem',
                        fontWeight: 700,
                        borderRadius: '10px',
                      }}
                    >
                      Checkout · ₹{outletCart.total}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/student/outlet/${outletCart.outletId}`)}
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        fontWeight: 600,
                        fontSize: '0.88rem',
                        cursor: 'pointer',
                        color: 'var(--text-dark)',
                      }}
                    >
                      View Menu
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Cart;
