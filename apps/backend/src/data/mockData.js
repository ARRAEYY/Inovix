const students = [
  {
    id: 'user-1',
    name: 'Adil Reyaz',
    email: 'adil@rishihood.edu.in',
    phone: '9876543210',
    course: 'BTech CS & AI',
    year: '2',
    collegeId: 'RU12345',
    onboardingCompleted: true,
  }
];

const outlets = [
  {
    id: 'outlet-1',
    name: 'The Commons',
    description: 'Main campus cafeteria serving meals and snacks.',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80',
    tags: ['Meals', 'Beverages'],
    location: 'Block A, Ground Floor',
    rating: 4.5,
    estimatedTime: '15-20 min',
    status: 'OPEN',
    featured: true
  },
  {
    id: 'outlet-2',
    name: 'Brew & Bites',
    description: 'Fresh coffee, pastries, and quick bites.',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&q=80',
    tags: ['Coffee', 'Snacks'],
    location: 'Library Hub',
    rating: 4.8,
    estimatedTime: '5-10 min',
    status: 'BUSY',
    featured: true
  },
  {
    id: 'outlet-3',
    name: 'Curry Corner',
    description: 'Authentic Indian curries and thalis.',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80',
    tags: ['Indian', 'Meals'],
    location: 'Block B, 1st Floor',
    rating: 4.2,
    estimatedTime: '20-25 min',
    status: 'CLOSED',
    featured: false
  },
  {
    id: 'mock-outlet-adil',
    name: 'Adilreyaz Food Hub',
    description: 'Delicious quick bites and premium meals curated for dev.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
    tags: ['Meals', 'Snacks', 'Beverages'],
    location: 'Dev Campus, Level 42',
    rating: 4.9,
    estimatedTime: '10-15 min',
    status: 'OPEN',
    featured: true
  },
  {
    id: 'outlet-4',
    name: 'Student Hub',
    description: 'Quick bites and energy drinks for study sessions.',
    image: 'https://images.unsplash.com/photo-1563227812-0ea4c22e6cc8?w=500&q=80',
    tags: ['Snacks', 'Beverages'],
    location: 'Student Center',
    rating: 4.6,
    estimatedTime: '5-10 min',
    status: 'OPEN',
    featured: false
  },
  {
    id: 'outlet-5',
    name: 'Green Bowl',
    description: 'Healthy salads and organic meals.',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
    tags: ['Healthy', 'Meals'],
    location: 'Block C, Ground Floor',
    rating: 4.7,
    estimatedTime: '10-15 min',
    status: 'OPEN',
    featured: true
  }
];

const categories = [
  'Popular', 'Meals', 'Snacks', 'Beverages', 'Desserts', 'Healthy',
  'Burgers', 'Fries', 'Sandwiches', 'Wraps', 'Maggi', 'Shakes'
];

const menuItems = [
  {
    id: 'item-1', outletId: 'outlet-1', name: 'Masala Dosa',
    description: 'Crispy rice crepe filled with spiced potatoes.',
    price: 90, category: 'Popular', image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 10
  },
  {
    id: 'item-2', outletId: 'outlet-1', name: 'Veg Cheese Burger',
    description: 'Classic vegetable patty with melted cheese.',
    price: 80, category: 'Burgers', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 15
  },
  {
    id: 'item-3', outletId: 'outlet-1', name: 'French Fries',
    description: 'Crispy golden fries seasoned with herbs.',
    price: 60, category: 'Fries', image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-4', outletId: 'outlet-1', name: 'Veg Sandwich',
    description: 'Fresh vegetables and cheese layered between toasted bread.',
    price: 70, category: 'Sandwiches', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-5', outletId: 'outlet-1', name: 'Paneer Wrap',
    description: 'Spiced paneer, vegetables and sauces wrapped in a soft flatbread.',
    price: 100, category: 'Wraps', image: 'https://images.unsplash.com/photo-1588167389502-d3b10b0ff1da?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 10
  },
  {
    id: 'item-6', outletId: 'outlet-1', name: 'Masala Maggi',
    description: 'Classic Maggi noodles cooked with vegetables and spices.',
    price: 70, category: 'Maggi', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=500&q=80',
    isAvailable: false, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-7', outletId: 'outlet-1', name: 'Cold Coffee',
    description: 'Chilled creamy coffee.',
    price: 80, category: 'Beverages', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-8', outletId: 'outlet-1', name: 'Fresh Lime Soda',
    description: 'Refreshing lime soda.',
    price: 50, category: 'Beverages', image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 2
  },
  {
    id: 'item-9', outletId: 'outlet-1', name: 'Chocolate Shake',
    description: 'Creamy chocolate milkshake.',
    price: 100, category: 'Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75bf699?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-10', outletId: 'outlet-1', name: 'Strawberry Shake',
    description: 'Smooth strawberry milkshake.',
    price: 100, category: 'Shakes', image: 'https://images.unsplash.com/photo-1553177595-4de6bb080e5b?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-11', outletId: 'outlet-1', name: 'Chicken Cheese Burger',
    description: 'Crispy chicken patty with double cheese.',
    price: 120, category: 'Burgers', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: false, preparationTime: 15
  },
  {
    id: 'item-12', outletId: 'outlet-1', name: 'Peri Peri Fries',
    description: 'Crispy fries dusted with spicy peri peri seasoning.',
    price: 70, category: 'Fries', image: 'https://images.unsplash.com/photo-1573080496219-bb080e608f62?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-13', outletId: 'outlet-1', name: 'Cheese Maggi',
    description: 'Maggi noodles loaded with melted cheddar cheese.',
    price: 85, category: 'Maggi', image: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-14', outletId: 'outlet-1', name: 'Grilled Chicken Sandwich',
    description: 'Healthy grilled chicken breast in brown bread.',
    price: 110, category: 'Sandwiches', image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: false, preparationTime: 10
  },
  {
    id: 'item-15', outletId: 'outlet-1', name: 'Oreo Shake',
    description: 'Thick shake blended with crushed Oreos.',
    price: 110, category: 'Shakes', image: 'https://images.unsplash.com/photo-1572490122747-3968b75bf699?w=500&q=80',
    isAvailable: false, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  // Keep some data for other outlets to prevent breaking their mock screens
  {
    id: 'dev-item-1', outletId: 'mock-outlet-adil', name: 'Adil Special Burger',
    description: 'Double patty signature burger.', price: 250, category: 'Meals', image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
    isAvailable: true, discount: '20%', popular: true, vegetarian: false, preparationTime: 15
  },
  {
    id: 'item-16', outletId: 'outlet-4', name: 'Energy Drink',
    description: 'Chilled energy drink to keep you awake.',
    price: 60, category: 'Beverages', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 2
  },
  {
    id: 'item-17', outletId: 'outlet-4', name: 'Protein Bar',
    description: 'High protein snack for quick energy.',
    price: 50, category: 'Snacks', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 2
  },
  {
    id: 'item-18', outletId: 'outlet-5', name: 'Quinoa Salad',
    description: 'Fresh quinoa with mixed greens and vinaigrette.',
    price: 150, category: 'Healthy', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 12
  },
  {
    id: 'item-19', outletId: 'outlet-5', name: 'Fruit Bowl',
    description: 'Seasonal fresh fruits.',
    price: 80, category: 'Healthy', image: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?w=500&q=80',
    isAvailable: true, discount: null, popular: true, vegetarian: true, preparationTime: 5
  },
  {
    id: 'item-20', outletId: 'outlet-5', name: 'Green Smoothie',
    description: 'Spinach, apple, and celery blended to perfection.',
    price: 110, category: 'Beverages', image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500&q=80',
    isAvailable: true, discount: null, popular: false, vegetarian: true, preparationTime: 8
  }
];

const orders = [
  // 3 NEW (PLACED) orders
  {
    id: 'ORD-1042', userId: 'user-1', outletId: 'outlet-1',
    items: [
      { menuItemId: 'item-1', name: 'Masala Dosa', quantity: 1, price: 90 },
      { menuItemId: 'item-7', name: 'Cold Coffee', quantity: 1, price: 80 }
    ],
    total: 170, status: 'PLACED', createdAt: new Date().toISOString()
  },
  {
    id: 'ORD-1043', userId: 'user-2', outletId: 'outlet-1',
    items: [
      { menuItemId: 'item-2', name: 'Veg Cheese Burger', quantity: 2, price: 80 }
    ],
    total: 160, status: 'PLACED', createdAt: new Date().toISOString()
  },
  {
    id: 'ORD-1044', userId: 'user-3', outletId: 'outlet-1',
    items: [
      { menuItemId: 'item-5', name: 'Paneer Wrap', quantity: 1, price: 100 },
      { menuItemId: 'item-8', name: 'Fresh Lime Soda', quantity: 1, price: 50 }
    ],
    total: 150, status: 'PLACED', createdAt: new Date().toISOString()
  },

  // 4 PREPARING orders
  {
    id: 'ORD-1039', userId: 'user-4', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-11', name: 'Chicken Cheese Burger', quantity: 1, price: 120 }],
    total: 120, status: 'PREPARING', createdAt: new Date(Date.now() - 5 * 60000).toISOString()
  },
  {
    id: 'ORD-1040', userId: 'user-5', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-3', name: 'French Fries', quantity: 2, price: 60 }],
    total: 120, status: 'PREPARING', createdAt: new Date(Date.now() - 6 * 60000).toISOString()
  },
  {
    id: 'ORD-1041', userId: 'user-1', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-14', name: 'Grilled Chicken Sandwich', quantity: 1, price: 110 }],
    total: 110, status: 'PREPARING', createdAt: new Date(Date.now() - 8 * 60000).toISOString()
  },
  {
    id: 'ORD-1045', userId: 'user-2', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-13', name: 'Cheese Maggi', quantity: 1, price: 85 }],
    total: 85, status: 'PREPARING', createdAt: new Date(Date.now() - 10 * 60000).toISOString()
  },

  // 2 READY orders
  {
    id: 'ORD-1037', userId: 'user-3', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-9', name: 'Chocolate Shake', quantity: 2, price: 100 }],
    total: 200, status: 'READY', createdAt: new Date(Date.now() - 15 * 60000).toISOString()
  },
  {
    id: 'ORD-1038', userId: 'user-4', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-12', name: 'Peri Peri Fries', quantity: 1, price: 70 }],
    total: 70, status: 'READY', createdAt: new Date(Date.now() - 20 * 60000).toISOString()
  },

  // Multiple COMPLETED orders
  {
    id: 'ORD-1036', userId: 'user-5', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-2', name: 'Veg Cheese Burger', quantity: 1, price: 80 }],
    total: 80, status: 'COMPLETED', createdAt: new Date(Date.now() - 30 * 60000).toISOString()
  },
  {
    id: 'ORD-1035', userId: 'user-1', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-10', name: 'Strawberry Shake', quantity: 1, price: 100 }],
    total: 100, status: 'COMPLETED', createdAt: new Date(Date.now() - 45 * 60000).toISOString()
  },
  {
    id: 'ORD-1034', userId: 'user-2', outletId: 'outlet-1',
    items: [{ menuItemId: 'item-4', name: 'Veg Sandwich', quantity: 1, price: 70 }],
    total: 70, status: 'COMPLETED', createdAt: new Date(Date.now() - 60 * 60000).toISOString()
  }
];

module.exports = {
  students,
  outlets,
  categories,
  menuItems,
  orders
};
