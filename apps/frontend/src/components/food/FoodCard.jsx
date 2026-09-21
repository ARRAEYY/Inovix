import React from 'react';

/**
 * FoodCard — accepts an already-adapted `food` shape:
 *   { id, name, description, price, image, available, popular, vegetarian, discount }
 *
 * The adapter (mapping backend MenuItem → this shape) lives in the parent
 * page so FoodCard stays simple + reusable.
 */
const FoodCard = ({ food, quantity, onUpdateQuantity }) => {
  return (
    <div className="food-card">
      <div className="food-image-container">
        {food.image ? (
          <img src={food.image} alt={food.name} className="food-image" loading="lazy" />
        ) : (
          <div className="food-image-placeholder"><span>No Image</span></div>
        )}
      </div>

      <div className="food-content">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h4 className="food-name">{food.name}</h4>
          {food.popular && (
            <span className="pill" style={{ padding: '2px 8px', fontSize: '0.65rem', background: 'var(--primary-light)', color: 'var(--primary)' }}>Popular</span>
          )}
        </div>
        {food.description && <p className="food-desc">{food.description}</p>}

        <div className="food-footer">
          <span className="food-price">₹{food.price}</span>

          {!food.available ? (
            <span className="food-unavailable">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="quantity-selector">
              <button className="qty-btn" onClick={() => onUpdateQuantity(food.id, quantity - 1)}>−</button>
              <span className="qty-value">{quantity}</span>
              <button className="qty-btn" onClick={() => onUpdateQuantity(food.id, quantity + 1)}>+</button>
            </div>
          ) : (
            <button className="add-btn" onClick={() => onUpdateQuantity(food.id, 1)}>
              ADD <span className="plus-icon">+</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
