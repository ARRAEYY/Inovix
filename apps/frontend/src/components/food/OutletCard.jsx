import React from 'react';
import { useNavigate } from 'react-router-dom';

// Compact outlet card — the whole card is tappable (§5). Tapping anywhere
// opens the outlet's menu.
const OutletCard = ({ outlet }) => {
  const navigate = useNavigate();
  const open = outlet.active;

  const handleOpen = () => navigate(`/student/outlet/${outlet.id}`);

  return (
    <div
      className={`outlet-card ${open ? '' : 'is-closed'}`}
      onClick={handleOpen}
      role="link"
      tabIndex={0}
      aria-label={`${outlet.name} — ${open ? 'Open' : 'Closed'} — opens menu`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpen(); } }}
    >
      <div className="outlet-image-container">
        <img src={outlet.image} alt={outlet.name} className="outlet-image" loading="lazy" />
        {outlet.rating != null && (
          <span className="outlet-rating-chip" aria-label={`Rated ${outlet.rating}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            {outlet.rating}
          </span>
        )}
      </div>

      <div className="outlet-content">
        <div className="outlet-header">
          <h3 className="outlet-name">{outlet.name}</h3>
          <div className={`status-badge ${open ? 'active' : 'inactive'}`}>
            <span className="status-dot"></span>
            {open ? 'Open' : 'Closed'}
          </div>
        </div>

        {outlet.description && <p className="outlet-description">{outlet.description}</p>}

        {(outlet.tags || []).length > 0 && (
          <div className="outlet-tags">
            {(outlet.tags || []).slice(0, 3).map(tag => (
              <span key={tag} className="outlet-tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="outlet-meta">
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{outlet.time} min</span>
          </div>
          {outlet.location && (
            <div className="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>{outlet.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutletCard;
