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
  }
];

const categories = [
  'Popular', 'Meals', 'Snacks', 'Beverages', 'Desserts', 'Healthy'
];

const menuItems = [
  {
    id: 'item-1',
    outletId: 'outlet-1',
    name: 'Miso sesame grain bowl',
    description: 'Healthy grain bowl with fresh veggies and miso dressing.',
    price: 150,
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80',
    isAvailable: true,
    discount: null,
    popular: true,
    vegetarian: true,
    preparationTime: 15
  },
  {
    id: 'item-2',
    outletId: 'outlet-1',
    name: 'Campus club sandwich',
    description: 'Triple decker sandwich with chicken, lettuce, and mayo.',
    price: 120,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80',
    isAvailable: true,
    discount: '10%',
    popular: true,
    vegetarian: false,
    preparationTime: 10
  },
  {
    id: 'item-3',
    outletId: 'outlet-2',
    name: 'Cold brew coffee',
    description: 'Overnight steeped cold brew.',
    price: 90,
    category: 'Beverages',
    image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80',
    isAvailable: true,
    discount: null,
    popular: true,
    vegetarian: true,
    preparationTime: 5
  },
  {
    id: 'item-4',
    outletId: 'outlet-3',
    name: 'Paneer Butter Masala Thali',
    description: 'Served with 3 rotis, rice, and dal.',
    price: 180,
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80',
    isAvailable: false,
    discount: null,
    popular: false,
    vegetarian: true,
    preparationTime: 20
  }
];

const orders = [
  {
    id: 'ORD-1001',
    studentId: 'user-1',
    outletId: 'outlet-1',
    items: [
      { menuItemId: 'item-1', quantity: 1, price: 150 },
      { menuItemId: 'item-2', quantity: 2, price: 120 }
    ],
    total: 390,
    status: 'COMPLETED',
    createdAt: '2023-10-25T10:30:00Z'
  },
  {
    id: 'ORD-1002',
    studentId: 'user-1',
    outletId: 'outlet-2',
    items: [
      { menuItemId: 'item-3', quantity: 1, price: 90 }
    ],
    total: 90,
    status: 'PREPARING',
    createdAt: new Date().toISOString()
  }
];

module.exports = {
  students,
  outlets,
  categories,
  menuItems,
  orders
};
