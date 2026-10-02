import React, { useState } from 'react';

const FoodCard = ({ food, quantity, onUpdateQuantity, onShowReviews }) => {
  const [showCustomize, setShowCustomize] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState({});
  const hasCustomizations = food.customizationGroups && food.customizationGroups.length > 0;

  // Calculate the adjusted price based on selected options
  const optionPriceDelta = Object.values(selectedOptions).flat().reduce((sum, opt) => sum + (Number(opt.priceDelta) || 0), 0);
  const adjustedPrice = food.price + optionPriceDelta;

  const handleAdd = () => {
    if (hasCustomizations && Object.keys(selectedOptions).length === 0) {
      setShowCustomize(true);
      return;
    }
    onUpdateQuantity(food.id, 1, Object.values(selectedOptions).flat());
  };

  const toggleOption = (groupId, option, maxSelect) => {
    setSelectedOptions(prev => {
      const current = prev[groupId] || [];
      const exists = current.find(o => o.id === option.id);
      let updated;
      if (exists) {
        updated = current.filter(o => o.id !== option.id);
      } else {
        if (maxSelect === 1) {
          updated = [option]; // radio-like: replace
        } else if (current.length < maxSelect) {
          updated = [...current, option];
        } else {
          return prev; // max reached
        }
      }
      return { ...prev, [groupId]: updated };
    });
  };

  return (
    <div className="food-card">
      <div className="food-image-container">
        {food.image ? (
          <img src={food.image} alt={food.name} className="food-image" />
        ) : (
          <div className="food-image-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
            </svg>
          </div>
        )}
      </div>
      <div className="food-content">
        <div className="food-info-group">
          <h4 className="food-name">{food.name}</h4>
          {food.description && <p className="food-desc" title={food.description}>{food.description}</p>}
          {food.foodRating && (
            <button
              type="button"
              className="food-rating-chip"
              onClick={() => onShowReviews && onShowReviews(food)}
              title="See food reviews"
            >
              ★ {food.foodRating.avg}
              <span className="food-rating-count">({food.foodRating.count})</span>
            </button>
          )}
        </div>
        <div className="food-footer">
          <span className="food-price">₹{adjustedPrice}</span>
          {!(food.isAvailable ?? food.available) ? (
            <span className="food-unavailable">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="quantity-selector">
              <button className="qty-btn" onClick={() => onUpdateQuantity(food.id, quantity - 1)}>−</button>
              <span className="qty-value">{quantity}</span>
              <button className="qty-btn" onClick={() => onUpdateQuantity(food.id, quantity + 1)}>+</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {hasCustomizations && (
                <button className="add-btn" style={{ background: '#f3f4f6', color: '#374151' }} onClick={() => setShowCustomize(true)}>
                  Customize
                </button>
              )}
              <button className="add-btn" onClick={handleAdd}>ADD</button>
            </div>
          )}
        </div>
      </div>

      {/* Customization Modal */}
      {showCustomize && hasCustomizations && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', maxWidth: '400px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>{food.name} — ₹{adjustedPrice}</h3>
            {food.customizationGroups.map(group => (
              <div key={group.id} style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>
                  {group.name} {group.minSelect > 0 && <span style={{ color: '#dc2626' }}>*required</span>}
                  <span style={{ color: '#9ca3af', fontWeight: 400 }}> (select {group.minSelect}-{group.maxSelect})</span>
                </p>
                {group.options.map(opt => {
                  const isSelected = (selectedOptions[group.id] || []).find(o => o.id === opt.id);
                  return (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type={group.maxSelect === 1 ? 'radio' : 'checkbox'} name={group.id} checked={!!isSelected}
                        onChange={() => toggleOption(group.id, { id: opt.id, label: opt.label, priceDelta: Number(opt.priceDelta) }, group.maxSelect)} />
                      <span>{opt.label}</span>
                      {Number(opt.priceDelta) > 0 && <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>+₹{opt.priceDelta}</span>}
                    </label>
                  );
                })}
              </div>
            ))}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => { setShowCustomize(false); setSelectedOptions({}); }} style={{ flex: 1, padding: '0.6rem', background: '#f3f4f6', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => { onUpdateQuantity(food.id, 1, Object.values(selectedOptions).flat()); setShowCustomize(false); }}
                style={{ flex: 1, padding: '0.6rem', background: '#b10035', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                Add ₹{adjustedPrice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FoodCard;
