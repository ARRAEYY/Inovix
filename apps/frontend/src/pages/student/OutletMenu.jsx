import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Star, Clock, Search, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';
import { catalogService } from '../../services/catalog/catalogService';
import { cartService } from '../../services/cart/cartService';
import { ordersService } from '../../services/orders/ordersService';

const OutletMenu = () => {
  const { id: outletId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);
  const sectionRefs = useRef({});

  const { data: outlet } = useQuery({
    queryKey: ['outlets', 'detail', outletId],
    queryFn: () => catalogService.getOutlet(outletId),
  });

  const { data: menuItems = [], isLoading: menuLoading } = useQuery({
    queryKey: ['outlets', 'menu', outletId],
    queryFn: () => catalogService.getOutletMenu(outletId),
  });

  const { data: cart, refetch: refetchCart } = useQuery({
    queryKey: ['cart', 'outlet', outletId],
    queryFn: () => cartService.getOrCreateForOutlet(outletId),
    enabled: !!outletId,
  });

  const addItemMut = useMutation({
    mutationFn: ({ menuItemId, quantity }) =>
      cartService.addItem(outletId, { menuItemId, quantity }),
    onSuccess: () => {
      refetchCart();
      qc.invalidateQueries({ queryKey: ['cart', 'totals'] });
    },
  });

  const updateQtyMut = useMutation({
    mutationFn: ({ cartItemId, quantity }) =>
      quantity > 0
        ? cartService.updateItem(cartItemId, quantity)
        : cartService.removeItem(cartItemId),
    onSuccess: () => {
      refetchCart();
      qc.invalidateQueries({ queryKey: ['cart', 'totals'] });
    },
  });

  const checkoutMut = useMutation({
    mutationFn: () => {
      const items = (cart?.items ?? []).map((ci) => ({
        menuItemId: ci.menuItemId,
        quantity: ci.quantity,
      }));
      return ordersService.createOrder({ outletId, items, paymentMethod: 'ONLINE' });
    },
    onSuccess: (order) => {
      cartService.clearCart().catch(() => {});
      qc.invalidateQueries({ queryKey: ['orders', 'student', 'list'] });
      setIsCartOpen(false);
      toast.success(`Order placed! Pickup code: ${order.pickupCode}`, {
        description: `Order #${order.orderNumber} · ₹${Number(order.totalAmount)}`,
      });
      navigate('/student/orders');
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Order failed');
    },
  });

  const categories = React.useMemo(() => {
    const grouped = {};
    for (const item of menuItems) {
      const cat = item.category?.name || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = { name: cat, items: [] };
      grouped[cat].items.push(item);
    }
    return Object.values(grouped);
  }, [menuItems]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      for (const section of categories) {
        const el = sectionRefs.current[section.name];
        if (el) {
          const { offsetTop, offsetHeight } = el;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveCategory(section.name);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [categories]);

  const scrollToCategory = (category) => {
    setActiveCategory(category);
    const element = sectionRefs.current[category];
    if (element) {
      const offset = 140;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const cartByMenuItemId = React.useMemo(() => {
    const map = {};
    for (const ci of cart?.items ?? []) {
      map[ci.menuItemId] = ci;
    }
    return map;
  }, [cart]);

  const handleUpdateQuantity = (menuItemId, newQty) => {
    const existing = cartByMenuItemId[menuItemId];
    if (!existing) {
      addItemMut.mutate({ menuItemId, quantity: newQty });
    } else {
      updateQtyMut.mutate({ cartItemId: existing.id, quantity: newQty });
    }
  };

  const cartItemsCount = (cart?.items ?? []).reduce((sum, i) => sum + i.quantity, 0);

  const filteredCategories = searchQuery.trim()
    ? categories.map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.description || '').toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : categories;

  return (
    <div className="min-h-screen bg-background">
      <Header
        cartCount={cartItemsCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Outlet banner */}
      <div className="bg-card border-b border-border overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="relative max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-2.5 rounded-xl bg-muted text-foreground hover:bg-border transition-colors inline-flex"
              onClick={() => navigate('/student')}
              aria-label="Back to outlets"
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-extrabold text-foreground tracking-tight"
            >
              {outlet?.name || 'Loading…'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm text-muted-foreground mt-1 max-w-2xl"
            >
              {outlet?.description || ''}
            </motion.p>
            {outlet && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 mt-3 text-sm"
              >
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  outlet.status === 'OPEN' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${outlet.status === 'OPEN' ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                  {outlet.status}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Star className="w-3.5 h-3.5 fill-warning text-warning" />
                  <span className="font-medium text-foreground">{outlet.rating}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {outlet.estimatedTime}
                </span>
              </motion.div>
            )}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all"
              placeholder="Search this menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Layout: sticky sidebar + main */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-24">
            <ul className="space-y-1">
              {categories.map((section) => (
                <li key={section.name}>
                  <button
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeCategory === section.name
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                    onClick={() => scrollToCategory(section.name)}
                  >
                    {section.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {menuLoading ? (
            <div className="space-y-8">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="h-7 w-32 bg-muted animate-pulse rounded mb-4" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="bg-card border border-border rounded-2xl p-4 flex gap-3">
                        <div className="w-24 h-24 bg-muted rounded-lg animate-pulse" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                          <div className="h-3 w-full bg-muted animate-pulse rounded" />
                          <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                          <div className="h-8 w-20 bg-muted animate-pulse rounded-lg mt-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCategories.length > 0 ? (
            <div className="space-y-10">
              {filteredCategories.map((section, secIdx) => (
                <motion.div
                  key={section.name}
                  ref={(el) => { sectionRefs.current[section.name] = el; }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: secIdx * 0.05 }}
                >
                  <h2 className="text-xl font-bold text-foreground tracking-tight mb-4 flex items-center gap-2">
                    {section.name}
                    <span className="text-xs font-normal text-muted-foreground">({section.items.length})</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.items.map((item) => (
                      <FoodCard
                        key={item.id}
                        food={{
                          id: item.id,
                          name: item.name,
                          description: item.description,
                          price: Number(item.price),
                          image: item.imageUrl,
                          available: item.isAvailable,
                          popular: item.popular,
                          vegetarian: item.vegetarian,
                          discount: item.discount,
                        }}
                        quantity={cartByMenuItemId[item.id]?.quantity || 0}
                        onUpdateQuantity={(foodId, newQty) => handleUpdateQuantity(foodId, newQty)}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24"
            >
              <div className="inline-flex w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
                <Search className="text-muted-foreground" size={24} />
              </div>
              <p className="text-muted-foreground">No items found matching "{searchQuery}"</p>
            </motion.div>
          )}
        </main>
      </div>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        outletName={outlet?.name || 'Outlet'}
        onUpdateQuantity={handleUpdateQuantity}
        onCheckout={() => checkoutMut.mutate()}
        isCheckingOut={checkoutMut.isPending}
      />
    </div>
  );
};

export default OutletMenu;
