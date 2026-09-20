import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import FoodCard from '../../components/food/FoodCard';
import CartDrawer from '../../components/food/CartDrawer';

// Mock data
const MOCK_OUTLET_DETAILS = {
  '1': { id: '1', name: 'The Courtyard Café', desc: 'Fresh meals, snacks and beverages', status: 'Open', prepTime: '10-15 min', rating: '4.8' },
  '2': { id: '2', name: 'Campus Thali Co.', desc: 'Home-style thalis cooked in small batches', status: 'Open', prepTime: '15-20 min', rating: '4.7' },
  '3': { id: '3', name: 'Dosa District', desc: 'Crisp dosas, idli plates and filter coffee', status: 'Open', prepTime: '12-18 min', rating: '4.9' }
};

const MOCK_MENU = [
  {
    category: 'Popular',
    image: 'https://via.placeholder.com/60?text=Pop',
    items: [
      { id: 'f1', name: 'Masala Dosa', description: 'Crispy rice crepe filled with spiced potatoes.', price: 90, available: true, image: '/images/dosa.jpg' },
      { id: 'f2', name: 'Veg Cheese Burger', description: 'Classic vegetable patty with melting cheese.', price: 80, available: true, image: null },
      { id: 'f3', name: 'Cold Coffee', description: 'Classic thick cold coffee.', price: 80, available: true, image: null },
    ]
  },
  {
    category: 'Burgers',
    image: 'https://via.placeholder.com/60?text=Brg',
    items: [
      { id: 'f4', name: 'Aloo Tikki Burger', description: 'Crispy potato patty with herb mayo.', price: 60, available: true, image: null },
      { id: 'f5', name: 'Double Cheese Burger', description: 'Extra cheese and double patty.', price: 110, available: true, image: null },
    ]
  },
  {
    category: 'Fries',
    image: 'https://via.placeholder.com/60?text=Fry',
    items: [
      { id: 'f6', name: 'Classic Salted Fries', description: 'Crispy golden french fries.', price: 70, available: true, image: null },
      { id: 'f7', name: 'Peri Peri Fries', description: 'Spicy peri peri tossed fries.', price: 90, available: true, image: null },
    ]
  },
  {
    category: 'Sandwiches',
    image: 'https://via.placeholder.com/60?text=Snd',
    items: [
      { id: 'f8', name: 'Veg Grilled Sandwich', description: 'Fresh veggies grilled to perfection.', price: 80, available: true, image: null },
      { id: 'f9', name: 'Mumbai Masala Sandwich', description: 'Spicy potato filling with green chutney.', price: 90, available: true, image: null },
    ]
  },
  {
    category: 'Wraps',
    image: 'https://via.placeholder.com/60?text=Wrp',
    items: [
      { id: 'f10', name: 'Paneer Tikka Wrap', description: 'Smoky paneer wrapped in a paratha.', price: 130, available: true, image: null },
      { id: 'f11', name: 'Veg Falafel Wrap', description: 'Crispy falafel with garlic sauce.', price: 110, available: false, image: null },
    ]
  },
  {
    category: 'Maggi',
    image: 'https://via.placeholder.com/60?text=Mag',
    items: [
      { id: 'f12', name: 'Classic Masala Maggi', description: 'Everyone\'s favorite instant noodles.', price: 50, available: true, image: null },
      { id: 'f13', name: 'Cheese Burst Maggi', description: 'Maggi loaded with melted cheese.', price: 80, available: true, image: null },
    ]
  },
  {
    category: 'Shakes',
    image: 'https://via.placeholder.com/60?text=Shk',
    items: [
      { id: 'f14', name: 'Oreo Shake', description: 'Thick shake blended with Oreo cookies.', price: 100, available: true, image: null },
      { id: 'f15', name: 'KitKat Shake', description: 'Chocolaty shake with KitKat crunch.', price: 110, available: true, image: null },
    ]
  },
  {
    category: 'Tea & Coffee',
    image: 'https://via.placeholder.com/60?text=Tea',
    items: [
      { id: 'f16', name: 'Masala Chai', description: 'Spiced Indian tea.', price: 20, available: true, image: null },
      { id: 'f17', name: 'Hot Cappuccino', description: 'Freshly brewed espresso with steamed milk.', price: 70, available: true, image: null },
    ]
  },
  {
    category: 'Beverages',
    image: 'https://via.placeholder.com/60?text=Bev',
    items: [
      { id: 'f18', name: 'Lemon Iced Tea', description: 'Refreshing sweet and tangy tea.', price: 60, available: true, image: null },
      { id: 'f19', name: 'Fresh Lime Soda', description: 'Sweet and salted lime soda.', price: 50, available: true, image: null },
    ]
  }
];

const OutletMenu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const outlet = MOCK_OUTLET_DETAILS[id] || MOCK_OUTLET_DETAILS['1'];
  
  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(MOCK_MENU[0].category);
  
  // Refs for scroll spy
  const sectionRefs = useRef({});

  // Setup scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200; // Offset for header

      for (const section of MOCK_MENU) {
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
  }, []);

  const scrollToCategory = (category) => {
    setActiveCategory(category);
    const element = sectionRefs.current[category];
    if (element) {
      // Smooth scroll with offset for the sticky headers
      const offset = 140; 
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
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
    const item = MOCK_MENU.flatMap(cat => cat.items).find(i => i.id === itemId);
    return total + (item ? item.price * qty : 0);
  }, 0);

  // Filter sections by search query
  const filteredMenu = MOCK_MENU.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  })).filter(section => section.items.length > 0);

  // Flatten all menu items for the CartDrawer to look up prices/names
  const flatMenuItems = MOCK_MENU.flatMap(cat => cat.items);

  return (
    <div className="page-wrapper bg-white">
      <Header cartCount={cartItemsCount} onCartClick={() => setIsCartOpen(true)} />
      
      {/* Outlet Banner */}
      <div className="outlet-banner">
        <div className="banner-content">
          <div className="banner-left">
            <button className="icon-btn back-btn" onClick={() => navigate('/student')} style={{ border: 'none', background: '#f3f4f6', marginBottom: '1rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <div className="banner-details">
              <h1 className="banner-title">{outlet.name}</h1>
              <p className="banner-desc">{outlet.desc}</p>
              <div className="banner-meta">
                <span className="status-badge active"><span className="status-dot"></span>{outlet.status}</span>
                <span className="meta-info">★ {outlet.rating}</span>
                <span className="meta-info">⏱ {outlet.prepTime}</span>
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
        
        {/* Sticky Sidebar */}
        <aside className="category-sidebar">
          <ul className="category-list">
            {MOCK_MENU.map(section => (
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

        {/* Menu Content */}
        <main className="menu-content">
          <div className="menu-sections">
            {filteredMenu.length > 0 ? (
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
        menuItems={flatMenuItems}
        outletName={outlet.name}
        onUpdateQuantity={handleUpdateQuantity}
      />
    </div>
  );
};

export default OutletMenu;
