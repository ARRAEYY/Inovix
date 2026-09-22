import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';
import MobileBottomNav from '../../components/layout/MobileBottomNav';
import BackButton from '../../components/common/BackButton';

import { catalogService } from '../../services/api/catalogService';

// Mock data for outlet details until we fetch them dynamically
const MOCK_OUTLET_DETAILS = {
  '1': { id: '1', name: 'The Courtyard Café', desc: 'Fresh meals, snacks and beverages', status: 'Open', prepTime: '10-15 min', rating: '4.8' },
  '2': { id: '2', name: 'Campus Thali Co.', desc: 'Home-style thalis cooked in small batches', status: 'Open', prepTime: '15-20 min', rating: '4.7' },
  '3': { id: '3', name: 'Dosa District', desc: 'Crisp dosas, idli plates and filter coffee', status: 'Open', prepTime: '12-18 min', rating: '4.9' }
};

// Helper to get category placeholder image
const getCategoryImage = (categoryName) => {
  const images = {
    'Popular': 'https://via.placeholder.com/60?text=Pop',
    'Burgers': 'https://via.placeholder.com/60?text=Brg',
    'Fries': 'https://via.placeholder.com/60?text=Fry',
    'Sandwiches': 'https://via.placeholder.com/60?text=Snd',
    'Wraps': 'https://via.placeholder.com/60?text=Wrp',
    'Maggi': 'https://via.placeholder.com/60?text=Mag',
    'Shakes': 'https://via.placeholder.com/60?text=Shk',
    'Beverages': 'https://via.placeholder.com/60?text=Bev',
    'Meals': 'https://via.placeholder.com/60?text=Meal',
    'Desserts': 'https://via.placeholder.com/60?text=Des'
  };
  return images[categoryName] || 'https://via.placeholder.com/60?text=Food';
};

const OutletMenu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const outlet = MOCK_OUTLET_DETAILS[id] || MOCK_OUTLET_DETAILS['1'];

  const [menuSections, setMenuSections] = useState([]);
  const [flatMenuItems, setFlatMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
        // Using 'outlet-1' as hardcoded ID mapping if it's '1' for mock compatibility
        const actualOutletId = id === '1' ? 'outlet-1' : (id === '2' ? 'outlet-2' : id);
        
        const res = await catalogService.getOutletMenu(actualOutletId);
        const items = res.data || [];
        setFlatMenuItems(items);

        // Group by category
        const grouped = items.reduce((acc, item) => {
          if (!acc[item.category]) {
            acc[item.category] = {
              category: item.category,
              image: getCategoryImage(item.category),
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
      } catch (error) {
        console.error('Failed to fetch menu:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, [id]);

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
              <h1 className="banner-title" style={{ marginBottom: 0 }}>{outlet.name}</h1>
            </div>
            <p className="banner-desc" style={{ paddingLeft: 'calc(24px + 0.5rem)' }}>{outlet.desc}</p>
            <div className="banner-meta" style={{ paddingLeft: 'calc(24px + 0.5rem)' }}>
                <span className="status-badge active"><span className="status-dot"></span>{outlet.status}</span>
                <span className="meta-info">★ {outlet.rating}</span>
                <span className="meta-info">⏱ {outlet.prepTime}</span>
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
                      <img src={section.image} alt={section.category} />
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
            {isSearching ? (
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
        outletName={outlet.name}
        onUpdateQuantity={handleUpdateQuantity}
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
