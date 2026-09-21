import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * OutletCard compact variant — for the outlet dashboard's "your outlet" preview.
 * Accepts a minimal shape: { name, status, slug }.
 */
const OutletCardMini = ({ outlet }) => {
  const navigate = useNavigate();
  return (
    <div className="outlet-card" style={{ padding: '1rem' }}>
      <div className="outlet-header">
        <h3 className="outlet-name">{outlet.name}</h3>
        <div className={`status-badge ${outlet.status === 'OPEN' ? 'active' : 'inactive'}`}>
          <span className="status-dot"></span>
          {outlet.status}
        </div>
      </div>
    </div>
  );
};

export default OutletCardMini;
