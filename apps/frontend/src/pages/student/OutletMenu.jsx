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

  // Fetch outlet details
  const { data: outlet } = useQuery({
    queryKey: ['outlets', 'detail', outletId],
    queryFn: () => catalogService.getOutlet(outletId),
  });

  // Fetch menu items
  const { data: menuItems = [], isLoading: menuLoading } = useQuery({
    queryKey: ['outlets', 'menu', outletId],
    queryFn: () => catalogService.getOutletMenu(outletId),
  });

  // Fetch current cart (so the drawer can show server-side cart state)
  const { data: cart, refetch: refetchCart } = useQuery({
    queryKey: ['cart', 'outlet', outletId],
    queryFn: () => cartService.getOrCreateForOutlet(outletId),
    enabled: !!outletId,
  });

  // Add to cart mutation
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
      // Clear the cart + navigate to orders page
      cartService.clearCart().catch(() => {});
      qc.invalidateQueries({ queryKey: ['orders', 'student', 'list'] });
      setIsCartOpen(false);
      navigate('/student/orders');
      // In V1 we don't have a real Razorpay key, so we just show the order
      alert(`Order placed! Order number: ${order.orderNumber}. Pickup code: ${order.pickupCode}`);
    },
    onError: (err) => {
      alert(err?.response?.data?.message || 'Order failed');
    },
  });

  // Group menu items by category
  const categories = React.useMemo(() => {
    const grouped = {};
    for (const item of menuItems) {
      const cat = item.category?.name || 'Uncategorized';
      if (!grouped[cat]) grouped[cat] = { name: cat, items: [] };
      grouped[cat].items.push(item);
    }
    return Object.values(grouped);
  }, [menuItems]);

  // Set default active category once menu loads
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].name);
    }
  }, [categories, activeCategory]);

  // Scroll spy
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

  // Build a map of menuItemId -> cartItem for the FoodCard's quantity display
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
      // Add new
      addItemMut.mutate({ menuItemId, quantity: newQty });
    } else {
      updateQtyMut.mutate({ cartItemId: existing.id, quantity: newQty });
    }
  };

  const cartItemsCount = (cart?.items ?? []).reduce((sum, i) => sum + i.quantity, 0);

  // Filter by search query
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
    <div className="page-wrapper bg-white">
      <Header
        cartCount={cartItemsCount}
        onCartClick={() => setIsCartOpen(true)}
      />

      {/* Outlet Banner */}
      <div className="outlet-banner">
        <div className="banner-content">
          <div className="banner-left">
            <button className="icon-btn back-btn" onClick={() => navigate('/student')} style={{ border: 'none', background: 'var(--muted)', marginBottom: '1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <div className="banner-details">
              <h1 className="banner-title">{outlet?.name || 'Loading…'}</h1>
              <p className="banner-desc">{outlet?.description || ''}</p>
              <div className="banner-meta">
                {outlet && (
                  <>
                    <span className={`status-badge ${outlet.status === 'OPEN' ? 'active' : 'inactive'}`}>
                      <span className="status-dot"></span>{outlet.status}
                    </span>
                    <span className="meta-info">★ {outlet.rating}</span>
                    <span className="meta-info">⏱ {outlet.estimatedTime}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="banner-right">
            <div className="menu-search-wrapper">
              <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="search-input"
                placeholder="Search this menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Menu Layout */}
      <div className="menu-layout-container">
        <aside className="category-sidebar">
          <ul className="category-list">
            {categories.map((section) => (
              <li key={section.name}>
                <button
                  className={`category-nav-btn ${activeCategory === section.name ? 'active' : ''}`}
                  onClick={() => scrollToCategory(section.name)}
                >
                  <span className="category-name">{section.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="menu-content">
          <div className="menu-sections">
            {menuLoading ? (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>Loading menu…</div>
            ) : filteredCategories.length > 0 ? (
              filteredCategories.map((section) => (
                <div
                  key={section.name}
                  className="menu-section"
                  ref={(el) => { sectionRefs.current[section.name] = el; }}
                >
                  <h2 className="section-title">{section.name}</h2>
                  <div className="food-grid">
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
              ))
            ) : (
              <div className="empty-search">
                <p>No items found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
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
