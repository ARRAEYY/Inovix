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
    <div className="bg-white rounded-2xl border border-[#FCEAE1] overflow-hidden transition-all hover:shadow-lg">
      <div className="relative w-full h-48 bg-gray-100">
        {food.image ? (
          <img src={food.image} alt={food.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[#94A3B8]">
            <span>No Image</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-base font-bold text-[#0F172A] leading-tight">{food.name}</h4>
          {food.popular && (
            <span className="px-2 py-0.5 text-[0.65rem] bg-[#FED7AA] text-[#EA580C] rounded-full whitespace-nowrap">Popular</span>
          )}
        </div>
        {food.description && <p className="text-sm text-[#475569] mb-3 line-clamp-2">{food.description}</p>}

        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-[#0F172A]">₹{food.price}</span>

          {!food.available ? (
            <span className="text-sm text-[#94A3B8] font-medium">Unavailable</span>
          ) : quantity > 0 ? (
            <div className="flex items-center gap-2 bg-[#EA580C] rounded-lg px-2 py-1">
              <button className="w-6 h-6 flex items-center justify-center text-white font-bold text-lg hover:opacity-80" onClick={() => onUpdateQuantity(food.id, quantity - 1)}>−</button>
              <span className="min-w-[24px] text-center text-white font-semibold">{quantity}</span>
              <button className="w-6 h-6 flex items-center justify-center text-white font-bold text-lg hover:opacity-80" onClick={() => onUpdateQuantity(food.id, quantity + 1)}>+</button>
            </div>
          ) : (
            <button className="bg-[#EA580C] text-white border-none rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer flex items-center gap-1 transition-colors hover:bg-[#C2410C]" onClick={() => onUpdateQuantity(food.id, 1)}>
              ADD <span className="text-base">+</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
