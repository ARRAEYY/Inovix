import React, { useState } from 'react';
import Header from '../../components/layout/Header';
import OutletCard from '../../components/food/OutletCard';
import { useAuth } from '../../hooks/useAuth';

const MOCK_OUTLETS = [
  {
    id: 1,
    name: 'The Courtyard Café',
    description: 'Sandwiches, grain bowls and single-origin coffee, a minute from the lecture halls.',
    image: '/images/cafe.jpg',
    active: true,
    rating: '4.8',
    time: '10-15',
    location: 'Academic Block'
  },
  {
    id: 2,
    name: 'Campus Thali Co.',
    description: 'Home-style thalis cooked in small batches through the day.',
    image: '/images/thali.jpg',
    active: true,
    rating: '4.7',
    time: '15-20',
    location: 'Dining Hall'
  },
  {
    id: 3,
    name: 'Dosa District',
    description: 'Crisp dosas, idli plates and filter coffee served till late.',
    image: '/images/dosa.jpg',
    active: true,
    rating: '4.9',
    time: '12-18',
    location: 'Hostel Square'
  }
];

const FILTERS = ['All', 'Open now'];

const Home = () => {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOutlets = MOCK_OUTLETS.filter(outlet => {
    const matchesSearch = 
      outlet.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      outlet.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = activeFilter === 'All' ? true : outlet.active;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="page-wrapper">
      <Header />
      
      <main className="explore-container">
        <div className="page-header">
          <p className="welcome-greeting">Welcome back, {user?.name || 'Student'}</p>
          <h1 className="page-title">Explore Outlets</h1>
          <p className="page-subtitle">Order from your favorite campus outlets</p>
        </div>

        <div className="controls-row">
          <div className="search-container">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search outlets, cuisines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="shortcut-hint">/</div>
          </div>

          <div className="filter-pills">
            {FILTERS.map(filter => (
              <button 
                key={filter} 
                className={`pill ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {filteredOutlets.length > 0 ? (
          <div className="outlets-grid">
            {filteredOutlets.map(outlet => (
              <OutletCard key={outlet.id} outlet={outlet} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)' }}>
            <p>No outlets found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Home;
