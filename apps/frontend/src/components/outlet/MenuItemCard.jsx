import React from 'react';

const MenuItemCard = ({ item, onEdit, onToggleAvailability, hideEdit = false }) => {
  return (
    <div className="food-card">

      <div className="food-image-container" style={{ position: 'relative' }}>
        <div 
          style={{ 
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            zIndex: 1,
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.35rem', 
            fontSize: '0.75rem', 
            fontWeight: 600, 
            color: item.isAvailable ? '#166534' : '#991b1b',
            backgroundColor: item.isAvailable ? '#dcfce7' : '#fee2e2',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
          {item.isAvailable ? 'Available' : 'Unavailable'}
        </div>
        
        {item.image ? (
          <img src={item.image} alt={item.name} className="food-image" />
        ) : (
          <div className="food-image-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
          </div>
        )}
      </div>
      
      <div className="food-content" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
        
        {/* Header Row: Title */}
        <div style={{ marginBottom: '0.25rem' }}>
          <h4 className="food-name" style={{ 
            margin: 0, 
            fontSize: '1.05rem', 
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.name}
          </h4>
        </div>

        {/* Category Row */}
        <div style={{ marginBottom: '0.5rem' }}>
          <span 
            className="card-category" 
            style={{ 
              fontSize: '0.65rem', 
              fontWeight: 600, 
              color: 'var(--primary)', 
              backgroundColor: '#fce8ec', 
              padding: '0.2rem 0.5rem', 
              borderRadius: '6px', 
              whiteSpace: 'nowrap',
              display: 'inline-block'
            }}
          >
            {item.category}
          </span>
        </div>

        {/* Description */}
        {item.description && (
          <p className="food-desc" style={{ 
            margin: 0, 
            display: '-webkit-box', 
            WebkitLineClamp: 2, 
            WebkitBoxOrient: 'vertical', 
            overflow: 'hidden' 
          }} title={item.description}>
            {item.description}
          </p>
        )}
        
        {/* Footer: Price and Actions */}
        <div className="food-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span className="food-price" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-dark)' }}>₹{item.price}</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: 0 }}>
            <button 
              onClick={() => onToggleAvailability(item)}
              disabled={item.isUpdatingAvailability}
              style={{ 
                width: '100%',
                height: '44px',
                padding: '0 0.75rem',
                borderRadius: '8px', 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                cursor: item.isUpdatingAvailability ? 'wait' : 'pointer', 
                border: 'none', 
                backgroundColor: item.isUpdatingAvailability ? '#f3f4f6' : 'var(--primary)', 
                color: item.isUpdatingAvailability ? '#9ca3af' : 'var(--white)',
                transition: 'opacity 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                boxSizing: 'border-box'
              }}
            >
              {item.isUpdatingAvailability ? 'Updating...' : (item.isAvailable ? 'Mark Unavailable' : 'Mark Available')}
            </button>
            {!hideEdit && (
              <button 
                onClick={() => onEdit(item)}
                style={{ 
                  width: '100%',
                  height: '44px',
                  padding: '0 0.75rem',
                  borderRadius: '8px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)', 
                  backgroundColor: '#f9fafb', 
                  color: 'var(--text-dark)',
                  transition: 'background-color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxSizing: 'border-box'
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
