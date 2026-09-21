import React from 'react';
import { useNavigate } from 'react-router-dom';

const STATUS_LABEL = {
  OPEN: 'Open',
  BUSY: 'Busy',
  CLOSED: 'Closed',
  PENDING: 'Pending',
  SUSPENDED: 'Suspended',
};

/**
 * OutletCard — adapts backend Outlet shape:
 *   { id, slug, name, description, image/logoUrl, status, rating, estimatedTime, location, tags }
 *
 * Backend uses `status: OPEN|BUSY|CLOSED|...` and `estimatedTime: "15-20 min"`,
 * while the old frontend used `active: boolean` + `time: string`. We translate.
 */
const OutletCard = ({ outlet }) => {
  const navigate = useNavigate();
  const isOpen = outlet.status === 'OPEN' || outlet.status === 'BUSY';
  const image = outlet.logoUrl || outlet.image;
  const tags = outlet.tags ? outlet.tags.split(',').filter(Boolean) : [];

  return (
    <div className="outlet-card">
      <div className="outlet-image-container">
        {image ? (
          <img src={image} alt={outlet.name} className="outlet-image" loading="lazy" />
        ) : (
          <div className="food-image-placeholder"><span>No image</span></div>
        )}
      </div>

      <div className="outlet-content">
        <div className="outlet-header">
          <h3 className="outlet-name">{outlet.name}</h3>
          <div className={`status-badge ${isOpen ? 'active' : 'inactive'}`}>
            <span className="status-dot"></span>
            {STATUS_LABEL[outlet.status] || outlet.status}
          </div>
        </div>

        <p className="outlet-description">{outlet.description}</p>

        <div className="outlet-meta">
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>{outlet.rating ?? '—'}</span>
          </div>
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{outlet.estimatedTime}</span>
          </div>
          {outlet.location && (
            <div className="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>{outlet.location}</span>
            </div>
          )}
        </div>

        {tags.length > 0 && (
          <div className="outlet-tags" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {tags.map((t) => (
              <span key={t} className="pill" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{t}</span>
            ))}
          </div>
        )}

        <button
          className="primary-btn view-menu-btn"
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
