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
    const set = new Set([...fromOutlet, ...CATEGORIES]);
    return Array.from(set);
  }, [categories]);

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
          <button className="add-item-btn" onClick={handleOpenAddForm}>
            + Add Item
          </button>
        </div>

        {/* Category Management */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            padding: '0.85rem 1.1rem',
            marginBottom: '1.25rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>Categories</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>
                {categories.length}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
                • Click any category to edit name & image
              </span>
            </div>
            <button
              onClick={handleOpenAddCategory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: '#b10035',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.9rem',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(177, 0, 53, 0.2)',
                transition: 'all 0.15s ease',
              }}
            >
              <span>+</span> Add Category
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {categories.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontStyle: 'italic' }}>
                No categories yet. Click "+ Add Category" to create one with name and image.
              </span>
            ) : (
              categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => handleOpenEditCategory(cat)}
                  title={`Click to edit "${cat.name}"`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: '#ffffff',
                    padding: '0.3rem 0.65rem 0.3rem 0.35rem',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#b10035';
                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(177, 0, 53, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e5e7eb';
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.03)';
                  }}
                >
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt={cat.name}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        objectFit: 'cover',
                        border: '1px solid #f3f4f6',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '6px',
                        background: '#f9fafb',
                        border: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.85rem',
                        flexShrink: 0,
                      }}
                    >
                      🍽️
                    </span>
                  )}
                  <span style={{ fontWeight: 600, color: '#1f2937' }}>{cat.name}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                    ({cat._count?.items || 0})
                  </span>
                  <span
                    style={{
                      color: '#b10035',
                      fontSize: '0.75rem',
                      marginLeft: '0.15rem',
                      opacity: 0.7,
                    }}
                  >
                    ✎
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="menu-controls">
          <MenuSearch searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
          <MenuFilters 
            categories={filterCategories} 
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
