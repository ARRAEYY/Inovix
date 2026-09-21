import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2, ShoppingCart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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

  const handleCheckout = () => {
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    onCheckout();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-card z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-foreground tracking-tight">Your cart</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">From {outletName}</p>
              </div>
              <button
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={onClose}
                aria-label="Close cart"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center py-12"
                >
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
                    <ShoppingCart className="w-9 h-9 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Your cart is empty</h3>
                  <p className="text-sm text-muted-foreground">Browse the menu and add some items</p>
                </motion.div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {items.map((ci) => (
                      <motion.div
                        key={ci.id}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 30, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start justify-between gap-2 p-3 bg-muted/50 rounded-xl border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate">{ci.menuItem?.name || 'Item'}</h4>
                          <span className="text-sm font-medium text-muted-foreground">₹{Number(ci.menuItem?.price ?? 0) * ci.quantity}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
                              onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity - 1)}
                              aria-label="Decrease"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-semibold text-foreground min-w-[1.5rem] text-center text-sm">{ci.quantity}</span>
                            <button
                              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted text-foreground transition-colors"
                              onClick={() => onUpdateQuantity(ci.menuItemId, ci.quantity + 1)}
                              aria-label="Increase"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={() => onUpdateQuantity(ci.menuItemId, 0)}
                            title="Remove item"
                            aria-label="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-t border-border p-5 space-y-3 bg-card"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium text-foreground">₹{subtotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Platform fee</span>
                  <span className="font-medium text-foreground">₹{platformFee}</span>
                </div>
                <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-dashed border-border">
                  <span className="text-foreground">Total</span>
                  <span className="text-primary text-xl">₹{total}</span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    className="flex-1 py-3 border border-border text-foreground font-semibold rounded-xl hover:bg-muted transition-colors disabled:opacity-50 text-sm"
                    disabled={isCheckingOut}
                    onClick={() => toast.info('Scheduling is not yet supported in V1.')}
                  >
                    Schedule
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    className="flex-[2] py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm inline-flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
                    disabled={isCheckingOut}
                    onClick={handleCheckout}
                  >
                    {isCheckingOut ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full"
                        />
                        Placing order…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Order Now
                      </>
                    )}
                  </motion.button>
                </div>
                <p className="text-xs text-muted-foreground text-center">Pickup only · no delivery fee</p>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CartDrawer;
