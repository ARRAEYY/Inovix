import React from 'react';
import { useNavigate } from 'react-router-dom';

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
    <div className="bg-card border border-border rounded-2xl overflow-hidden transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {image ? (
          <img src={image} alt={outlet.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            <span>No image</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">{outlet.name}</h3>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOpen ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-success' : 'bg-muted-foreground'}`}></span>
            {STATUS_LABEL[outlet.status] || outlet.status}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{outlet.description}</p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span className="font-medium">{outlet.rating ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{outlet.estimatedTime}</span>
          </div>
          {outlet.location && (
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span className="truncate max-w-[120px]">{outlet.location}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tags.map((t) => (
              <span key={t} className="inline-block px-2 py-0.5 text-[0.7rem] bg-muted text-muted-foreground rounded-md">{t}</span>
            ))}
          </div>
        )}

        <button
          className="w-full bg-primary text-primary-foreground font-semibold py-2.5 rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => navigate(`/student/outlet/${outlet.id}`)}
          disabled={!isOpen}
        >
          {isOpen ? 'View menu' : 'Closed'}
        </button>
      </div>
    </div>
  );
};

export default OutletCard;
