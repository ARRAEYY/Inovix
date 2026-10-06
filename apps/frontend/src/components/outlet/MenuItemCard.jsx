import React from 'react';

// Menu-management card (§15): image, name, price, category, availability
// as a labeled toggle switch, plus Edit. The image pill + toggle label
// give two readable indications of the availability state.
const MenuItemCard = ({ item, onEdit, onToggleAvailability, hideEdit = false }) => {
  const available = !!item.isAvailable;

  return (
    <div className={`food-card ${!available ? 'is-unavailable' : ''}`}>
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
            color: available ? '#166534' : '#991b1b',
            backgroundColor: available ? '#dcfce7' : '#fee2e2',
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
          {available ? 'Available' : 'Unavailable'}
        </div>

        {item.image ? (
          <img src={item.image} alt={item.name} className="food-image" loading="lazy" />
        ) : (
          <div className="food-image-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" aria-hidden="true">
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
            overflow: 'hidden',
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
              display: 'inline-block',
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
            overflow: 'hidden',
          }} title={item.description}>
            {item.description}
          </p>
        )}

        {/* Footer: Price, availability toggle, Edit */}
        <div className="food-footer" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '1rem' }}>
          {/* width:100% — the footer is a column with align-items:center from
              the shared .food-footer style; without it the price centers. */}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left' }}>
            <span className="food-price" style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)' }}>₹{item.price}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', minWidth: 0 }}>
            <button
              type="button"
              className={`availability-toggle ${available ? 'on' : 'off'}`}
              onClick={() => onToggleAvailability(item)}
              disabled={item.isUpdatingAvailability}
              role="switch"
              aria-checked={available}
              aria-label={`${available ? 'Mark unavailable' : 'Mark available'}: ${item.name}`}
              style={{ flex: 1, justifyContent: 'flex-start', minWidth: 0 }}
            >
              <span className="availability-track" aria-hidden="true"></span>
              <span className={`availability-label ${available ? 'on' : 'off'}`}>
                {item.isUpdatingAvailability ? 'Updating…' : (available ? 'Available' : 'Unavailable')}
              </span>
            </button>
            {!hideEdit && (
              <button
                onClick={() => onEdit(item)}
                aria-label={`Edit ${item.name}`}
                style={{
                  height: '36px',
                  padding: '0 0.85rem',
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
                  flexShrink: 0,
                  boxSizing: 'border-box',
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
