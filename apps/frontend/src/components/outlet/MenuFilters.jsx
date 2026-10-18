import React from 'react';

const MenuFilters = ({ categories, activeCategory, setActiveCategory, onEditCategory, outletCategories = [] }) => {
  const outletCatMap = React.useMemo(() => {
    const map = new Map();
    (outletCategories || []).forEach(c => {
      if (c && c.name) map.set(c.name, c);
    });
    return map;
  }, [outletCategories]);

  return (
    <div className="menu-filters-wrapper">
      <div className="menu-filters">
        <button 
          className={`filter-pill ${activeCategory === 'All' ? 'active' : ''}`}
          onClick={() => setActiveCategory('All')}
        >
          All
        </button>
        {categories.map(category => {
          const catObj = outletCatMap.get(category);
          return (
            <button 
              key={category}
              className={`filter-pill ${activeCategory === category ? 'active' : ''}`}
              onClick={() => setActiveCategory(category)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>{category}</span>
              {catObj && onEditCategory && (
                <span 
                  title={`Edit category "${category}"`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCategory(catObj);
                  }}
                  style={{
                    fontSize: '0.75rem',
                    opacity: 0.8,
                    cursor: 'pointer',
                    padding: '0 2px',
                    borderRadius: '4px',
                  }}
                >
                  ✎
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MenuFilters;
