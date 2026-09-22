import React from 'react';

const MenuFilters = ({ categories, activeCategory, setActiveCategory }) => {
  return (
    <div className="menu-filters-wrapper">
      <div className="menu-filters">
        <button 
          className={`filter-pill ${activeCategory === 'All' ? 'active' : ''}`}
          onClick={() => setActiveCategory('All')}
        >
          All
        </button>
        {categories.map(category => (
          <button 
            key={category}
            className={`filter-pill ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MenuFilters;
