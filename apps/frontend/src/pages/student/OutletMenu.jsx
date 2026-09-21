import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
      navigate('/student/orders');
      alert(`Order placed! Order number: ${order.orderNumber}. Pickup code: ${order.pickupCode}`);
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Order failed');
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
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              className="mb-3 p-2 rounded-lg bg-muted text-foreground hover:bg-border transition-colors"
              onClick={() => navigate('/student')}
              aria-label="Back to outlets"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{outlet?.name || 'Loading…'}</h1>
            <p className="text-sm text-muted-foreground mt-1">{outlet?.description || ''}</p>
            {outlet && (
              <div className="flex items-center gap-3 mt-3 text-sm">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${outlet.status === 'OPEN' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${outlet.status === 'OPEN' ? 'bg-success' : 'bg-muted-foreground'}`}></span>
                  {outlet.status}
                </span>
                <span className="text-muted-foreground">★ {outlet.rating}</span>
                <span className="text-muted-foreground">⏱ {outlet.estimatedTime}</span>
              </div>
            )}
          </div>
          <div className="relative w-full md:w-80">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring focus:border-ring"
              placeholder="Search this menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Layout: sticky sidebar + main content */}
      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">
        {/* Sidebar */}
        <aside className="hidden lg:block w-48 shrink-0">
          <div className="sticky top-24">
            <ul className="space-y-1">
              {categories.map((section) => (
                <li key={section.name}>
                  <button
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeCategory === section.name ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                    onClick={() => scrollToCategory(section.name)}
                  >
                    {section.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          {menuLoading ? (
            <div className="text-center py-16 text-muted-foreground">Loading menu…</div>
          ) : filteredCategories.length > 0 ? (
            <div className="space-y-10">
              {filteredCategories.map((section) => (
                <div
                  key={section.name}
                  ref={(el) => { sectionRefs.current[section.name] = el; }}
                >
                  <h2 className="text-xl font-bold text-foreground tracking-tight mb-4">{section.name}</h2>
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground">
              <p>No items found matching "{searchQuery}"</p>
            </div>
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
