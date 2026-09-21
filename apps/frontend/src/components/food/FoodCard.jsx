import React from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';

const FoodCard = ({ food, quantity, onUpdateQuantity }) => {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-md flex"
    >
      <div className="w-24 h-24 shrink-0 overflow-hidden bg-muted relative">
        {food.image ? (
          <img
            src={food.image}
            alt={food.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            <span>No Image</span>
          </div>
        )}
        {food.vegetarian && (
          <div className="absolute top-1 left-1 w-3 h-3 rounded-sm border-2 border-success bg-card flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-success" />
          </div>
        )}
      </div>

      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold text-foreground tracking-tight truncate">{food.name}</h4>
          {food.popular && (
            <span className="shrink-0 px-2 py-0.5 text-[0.65rem] bg-primary-light/40 text-primary font-semibold rounded-md uppercase tracking-wide">
              Popular
            </span>
          )}
        </div>
        {food.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{food.description}</p>
        )}

        <div className="flex items-center justify-between mt-3">
          <span className="text-base font-bold text-foreground">₹{food.price}</span>

          {!food.available ? (
            <span className="text-xs text-muted-foreground font-medium px-3 py-1 bg-muted rounded-md">Unavailable</span>
          ) : quantity > 0 ? (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg p-1"
            >
              <button
                className="w-7 h-7 flex items-center justify-center rounded-md bg-card text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={() => onUpdateQuantity(food.id, quantity - 1)}
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-foreground min-w-[1rem] text-center">{quantity}</span>
              <button
                className="w-7 h-7 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors"
                onClick={() => onUpdateQuantity(food.id, quantity + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.92 }}
              className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors inline-flex items-center gap-1 shadow-sm shadow-primary/30"
              onClick={() => onUpdateQuantity(food.id, 1)}
            >
              ADD <Plus className="w-3 h-3" />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default FoodCard;
