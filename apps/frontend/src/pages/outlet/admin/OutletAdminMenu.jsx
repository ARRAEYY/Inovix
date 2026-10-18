import React, { useState, useEffect, useMemo } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import MenuSearch from '../../../components/outlet/MenuSearch';
import MenuFilters from '../../../components/outlet/MenuFilters';
import MenuItemCard from '../../../components/outlet/MenuItemCard';
import MenuItemForm from '../../../components/outlet/MenuItemForm';
import CategoryForm from '../../../components/outlet/CategoryForm';
import client from '../../../services/api/client';
import { getMenu, createMenuItem, updateMenuItem, deleteMenuItem, updateMenuAvailability } from '../../../services/outletAdminService';
import '../../../styles/outlet-menu.css';
import { toast } from 'react-hot-toast';

const CATEGORIES = [
  'Popular', 'Burgers', 'Fries', 'Sandwiches', 'Wraps', 'Maggi', 'Beverages', 'Shakes', 'Meals', 'Snacks', 'Desserts', 'Healthy'
];

// Map a backend menu item onto the fields MenuItemCard / MenuItemForm read
// (`category` arrives as an object; the image column is `imageUrl`).
const mapMenuItem = (item) => ({
  ...item,
  category: item.category?.name || 'Other',
  image: item.imageUrl || null,
  price: Number(item.price),
});

const OutletAdminMenu = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Category modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [isCategorySaving, setIsCategorySaving] = useState(false);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await getMenu();
      try {
        const catRes = await client.get('/outlet/menu/categories');
        setCategories(catRes.data?.data || []);
      } catch {}
      setItems((res.data || []).map(mapMenuItem));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load menu items.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterCategories = useMemo(() => {
    const fromOutlet = categories.map((c) => c.name).filter(Boolean);
    const fromItems = items.map((i) => i.category).filter(Boolean);
    const set = new Set([...fromOutlet, ...fromItems, ...CATEGORIES]);
    return Array.from(set);
  }, [categories, items]);

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

  // Category handlers
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setIsCategoryModalOpen(false);
    setEditingCategory(null);
  };

  const handleCategorySubmit = async (catData) => {
    try {
      setIsCategorySaving(true);
      if (editingCategory) {
        await client.patch(`/outlet/menu/categories/${editingCategory.id}`, catData);
        toast.success(`Category "${catData.name}" updated`);
      } else {
        await client.post('/outlet/menu/categories', catData);
        toast.success(`Category "${catData.name}" created`);
      }
      await fetchMenu();
      handleCloseCategoryModal();
    } catch (err) {
      console.error('Failed to save category', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to save category');
    } finally {
      setIsCategorySaving(false);
    }
  };

  const handleCategoryDelete = async () => {
    if (!editingCategory?.id) return;
    try {
      setIsCategorySaving(true);
      await client.delete(`/outlet/menu/categories/${editingCategory.id}`);
      toast.success('Category deleted');
      await fetchMenu();
      handleCloseCategoryModal();
    } catch (err) {
      console.error('Failed to delete category', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to delete category');
    } finally {
      setIsCategorySaving(false);
    }
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
      toast(`Failed to mark ${item.name} as ${!item.isAvailable ? 'available' : 'unavailable'}. Reverting.`);
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
      toast(err.response?.data?.message || err.message || 'Failed to save item');
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
      toast(err.response?.data?.message || err.message || 'Failed to delete item');
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
          <div className="header-actions">
            <button
              type="button"
              className="add-category-btn"
              onClick={handleOpenAddCategory}
            >
              + Add Category
            </button>
            <button
              type="button"
              className="add-item-btn"
              onClick={handleOpenAddForm}
            >
              + Add Item
            </button>
          </div>
        </div>

        <div className="menu-controls">
          <MenuSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          <MenuFilters 
            categories={filterCategories} 
            activeCategory={activeCategory} 
            setActiveCategory={setActiveCategory}
            onEditCategory={handleOpenEditCategory}
            outletCategories={categories}
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

        {/* Item Modal overlay */}
        {isFormOpen && (
          <div className="modal-overlay" onClick={handleCloseForm}>
            <div
              className="modal-content form-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '520px',
                width: '100%',
                background: 'white',
                borderRadius: '14px',
                padding: '1.5rem',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              }}
            >
              <div
                className="modal-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                  {editingItem ? 'Edit Item' : 'Add New Item'}
                </h2>
                <button
                  className="close-btn"
                  onClick={handleCloseForm}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
                >
                  &times;
                </button>
              </div>
              <MenuItemForm 
                item={editingItem} 
                onSubmit={handleFormSubmit} 
                onCancel={handleCloseForm}
                isSaving={isSaving}
                onDelete={editingItem ? handleDeleteItem : undefined}
                availableCategories={categories}
              />
            </div>
          </div>
        )}

        {/* Category Modal overlay */}
        {isCategoryModalOpen && (
          <div className="modal-overlay" onClick={handleCloseCategoryModal}>
            <div
              className="modal-content form-modal"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: '440px',
                width: '100%',
                background: 'white',
                borderRadius: '14px',
                padding: '1.5rem',
                boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
              }}
            >
              <div
                className="modal-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
                <button
                  className="close-btn"
                  onClick={handleCloseCategoryModal}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
                >
                  &times;
                </button>
              </div>
              <CategoryForm
                category={editingCategory}
                onSubmit={handleCategorySubmit}
                onCancel={handleCloseCategoryModal}
                isSaving={isCategorySaving}
                onDelete={editingCategory ? handleCategoryDelete : undefined}
              />
            </div>
          </div>
        )}
      </div>
    </OutletAdminLayout>
  );
};

export default OutletAdminMenu;
