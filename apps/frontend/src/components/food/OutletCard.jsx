import React from 'react';
import { useNavigate } from 'react-router-dom';

const OutletCard = ({ outlet }) => {
  const navigate = useNavigate();

  return (
    <div className="outlet-card">
      <div className="outlet-image-container">
        <img src={outlet.image} alt={outlet.name} className="outlet-image" />
      </div>
      
      <div className="outlet-content">
        <div className="outlet-header">
          <h3 className="outlet-name">{outlet.name}</h3>
          <div className={`status-badge ${outlet.active ? 'active' : 'inactive'}`}>
            <span className="status-dot"></span>
            {outlet.active ? 'Active' : 'Closed'}
          </div>
        </div>
        
        <p className="outlet-description">{outlet.description}</p>
        
        <div className="outlet-meta">
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>{outlet.rating}</span>
          </div>
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>{outlet.time} min</span>
          </div>
          <div className="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
            <span>{outlet.location}</span>
          </div>
        </div>
        
        <button 
          className="primary-btn view-menu-btn"
          onClick={() => navigate(`/student/outlet/${outlet.id}`)}
        >
          View menu
        </button>
      </div>
    </div>
  );
};

export default OutletCard;
