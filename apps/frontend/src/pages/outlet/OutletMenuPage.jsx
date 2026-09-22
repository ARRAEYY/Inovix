import React, { useState, useEffect, useMemo } from 'react';
import OutletLayout from '../../components/layout/OutletLayout';
import MenuSearch from '../../components/outlet/MenuSearch';
import MenuFilters from '../../components/outlet/MenuFilters';
import MenuItemCard from '../../components/outlet/MenuItemCard';
import { menuService } from '../../services/api/menuService';
import '../../styles/outlet-menu.css';

const CATEGORIES = [
  'Popular', 'Burgers', 'Fries', 'Sandwiches', 'Wraps', 'Maggi', 'Beverages', 'Shakes', 'Meals', 'Snacks', 'Desserts', 'Healthy'
];

const OutletMenuPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await menuService.getOutletMenu();
      setItems(res.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load menu items.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, activeCategory]);

  const handleToggleAvailability = async (item) => {
    // Prevent double clicks
    if (item.isUpdatingAvailability) return;
    
    try {
      const updatedStatus = !item.isAvailable;
      
      // Optimistic update with loading state
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isAvailable: updatedStatus, isUpdatingAvailability: true } : i
      ));
      
      await menuService.updateAvailability(item.id, updatedStatus);
      
      // Clear loading state and show success
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isUpdatingAvailability: false } : i
      ));
      
      // Optional: Add toast notification if there's a toast system. 
      // For now, using a simple console/alert or just silent success as it's visually obvious.
    } catch (err) {
      console.error("Failed to toggle availability", err);
      alert(`Failed to mark ${item.name} as ${!item.isAvailable ? 'available' : 'unavailable'}. Reverting.`);
      // Revert on failure
      fetchMenu();
    }
  };

  return (
    <OutletLayout>
      <div className="menu-management-page">
        <div className="menu-page-header">
          <div className="header-text">
            <h1>Menu Availability</h1>
            <p>Manage the availability of items at your outlet.</p>
          </div>
        </div>

        <div className="menu-controls">
          <MenuSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          <MenuFilters 
            categories={CATEGORIES} 
            activeCategory={activeCategory} 
            setActiveCategory={setActiveCategory} 
          />
        </div>

        {error && <div className="error-banner">{error}</div>}
        
        {loading ? (
          <div className="loading-state">Loading menu...</div>
        ) : (
          <div className="menu-content-area" style={{ border: 'none', background: 'transparent' }}>
            <div className="food-grid">
              {filteredItems.map(item => (
                <MenuItemCard 
                  key={item.id} 
                  item={item} 
                  onToggleAvailability={handleToggleAvailability}
                  hideEdit={true}
                />
              ))}
            </div>
            {filteredItems.length === 0 && (
              <div className="empty-state">No items found matching your criteria.</div>
            )}
          </div>
        )}
      </div>
    </OutletLayout>
  );
};

export default OutletMenuPage;
