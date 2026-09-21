import React, { useEffect } from 'react';

const CartDrawer = ({ isOpen, onClose, cart, outletName, onUpdateQuantity, onCheckout, isCheckingOut }) => {
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
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-foreground/30 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-card z-50 flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Your cart</h2>
            <p className="text-sm text-muted-foreground mt-0.5">From {outletName}</p>
          </div>
          <button
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            onClick={onClose}
            aria-label="Close cart"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm py-12">
              <p>Your cart is empty.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((ci) => (
                <div key={ci.id} className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-foreground truncate">{ci.menuItem?.name || 'Item'}</h4>
                    <span className="text-sm font-medium text-muted-foreground">₹{Number(ci.menuItem?.price ?? 0) * ci.quantity}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-card rounded-lg p-1 border border-border">
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-border transition-colors text-sm"
                        onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity - 1)}
                        aria-label="Decrease"
                      >−</button>
                      <span className="font-semibold text-foreground min-w-[1rem] text-center text-sm">{ci.quantity}</span>
                      <button
                        className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-border transition-colors text-sm"
                        onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity + 1)}
                        aria-label="Increase"
                      >+</button>
                    </div>
                    <button
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      onClick={() => onUpdateQuantity(ci.menuItemId, 0)}
                      title="Remove item"
                      aria-label="Remove item"
                    >
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

        <div className="border-t border-border p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium text-foreground">₹{subtotal}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Platform fee</span>
            <span className="font-medium text-foreground">₹{platformFee}</span>
          </div>
          <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-border">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">₹{total}</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              className="flex-1 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              disabled={items.length === 0 || isCheckingOut}
              onClick={() => alert('Scheduling is not yet supported in V1.')}
            >
              Schedule
            </button>
            <button
              className="flex-[2] py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center justify-center gap-1"
              disabled={items.length === 0 || isCheckingOut}
              onClick={onCheckout}
            >
              {isCheckingOut ? 'Placing order…' : 'Order Now'}
              <span className="text-base leading-none">›</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">Pickup only · no delivery fee</p>
        </div>
      </div>
    </>
  );
};

export default CartDrawer;
