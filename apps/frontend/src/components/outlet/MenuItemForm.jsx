import React, { useState, useEffect } from 'react';

const CATEGORIES = [
  'Popular', 'Meals', 'Snacks', 'Beverages', 'Desserts', 'Healthy',
  'Burgers', 'Fries', 'Sandwiches', 'Wraps', 'Maggi', 'Shakes'
];

const MenuItemForm = ({ item, onSubmit, onCancel, isSaving, onDelete }) => {
  const isEditMode = !!item;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'Popular',
    image: '',
    isAvailable: true
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        price: item.price || '',
        category: item.category || 'Popular',
        image: item.image || '',
        isAvailable: item.isAvailable !== false
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: Number(formData.price)
    });
  };

  if (showDeleteConfirm) {
    return (
      <div className="modal-overlay">
        <div className="delete-confirm-modal">
          <h3>Delete "{item?.name}"?</h3>
          <p>This item will be permanently removed from your menu.</p>
          <div className="modal-actions">
            <button 
              className="btn-cancel" 
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="btn-danger" 
              onClick={() => onDelete(item.id)}
              disabled={isSaving}
            >
              {isSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="menu-form-modal">
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
          <button className="close-btn" onClick={onCancel}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="menu-form">
          <div className="form-group">
            <label>Name</label>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              required 
              placeholder="e.g. Masala Dosa"
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              rows="2"
              placeholder="e.g. Crispy rice crepe filled with spiced potatoes."
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Price (₹)</label>
              <input 
                type="number" 
                name="price" 
                value={formData.price} 
                onChange={handleChange} 
                required 
                min="1"
              />
            </div>
            
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="form-group">
            <label>Image URL</label>
            <input 
              type="url" 
              name="image" 
              value={formData.image} 
              onChange={handleChange} 
              placeholder="https://..."
            />
          </div>
          
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                name="isAvailable" 
                checked={formData.isAvailable} 
                onChange={handleChange} 
              />
              Available for order
            </label>
          </div>
          
          <div className="modal-actions form-actions">
            {isEditMode && (
              <button 
                type="button" 
                className="btn-danger-outline" 
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Item
              </button>
            )}
            
            <div className="right-actions">
              <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
                Cancel
              </button>
              <button type="submit" className="btn-save" disabled={isSaving}>
                {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Add Item')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MenuItemForm;
