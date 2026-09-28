import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import BackButton from '../../components/common/BackButton';

import { catalogService } from '../../services/api/catalogService';
import { orderService } from '../../services/api/orderService';
import { paymentService } from '../../services/api/paymentService';
import { useAuth } from '../../hooks/useAuth';

// Render a category icon as a self-contained CSS block — no external image
// service. Uses the first letter (or first two letters for short words) of
// the category name on a tinted circle. Keeps the sidebar visual without
// depending on via.placeholder.com.
const CategoryIcon = ({ name }) => {
  const label = (name || '?')
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        background: '#faf5f6',
        color: '#b10035',
        fontWeight: 700,
        fontSize: '0.85rem',
        letterSpacing: '0.5px',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {label}
    </span>
  );
};

// Map a backend menu item onto the fields FoodCard / the cart read.
const mapMenuItem = (item) => ({
  ...item,
  category: item.category?.name || 'Other',
  image: item.imageUrl || null,
  price: Number(item.price),
});

// Map the catalog outlet onto the banner fields.
const mapOutletDetails = (o) => ({
  name: o.name,
  desc: o.description,
  status: o.status === 'OPEN' || o.status === 'BUSY' ? 'Open' : o.status,
  prepTime: o.estimatedTime || '15-20 min',
  rating: o.rating,
});

const OutletMenu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [outlet, setOutlet] = useState(null);
  const [menuSections, setMenuSections] = useState([]);
  const [flatMenuItems, setFlatMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  // ─── Cart persistence ────────────────────────────────────────────────
  // The cart was lost on page refresh because it was only in React state.
  // Now it's persisted to localStorage keyed per outlet (so different
  // outlets have separate carts). Loaded lazily on mount via useState's
  // initializer, saved on every change via useEffect.
  const CART_STORAGE_KEY = `nosh:cart:${id}`;
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  // Persist the cart to localStorage whenever it changes (so a refresh
  // restores the exact cart the user had).
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // localStorage might be full or blocked (incognito) — ignore.
    }
  }, [cart, CART_STORAGE_KEY]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  // Refs for scroll spy
  const sectionRefs = useRef({});
  const menuContentRef = useRef(null);

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        setLoading(true);
        const [outletRes, menuRes] = await Promise.all([
          catalogService.getOutletDetails(id),
          catalogService.getOutletMenu(id),
        ]);
        setOutlet(mapOutletDetails(outletRes.data || {}));

        const items = (menuRes.data || []).map(mapMenuItem);
        setFlatMenuItems(items);

        // Group by category
        const grouped = items.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = {
              category: item.category,
              items: []
            };
          }
          acc[item.category].items.push(item);
          return acc;
        }, {});

        const sectionsArray = Object.values(grouped);

        // Sort sections logically, putting 'Popular' first
        sectionsArray.sort((a, b) => {
          if (a.category === 'Popular') return -1;
          if (b.category === 'Popular') return 1;
          return a.category.localeCompare(b.category);
        });

        setMenuSections(sectionsArray);
        if (sectionsArray.length > 0) {
          setActiveCategory(sectionsArray[0].category);
        }
        setError(null);
      } catch (err) {
        console.error('Failed to fetch menu:', err);
        setError(err.message || 'Failed to load this outlet\'s menu');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [id]);

  // Clear the persisted cart when the outlet ID changes — prevents
  // accidentally ordering Outlet A's items at Outlet B.
  useEffect(() => {
    setCart({});
    try { localStorage.removeItem(`nosh:cart:${id}`); } catch {}
  }, [id]);

  // ─── Prepaid order flow (every order is paid via Razorpay checkout) ─────
  // No order is confirmed without payment. The flow:
  //   1. POST /orders → create the order (status=PENDING, Payment.status=PENDING)
  //   2. POST /payments/razorpay/order → create a Razorpay gateway order
  //   3. Open Razorpay checkout → student pays
  //   4. POST /payments/razorpay/verify → verify the HMAC signature
  //   5. On success → clear cart + navigate to /student/orders
  //   6. On dismiss/failure → order stays PENDING, cart is preserved so
  //      the student can retry. The order appears in /orders with a "Pay"
  //      button (or auto-cancels after the pickup timeout).
  const handleOrderNow = async () => {
    if (placingOrder) return;
    const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;
    try {
      setPlacingOrder(true);

      // Step 1: create the order
      const orderRes = await orderService.createOrder({
        outletId: id,
        items: entries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      });
      const order = orderRes.data || {};
      if (!order.id) {
        throw new Error(orderRes.message || 'Could not create the order');
      }

      // Step 2: create a Razorpay gateway order
      const razorpayRes = await paymentService.createRazorpayOrder(order.id);
      const rp = razorpayRes.data || {};
      if (!rp.razorpayOrderId || !rp.keyId) {
        throw new Error('Could not initialize Razorpay payment');
      }

      // Step 3: open the Razorpay checkout modal
      let paymentResponse;
      try {
        paymentResponse = await paymentService.openCheckout({
          keyId: rp.keyId,
          razorpayOrderId: rp.razorpayOrderId,
          amount: rp.amount,
          currency: rp.currency,
          user,
          outletName: outlet?.name,
        });
      } catch (dismissError) {
        // User closed the checkout without paying. The order is created but
        // unpaid (status=PENDING). Navigate to orders so they can retry.
        setCart({});
        try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
        setIsCartOpen(false);
        alert(`Order ${order.orderNumber || ''} created but payment was cancelled. You can pay from your orders.`);
        navigate('/student/orders');
        return;
      }

      // Step 4: verify the payment signature
      const verifyRes = await paymentService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      // Step 5: payment confirmed → clear cart + navigate
      setCart({});
      try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
      setIsCartOpen(false);
      const paid = verifyRes.success ? '✓ Paid' : 'pending verification';
      alert(`Order ${order.orderNumber || ''} placed! Payment: ${paid}. You'll get a pickup code when the outlet accepts.`);
      navigate('/student/orders');
    } catch (err) {
      alert(err.message || 'Could not place the order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Setup scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100; // Offset for header/padding

      for (const section of menuSections) {
        const element = sectionRefs.current[section.category];
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveCategory(section.category);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [menuSections]);

  const scrollToCategory = (category) => {
    setActiveCategory(category);
    const element = sectionRefs.current[category];
    if (element) {
      // Calculate position relative to window
      const offset = 80;
      const elementTop = element.getBoundingClientRect().top + window.scrollY;
      
      window.scrollTo({
        top: elementTop - offset,
        behavior: 'smooth'
      });
    }
  };

  const handleUpdateQuantity = (itemId, newQuantity) => {
    setCart(prev => {
      const updated = { ...prev };
      if (newQuantity <= 0) {
        delete updated[itemId];
      } else {
        updated[itemId] = newQuantity;
      }
      return updated;
    });
  };

  // Calculate cart summary
  const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((total, [itemId, qty]) => {
    const item = flatMenuItems.find(i => i.id === itemId);
    return total + (item ? item.price * qty : 0);
  }, 0);

  const isSearching = searchQuery.trim().length > 0;

  // Flattened search results
  const searchResults = isSearching
    ? flatMenuItems.filter(item =>
        (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && (item.description || "").toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Filter sections by search query (for normal render)
  const filteredMenu = menuSections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      (item.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && (item.description || "").toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })).filter(section => section.items.length > 0);

  return (
    <div className="page-wrapper bg-white">
      <Header cartCount={cartItemsCount} onCartClick={() => setIsCartOpen(true)} />

      {/* Outlet Banner */}
      <div className="outlet-banner">
        <div className="banner-content">
          <div className="banner-left">
            <div className="banner-title-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <BackButton onClick={() => navigate('/student')} style={{ flexShrink: 0 }} />
              <h1 className="banner-title" style={{ marginBottom: 0 }}>{outlet?.name || 'Loading…'}</h1>
            </div>
            <p className="banner-desc" style={{ paddingLeft: 'calc(24px + 0.5rem)' }}>{outlet?.desc}</p>
            <div className="banner-meta" style={{ paddingLeft: 'calc(24px + 0.5rem)' }}>
                <span className="status-badge active"><span className="status-dot"></span>{outlet?.status || ''}</span>
                {outlet?.rating && <span className="meta-info">★ {outlet.rating}</span>}
                {outlet?.prepTime && <span className="meta-info">⏱ {outlet.prepTime}</span>}
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

        {/* Sticky Sidebar */}
        {!isSearching && (
          <aside className="category-sidebar">
            <ul className="category-list">
              {menuSections.map(section => (
                <li key={section.category}>
                  <button
                    className={`category-nav-btn ${activeCategory === section.category ? 'active' : ''}`}
                    onClick={() => scrollToCategory(section.category)}
                  >
                    <div className="category-img-wrapper">
                      <CategoryIcon name={section.category} />
                    </div>
                    <span className="category-name">{section.category}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}

        {/* Menu Content */}
        <main className="menu-content" style={isSearching ? { width: '100%', flex: '1 1 100%' } : {}}>
          <div className="menu-sections">
            {loading ? (
              <div className="empty-search">
                <p>Loading menu…</p>
              </div>
            ) : error ? (
              <div className="empty-search">
                <p>{error}</p>
              </div>
            ) : isSearching ? (
              <div className="menu-section">
                <h2 className="section-title">Search Results</h2>
                {searchResults.length > 0 ? (
                  <div className="food-grid">
                    {searchResults.map(item => (
                      <FoodCard
                        key={item.id}
                        food={item}
                        quantity={cart[item.id] || 0}
                        onUpdateQuantity={handleUpdateQuantity}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-search">
                    <p>No items found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
            ) : (
              filteredMenu.length > 0 ? (
                filteredMenu.map(section => (
                  <div
                    key={section.category}
                    className="menu-section"
                    ref={el => sectionRefs.current[section.category] = el}
                  >
                    <h2 className="section-title">{section.category}</h2>
                    <div className="food-grid">
                      {section.items.map(item => (
                        <FoodCard
                          key={item.id}
                          food={item}
                          quantity={cart[item.id] || 0}
                          onUpdateQuantity={handleUpdateQuantity}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-search">
                  <p>No items found</p>
                </div>
              )
            )}
          </div>
        </main>
      </div>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        menuItems={flatMenuItems}
        outletName={outlet?.name || ''}
        onUpdateQuantity={handleUpdateQuantity}
        onOrderNow={handleOrderNow}
        placingOrder={placingOrder}
      />

      {/* Sticky Mobile Cart Bar */}
      {cartItemsCount > 0 && (
        <div className="mobile-sticky-cart">
          <div className="cart-summary-info">
            <span className="cart-item-count">{cartItemsCount} item{cartItemsCount !== 1 ? 's' : ''}</span>
            <span className="cart-divider">|</span>
            <span className="cart-total">₹{cartTotal}</span>
          </div>
          <button className="view-cart-action" onClick={() => setIsCartOpen(true)}>
            View Cart <span>›</span>
          </button>
        </div>
      )}

      <MobileBottomNav cartItemCount={cartItemsCount} onCartClick={() => setIsCartOpen(true)} />
    </div>
  );
};

export default OutletMenu;
