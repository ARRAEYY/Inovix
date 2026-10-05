import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import BackButton from '../../components/common/BackButton';

import { catalogService } from '../../services/api/catalogService';
import { cacheGet, cacheSet, cacheGetStale } from '../../services/cache/localCache';
import FoodReviewsModal from '../../components/food/FoodReviewsModal';
import { orderService } from '../../services/api/orderService';
import { paymentService } from '../../services/api/paymentService';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { Skeleton, SkeletonGrid } from '../../components/common/Skeleton';

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

// Group flat items by category and sort Popular first
const buildMenuSections = (items) => {
  const grouped = (items || []).reduce((acc, item) => {
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
  sectionsArray.sort((a, b) => {
    if (a.category === 'Popular') return -1;
    if (b.category === 'Popular') return 1;
    return a.category.localeCompare(b.category);
  });
  return sectionsArray;
};

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

  // Instant SWR: Read from localStorage immediately so the menu paints with 0ms delay!
  const cacheKey = `menu:${id}`;
  const initialCache = React.useMemo(() => cacheGetStale(cacheKey), [cacheKey]);
  const initialItems = React.useMemo(() => (initialCache.data?.items || []).map(mapMenuItem), [initialCache]);
  const initialSections = React.useMemo(() => buildMenuSections(initialItems), [initialItems]);

  const [outlet, setOutlet] = useState(() => initialCache.data?.outlet ? mapOutletDetails(initialCache.data.outlet) : null);
  const [menuSections, setMenuSections] = useState(initialSections);
  const [flatMenuItems, setFlatMenuItems] = useState(initialItems);
  const [loading, setLoading] = useState(() => !initialItems.length);
  const [error, setError] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [reviewsItem, setReviewsItem] = useState(null);

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
  // restores the exact cart the user had) and broadcast a change event so
  // the bottom-nav Cart tab can update its badge app-wide.
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      window.dispatchEvent(new CustomEvent('nosh:cart-changed'));
    } catch {
      // localStorage might be full or blocked (incognito) — ignore.
    }
  }, [cart, CART_STORAGE_KEY]);

  // The bottom-nav Cart tab can ask this page to open the drawer (it
  // navigates here first, then dispatches the event).
  useEffect(() => {
    const openCart = () => setIsCartOpen(true);
    window.addEventListener('nosh:open-cart', openCart);
    return () => window.removeEventListener('nosh:open-cart', openCart);
  }, []);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length > 0;
  const [activeCategory, setActiveCategory] = useState(() => initialSections[0]?.category || '');

  // Refs for scroll spy
  const sectionRefs = useRef({});
  const menuContentRef = useRef(null);

  useEffect(() => {
    // Check if cache has data for current id
    const cached = cacheGetStale(cacheKey);
    if (cached.data) {
      if (cached.data.outlet) setOutlet(mapOutletDetails(cached.data.outlet));
      if (cached.data.items) {
        const items = cached.data.items.map(mapMenuItem);
        setFlatMenuItems(items);
        const sections = buildMenuSections(items);
        setMenuSections(sections);
        setActiveCategory((prev) =>
          sections.some((s) => s.category === prev) ? prev : (sections[0]?.category || '')
        );
        setLoading(false);
      }
    } else {
      setLoading(true);
    }

    const fetchMenu = async () => {
      try {
        const [outletRes, menuRes] = await Promise.all([
          catalogService.getOutletDetails(id),
          catalogService.getOutletMenu(id),
        ]);
        const outletRaw = outletRes.data || {};
        const itemsRaw = menuRes.data || [];

        // Save fresh menu in user's localStorage so next time it loads in 0ms!
        cacheSet(cacheKey, { outlet: outletRaw, items: itemsRaw });

        setOutlet(mapOutletDetails(outletRaw));
        const items = itemsRaw.map(mapMenuItem);
        setFlatMenuItems(items);
        const sections = buildMenuSections(items);
        setMenuSections(sections);
        setActiveCategory((prev) =>
          sections.some((s) => s.category === prev) ? prev : (sections[0]?.category || '')
        );
        setError(null);
      } catch (err) {
        console.error('Failed to fetch menu:', err);
        // Only surface the error when there was nothing cached to show.
        if (!cached.data) setError(err.message || 'Failed to load this outlet\'s menu');
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [id, cacheKey]);

  // ─── Outlet-wise cart ──────────────────────────────────────────────────
  // Carts are keyed per outlet (nosh:cart:{id}) and persist across visits:
  // leaving an outlet keeps its cart saved, and returning restores it.
  // Switching outlets shows that outlet's own cart — items are never mixed
  // because every read/write goes through the outlet-scoped key.

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
  const handleOrderNow = async ({ notes, scheduledFor } = {}) => {
    if (placingOrder) return;
    const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;

    let pendingOrderId = null;
    try {
      setPlacingOrder(true);

      // Step 1: create the order
      const orderRes = await orderService.createOrder({
        outletId: id,
        items: entries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
        ...(notes ? { notes } : {}),
        ...(scheduledFor ? { scheduledFor } : {}),
      });
      const order = orderRes.data || {};
      if (!order.id) {
        throw new Error(orderRes.message || 'Could not create the order');
      }
      pendingOrderId = order.id;

      // Step 2: create a Razorpay gateway order. When the outlet has no
      // Razorpay credentials configured (local dev) AND the app runs in dev
      // mode, fall back to the backend's dev-only mock confirm so the
      // prepaid flow still completes end to end. In production the route
      // doesn't exist and the error propagates.
      let rp;
      try {
        const razorpayRes = await paymentService.createRazorpayOrder(order.id);
        rp = razorpayRes.data || {};
        if (!rp.razorpayOrderId || !rp.keyId) {
          throw new Error('Could not initialize Razorpay payment');
        }
      } catch (gatewayError) {
        const notConfigured =
          gatewayError?.response?.data?.code === 'PAYMENT_NOT_CONFIGURED' ||
          gatewayError?.code === 'PAYMENT_NOT_CONFIGURED';
        if (!(import.meta.env.DEV && notConfigured)) {
          throw gatewayError;
        }
        const confirmRes = await paymentService.devConfirm(order.id);
        if (!confirmRes.success) {
          throw new Error(confirmRes.message || 'Dev payment confirmation failed');
        }
        pendingOrderId = null;
        setCart({});
        try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
        setIsCartOpen(false);
        toast(`Order ${order.orderNumber || ''} placed! Payment auto-confirmed (dev mode — no Razorpay configured).`);
        navigate('/student/orders');
        return;
      }

      // Step 3: open the Razorpay checkout modal
      const paymentResponse = await paymentService.openCheckout({
        keyId: rp.keyId,
        razorpayOrderId: rp.razorpayOrderId,
        amount: rp.amount,
        currency: rp.currency,
        user,
        outletName: outlet?.name,
      });

      // Step 4: verify the payment signature
      const verifyRes = await paymentService.verifyPayment({
        razorpayOrderId: paymentResponse.razorpay_order_id,
        razorpayPaymentId: paymentResponse.razorpay_payment_id,
        razorpaySignature: paymentResponse.razorpay_signature,
      });

      // Step 5: payment confirmed → clear cart + navigate
      pendingOrderId = null;
      setCart({});
      try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
      setIsCartOpen(false);
      const paid = verifyRes.success ? '✓ Paid' : 'pending verification';
      toast(`Order ${order.orderNumber || ''} placed! Payment: ${paid}. You'll get a pickup code when the outlet accepts.`);
      navigate('/student/orders');
    } catch (err) {
      if (pendingOrderId) {
        try {
          await orderService.cancelOrder(pendingOrderId);
        } catch (cleanupErr) {
          console.error('Failed to cleanup unpaid order:', cleanupErr);
        }
      }
      setIsCartOpen(false);
      toast(err.message || 'Payment was not completed. Your cart is preserved so you can try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  // Scroll spy — rAF-throttled, based on viewport-relative positions so it
  // stays correct regardless of nested offset parents. A section becomes
  // active once its top passes the sticky header + banner line.
  useEffect(() => {
    if (isSearching || menuSections.length === 0) return undefined;
    // Time throttle rather than rAF: rAF doesn't fire in occluded tabs,
    // which left the highlight stale in headless/background contexts.
    let lastRun = 0;

    const SPY_LINE = 170; // sticky header (64) + banner/search area

    const computeActive = () => {
      let current = menuSections[0]?.category || '';
      for (const section of menuSections) {
        const el = sectionRefs.current[section.category];
        if (!el) continue;
        if (el.getBoundingClientRect().top - SPY_LINE <= 0) {
          current = section.category;
        }
      }
      // Bottom of page → force the last section active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        current = menuSections[menuSections.length - 1]?.category || current;
      }
      setActiveCategory((prev) => (prev === current ? prev : current));
    };

    const handleScroll = () => {
      const now = Date.now();
      if (now - lastRun < 80) return;
      lastRun = now;
      computeActive();
    };

    computeActive();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [menuSections, isSearching]);

  // Keep the active sidebar item visible as the user scrolls.
  useEffect(() => {
    const btn = document.querySelector(`.category-nav-btn[aria-label="Show ${CSS.escape(activeCategory)}"]`);
    if (btn) btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeCategory]);

  const scrollToCategory = (category) => {
    const element = sectionRefs.current[category];
    if (element) {
      setActiveCategory(category);
      // Smooth-scroll so the section title lands below the sticky header.
      const top = element.getBoundingClientRect().top + window.scrollY - 130;
      window.scrollTo({ top, behavior: 'smooth' });
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

      {/* Main Menu Layout — sticky sidebar with category icon + name */}
      <div className="menu-layout-container">
        {!isSearching && (
          <aside className="category-sidebar">
            <ul className="category-list">
              {menuSections.map(section => (
                <li key={section.category}>
                  <button
                    className={`category-nav-btn ${activeCategory === section.category ? 'active' : ''}`}
                    onClick={() => scrollToCategory(section.category)}
                    aria-label={`Show ${section.category}`}
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
              <div className="skeleton-row" aria-busy="true">
                <SkeletonGrid count={4} cols={2} />
              </div>
            ) : error ? (
              <div className="state-block">
                <div className="state-icon">⚠️</div>
                <p className="state-title">Something went wrong</p>
                <p className="state-sub">{error}</p>
                <button className="primary-btn" onClick={() => window.location.reload()}>Try Again</button>
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
                          onShowReviews={setReviewsItem}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-search">
                  <p>No items on this menu yet — check back soon.</p>
                </div>
              )
            )}
          </div>
        </main>
      </div>

      {reviewsItem && (
        <FoodReviewsModal item={reviewsItem} onClose={() => setReviewsItem(null)} />
      )}

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

      {/* Sticky Mobile Cart Bar (§9) — whole bar tappable */}
      {cartItemsCount > 0 && (
        <button
          type="button"
          className="mobile-sticky-cart"
          onClick={() => setIsCartOpen(true)}
          aria-label={`View cart — ${cartItemsCount} item${cartItemsCount !== 1 ? 's' : ''}, ₹${cartTotal}`}
        >
          <span className="cart-summary-info">
            <span className="cart-item-count">{cartItemsCount} item{cartItemsCount !== 1 ? 's' : ''}</span>
            <span className="cart-divider">|</span>
            <span className="cart-total">₹{cartTotal}</span>
          </span>
          <span className="view-cart-action">View Cart <span aria-hidden="true">›</span></span>
        </button>
      )}

      <MobileBottomNav cartItemCount={cartItemsCount} onCartClick={() => setIsCartOpen(true)} />
    </div>
  );
};

export default OutletMenu;
