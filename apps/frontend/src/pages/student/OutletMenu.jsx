import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import BackButton from '../../components/common/BackButton';

import { catalogService } from '../../services/api/catalogService';
import { orderService } from '../../services/api/orderService';

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

  const [outlet, setOutlet] = useState(null);
  const [menuSections, setMenuSections] = useState([]);
  const [flatMenuItems, setFlatMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [cart, setCart] = useState({});
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

  // Place the order from the local cart, then try to initialise payment.
  const handleOrderNow = async () => {
    if (placingOrder) return;
    const entries = Object.entries(cart).filter(([, qty]) => qty > 0);
    if (entries.length === 0) return;
    try {
      setPlacingOrder(true);
      const res = await orderService.createOrder({
        outletId: id,
        items: entries.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      });
      const order = res.data || {};
      setCart({});
      setIsCartOpen(false);
      alert(`Order ${order.orderNumber || ''} placed! Complete the payment at the outlet or from your orders.`);
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
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  // Filter sections by search query (for normal render)
  const filteredMenu = menuSections.map(section => ({
    ...section,
    items: section.items.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
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
