import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import client from '../../services/api/client';

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
    isAvailable: true,
    // Persisted by the backend menu service but previously missing from
    // this form ( menuItemCreateSchema: discount/popular/vegetarian/preparationTime )
    discount: '',
    popular: false,
    vegetarian: false,
    preparationTime: ''
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        description: item.description || '',
        price: item.price || '',
        category: item.category || 'Popular',
        image: item.image || '',
        isAvailable: item.isAvailable !== false,
        discount: item.discount != null ? String(item.discount) : '',
        popular: !!item.popular,
        vegetarian: !!item.vegetarian,
        preparationTime: item.prepTimeMins ? String(item.prepTimeMins) : ''
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // Cloudinary signed upload flow:
  // 1. POST /uploads/sign { folder: 'menu-items' } → get signed payload
  // 2. Upload the file to Cloudinary via the signed URL (FormData)
  // 3. Store the resulting secure_url in formData.image
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB');
      return;
    }
    try {
      setUploading(true);
      // Step 1: get the signed upload payload from the backend
      const signRes = await client.post('/uploads/sign', { folder: 'menu-items' });
      const sign = signRes.data?.data || {};
      if (!sign.uploadUrl || !sign.signature) {
        throw new Error('Failed to get upload signature');
      }
      // Step 2: upload to Cloudinary via the signed URL
      const fd = new FormData();
      fd.append('file', file);
      fd.append('api_key', sign.apiKey);
      fd.append('timestamp', sign.timestamp);
      fd.append('signature', sign.signature);
      if (sign.publicId) fd.append('public_id', sign.publicId);
      if (sign.folder) fd.append('folder', sign.folder);
      const uploadRes = await fetch(sign.uploadUrl, { method: 'POST', body: fd });
      if (!uploadRes.ok) throw new Error('Cloudinary upload failed');
      const uploadData = await uploadRes.json();
      // Step 3: store the secure_url in the form
      setFormData(prev => ({ ...prev, image: uploadData.secure_url }));
      toast('Image uploaded successfully');
    } catch (err) {
      toast(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      price: Number(formData.price),
      discount: formData.discount === '' ? undefined : Number(formData.discount),
      preparationTime: formData.preparationTime === '' ? undefined : Number(formData.preparationTime),
    });
  };

  if (showDeleteConfirm) {
    return (
      <div className="modal-overlay" onClick={onCancel}>
        <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
          <h3>Delete "{item?.name}"?</h3>
          <p>This item will be permanently removed from your menu.</p>
          <div className="modal-actions">
            <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            <button className="btn-delete" onClick={() => onDelete()}>Delete</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-item-form">
      <div className="form-group">
        <label>Item Name</label>
        <input type="text" name="name" value={formData.name} onChange={handleChange} required />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={2} />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Price (₹)</label>
          <input type="number" name="price" value={formData.price} onChange={handleChange} required min="0" step="0.01" />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select name="category" value={formData.category} onChange={handleChange}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Discount (₹, optional)</label>
          <input type="number" name="discount" value={formData.discount} onChange={handleChange} min="0" step="0.01" placeholder="0" />
        </div>
        <div className="form-group">
          <label>Prep time (mins, optional)</label>
          <input type="number" name="preparationTime" value={formData.preparationTime} onChange={handleChange} min="0" step="1" placeholder="e.g. 10" />
        </div>
      </div>
      <div className="form-group" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input type="checkbox" name="vegetarian" checked={formData.vegetarian} onChange={handleChange} />
          🟢 Vegetarian
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
          <input type="checkbox" name="popular" checked={formData.popular} onChange={handleChange} />
          ⭐ Mark as popular
        </label>
      </div>
      {/* Cloudinary image upload */}
      <div className="form-group">
        <label>Item Image</label>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {formData.image && (
            <img src={formData.image} alt="Preview" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }} />
          )}
          <div>
            <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading}
              style={{ fontSize: '0.85rem' }} />
            {uploading && <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>Uploading…</span>}
          </div>
        </div>
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" name="isAvailable" checked={formData.isAvailable} onChange={handleChange} />
          Available for ordering
        </label>
      </div>
      <div className="form-actions">
        {isEditMode && (
          <button type="button" className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
        )}
        <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn-primary" onClick={handleSubmit} disabled={isSaving || uploading}>
          {isSaving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </div>
  );
};

export default MenuItemForm;
