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
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-[#FCEAE1]">
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A]">Your cart</h2>
            <p className="text-sm text-[#475569] mt-1">From {outletName}</p>
          </div>
          <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors" onClick={onClose} aria-label="Close cart">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-[#94A3B8]">Your cart is empty.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {items.map((ci) => (
                <div key={ci.id} className="bg-[#FDF4F0] rounded-xl p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-base font-semibold text-[#0F172A]">{ci.menuItem?.name || 'Item'}</h4>
                    <span className="text-base font-bold text-[#0F172A]">₹{Number(ci.menuItem?.price ?? 0) * ci.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 bg-[#EA580C] rounded-lg px-2 py-1">
                      <button className="w-6 h-6 flex items-center justify-center text-white font-bold text-lg hover:opacity-80" onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity - 1)}>−</button>
                      <span className="min-w-[24px] text-center text-white font-semibold">{ci.quantity}</span>
                      <button className="w-6 h-6 flex items-center justify-center text-white font-bold text-lg hover:opacity-80" onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity + 1)}>+</button>
                    </div>
                    <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-red-50 text-[#DC2626] transition-colors" onClick={() => onUpdateQuantity(ci.menuItemId, 0)} title="Remove item">
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

        <div className="border-t border-[#FCEAE1] p-6 bg-white">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-[#475569]">Subtotal</span>
            <span className="text-[#0F172A] font-semibold">₹{subtotal}</span>
          </div>
          <div className="flex items-center justify-between mb-4 text-sm">
            <span className="text-[#475569]">Platform fee</span>
            <span className="text-[#0F172A] font-semibold">₹{platformFee}</span>
          </div>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#FCEAE1]">
            <span className="text-lg font-bold text-[#0F172A]">Total</span>
            <span className="text-lg font-bold text-[#0F172A]">₹{total}</span>
          </div>

          <div className="flex gap-3 mb-3">
            <button
              className="flex-1 bg-white border border-[#FCEAE1] text-[#475569] rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={items.length === 0 || isCheckingOut}
              onClick={() => alert('Scheduling is not yet supported in V1.')}
            >
              Schedule
            </button>
            <button
              className="flex-[2] bg-[#EA580C] text-white border-none rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-[#C2410C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              disabled={items.length === 0 || isCheckingOut}
              onClick={onCheckout}
            >
              {isCheckingOut ? 'Placing order…' : 'Order Now'} <span>›</span>
            </button>
          </div>
          <p className="text-xs text-center text-[#94A3B8]">Pickup only · no delivery fee</p>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
