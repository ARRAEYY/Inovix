import React from 'react';

const FoodCard = ({ food, quantity, onUpdateQuantity }) => {
  return (
    <div className="food-card">
      <div className="food-image-container">
        {food.image ? (
          <img src={food.image} alt={food.name} className="food-image" />
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
      
      <div className="food-content">
        <div className="food-info-group">
          <h4 className="food-name">{food.name}</h4>
          {food.description && <p className="food-desc" title={food.description}>{food.description}</p>}
        </div>
        
        <div className="food-footer">
          <span className="food-price">₹{food.price}</span>
          
          {!(food.isAvailable ?? food.available) ? (
            <span className="food-unavailable">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="quantity-selector">
              <button 
                className="qty-btn" 
                onClick={() => onUpdateQuantity(food.id, quantity - 1)}
              >
                −
              </button>
              <span className="qty-value">{quantity}</span>
              <button 
                className="qty-btn" 
                onClick={() => onUpdateQuantity(food.id, quantity + 1)}
              >
                +
              </button>
            </div>
          ) : (
            <button 
              className="add-btn" 
              onClick={() => onUpdateQuantity(food.id, 1)}
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
