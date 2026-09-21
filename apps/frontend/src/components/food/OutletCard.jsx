import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Clock, MapPin } from 'lucide-react';
import { cn } from '../../lib/utils';

const STATUS_LABEL = {
  OPEN: 'Open',
  BUSY: 'Busy',
  CLOSED: 'Closed',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
};

const OutletCard = ({ outlet }) => {
  const navigate = useNavigate();
  const isOpen = outlet.status === 'OPEN' || outlet.status === 'BUSY';
  const image = outlet.logoUrl || outlet.image;
  const tags = outlet.tags ? outlet.tags.split(',').filter(Boolean) : [];

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="group bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-xl hover:shadow-primary/5"
    >
      {/* Image with hover zoom */}
      <div className="aspect-[4/3] overflow-hidden bg-muted relative">
        {image ? (
          <img
            src={image}
            alt={outlet.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            <span>No image</span>
          </div>
        )}
        {/* Status badge floating on image */}
        <div className={cn(
          'absolute top-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-md shadow-sm',
          isOpen ? 'bg-success/90 text-white' : 'bg-card/90 text-muted-foreground'
        )}>
          <span className={cn(
            'w-1.5 h-1.5 rounded-full',
            isOpen ? 'bg-white animate-pulse' : 'bg-muted-foreground'
          )} />
          {STATUS_LABEL[outlet.status] || outlet.status}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">{outlet.name}</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{outlet.description}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-warning text-warning" />
            <span className="font-medium text-foreground">{outlet.rating ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{outlet.estimatedTime}</span>
          </div>
          {outlet.location && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{outlet.location}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((t) => (
              <span
                key={t}
                className="inline-block px-2 py-0.5 text-[0.7rem] bg-primary-light/30 text-primary rounded-md font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          className={cn(
            'w-full font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2',
            isOpen
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover shadow-md shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
          onClick={() => navigate(`/student/outlet/${outlet.id}`)}
          disabled={!isOpen}
        >
          {isOpen ? 'View menu' : 'Closed'}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default OutletCard;
