import React from 'react';

const FoodCard = ({ food, quantity, onUpdateQuantity }) => {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-sm flex">
      <div className="w-24 h-24 shrink-0 overflow-hidden bg-muted">
        {food.image ? (
          <img src={food.image} alt={food.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            <span>No Image</span>
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground tracking-tight">{food.name}</h4>
          {food.popular && (
            <span className="shrink-0 px-2 py-0.5 text-[0.65rem] bg-primary-light text-primary font-semibold rounded-md">Popular</span>
          )}
        </div>
        {food.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{food.description}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-base font-bold text-foreground">₹{food.price}</span>

          {!food.available ? (
            <span className="text-xs text-muted-foreground font-medium">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <button
                className="w-7 h-7 flex items-center justify-center rounded-md bg-card text-foreground hover:bg-border transition-colors text-base"
                onClick={() => onUpdateQuantity(food.id, quantity - 1)}
                aria-label="Decrease quantity"
              >−</button>
              <span className="font-semibold text-foreground min-w-[1rem] text-center">{quantity}</span>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-md bg-card text-foreground hover:bg-border transition-colors text-base"
                onClick={() => onUpdateQuantity(food.id, quantity + 1)}
                aria-label="Increase quantity"
              >+</button>
            </div>
          ) : (
            <button
              className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center gap-1"
              onClick={() => onUpdateQuantity(food.id, 1)}
            >
              ADD <span className="text-base leading-none">+</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
