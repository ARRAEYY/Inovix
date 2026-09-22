import React, { useState, useEffect, useMemo } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import MenuSearch from '../../../components/outlet/MenuSearch';
import MenuFilters from '../../../components/outlet/MenuFilters';
import MenuItemCard from '../../../components/outlet/MenuItemCard';
import MenuItemForm from '../../../components/outlet/MenuItemForm';
import { getMenu, createMenuItem, updateMenuItem, deleteMenuItem, updateMenuAvailability } from '../../../services/outletAdminService';
import '../../../styles/outlet-menu.css';

const CATEGORIES = [
  'Popular', 'Burgers', 'Fries', 'Sandwiches', 'Wraps', 'Maggi', 'Beverages', 'Shakes', 'Meals', 'Snacks', 'Desserts', 'Healthy'
];

const OutletAdminMenu = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await getMenu();
      setItems(res.data || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load menu items.');
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

  const handleOpenAddForm = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleToggleAvailability = async (item) => {
    if (item.isUpdatingAvailability) return;
    
    try {
      const updatedStatus = !item.isAvailable;
      
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isAvailable: updatedStatus, isUpdatingAvailability: true } : i
      ));
      
      await updateMenuAvailability(item.id, updatedStatus);
      
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, isUpdatingAvailability: false } : i
      ));
      
    } catch (err) {
      console.error("Failed to toggle availability", err);
      alert(`Failed to mark ${item.name} as ${!item.isAvailable ? 'available' : 'unavailable'}. Reverting.`);
      fetchMenu();
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      setIsSaving(true);
      if (editingItem) {
        await updateMenuItem(editingItem.id, formData);
      } else {
        await createMenuItem(formData);
      }
      await fetchMenu();
      handleCloseForm();
    } catch (err) {
      console.error("Failed to save item", err);
      alert(err.message || 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!editingItem?.id) return;
    try {
      setIsSaving(true);
      await deleteMenuItem(editingItem.id);
      await fetchMenu();
      handleCloseForm();
    } catch (err) {
      console.error("Failed to delete item", err);
      alert(err.message || 'Failed to delete item');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <OutletAdminLayout>
      <div className="menu-management-page">
        <div className="menu-page-header">
          <div className="header-text">
            <h1>Menu Management</h1>
            <p>Manage the food and beverages available at your outlet.</p>
          </div>
          <button className="add-item-btn" onClick={handleOpenAddForm}>
            + Add Item
          </button>
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
                  onEdit={() => handleOpenEditForm(item)}
                  onToggleAvailability={handleToggleAvailability}
                />
              ))}
            </div>
            {filteredItems.length === 0 && (
              <div className="empty-state">No items found matching your criteria.</div>
            )}
          </div>
        )}

        {/* Modal overlays */}
        {isFormOpen && (
          <div className="modal-overlay">
            <div className="modal-content form-modal">
              <div className="modal-header">
                <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                <button className="close-btn" onClick={handleCloseForm}>&times;</button>
              </div>
              <MenuItemForm 
                item={editingItem} 
                onSubmit={handleFormSubmit} 
                onCancel={handleCloseForm}
                isSaving={isSaving}
                onDelete={editingItem ? handleDeleteItem : undefined}
              />
            </div>
          </div>
        )}
      </div>
    </OutletAdminLayout>
  );
};

export default OutletAdminMenu;
