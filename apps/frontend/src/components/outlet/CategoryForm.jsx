import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import client from '../../services/api/client';

const CategoryForm = ({ category, onSubmit, onCancel, isSaving, onDelete }) => {
  const isEditMode = !!category;
  const fileInputRef = useRef(null);

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setImageUrl(category.imageUrl || '');
    } else {
      setName('');
      setImageUrl('');
    }
  }, [category]);

  // Cloudinary signed upload flow:
  // 1. POST /uploads/sign { folder: 'categories' } → get signature
  // 2. Upload file directly to Cloudinary
  // 3. Store returned secure_url in state
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    try {
      setUploading(true);
      const signRes = await client.post('/uploads/sign', { folder: 'categories' });
      const sign = signRes.data?.data || {};
      if (!sign.uploadUrl || !sign.signature) {
        throw new Error('Failed to get upload signature');
      }

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
      setImageUrl(uploadData.secure_url);
      toast.success('Category image uploaded');
    } catch (err) {
      toast.error(err.message || 'Image upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Category name is required');
      return;
    }
    onSubmit({
      name: trimmed,
      imageUrl: imageUrl.trim() || null,
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      setIsDeleting(true);
      await onDelete();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete category');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (showDeleteConfirm) {
    return (
      <div className="delete-confirm-modal" style={{ margin: '0 auto' }}>
        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🗑️</div>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#111827', fontSize: '1.2rem', fontWeight: 700 }}>
          Delete "{category?.name}"?
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
          Menu items currently under this category will become uncategorized. This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
            style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            {isDeleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="category-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Category Name */}
      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>
          Category Name <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Burgers, Beverages, Combos"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          style={{
            padding: '0.7rem 0.85rem',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            fontSize: '0.95rem',
            outline: 'none',
          }}
        />
      </div>

      {/* Category Image Upload & Preview */}
      <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Category Image</span>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            style={{ background: 'none', border: 'none', color: '#b10035', fontSize: '0.78rem', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {showUrlInput ? 'Upload via file instead' : 'Or paste image URL'}
          </button>
        </label>

        {showUrlInput ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="url"
              placeholder="https://example.com/category-image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              style={{
                padding: '0.65rem 0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.88rem',
                outline: 'none',
              }}
            />
            {imageUrl && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  onError={(e) => { e.target.style.display = 'none'; }}
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', border: '1px solid #e5e7eb' }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Clear Image
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: '#f9fafb', padding: '0.75rem', borderRadius: '10px', border: '1px dashed #d1d5db' }}>
            {imageUrl ? (
              <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
                <img
                  src={imageUrl}
                  alt="Category preview"
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 10,
                    objectFit: 'cover',
                    border: '1px solid #e5e7eb',
                  }}
                />
                <button
                  type="button"
                  title="Remove image"
                  onClick={() => setImageUrl('')}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#dc2626',
                    color: 'white',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  color: '#9ca3af',
                  flexShrink: 0,
                  border: '1px solid #e5e7eb',
                }}
              >
                🍽️
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploading || isSaving}
                id="category-image-input"
                style={{ display: 'none' }}
              />
              <label
                htmlFor="category-image-input"
                style={{
                  display: 'inline-block',
                  padding: '0.45rem 0.85rem',
                  backgroundColor: uploading ? '#9ca3af' : '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  color: '#374151',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                {uploading ? 'Uploading…' : imageUrl ? 'Change Image' : 'Choose Image File'}
              </label>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                PNG, JPG or WebP (max 5MB)
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Form Action Buttons */}
      <div
        className="form-actions"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e5e7eb',
          marginTop: '0.5rem',
        }}
      >
        <div>
          {isEditMode && onDelete && (
            <button
              type="button"
              className="btn-delete"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isSaving || uploading}
              style={{
                padding: '0.65rem 1rem',
                backgroundColor: 'transparent',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            className="btn-cancel"
            onClick={onCancel}
            disabled={isSaving || uploading}
            style={{
              padding: '0.65rem 1.25rem',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isSaving || uploading || !name.trim()}
            style={{
              padding: '0.65rem 1.35rem',
              backgroundColor: '#b10035',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'white',
              cursor: isSaving || uploading || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: isSaving || uploading || !name.trim() ? 0.7 : 1,
            }}
          >
            {isSaving ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Category'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CategoryForm;
