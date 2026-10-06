import React, { useState } from 'react';

const OutletOrderCard = ({ order, onAccept, onDecline, onMarkReady, onComplete, onVerifyPickup }) => {
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [pickupCode, setPickupCode] = useState('');

  return (
    <div className="outlet-order-card">
      <div className="order-card-header">
        <span className="order-id">#{String(order.id || '').slice(-4)}</span>
        {/* Dine-in vs takeaway — the kitchen needs this at a glance */}
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.04em', padding: '2px 7px', borderRadius: 999,
          background: order.orderType === 'DINE_IN' ? 'var(--status-blue-bg)' : 'var(--status-gray-bg)',
          color: order.orderType === 'DINE_IN' ? 'var(--status-blue)' : 'var(--status-gray)',
        }}>
          {order.orderType === 'DINE_IN' ? 'Dine in' : 'Takeaway'}
        </span>
        <span className="order-time">
          {order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
        </span>
      </div>
      <div className="order-card-items">
        {(order.items || []).map((item, idx) => (
          <div key={idx} className="order-item-row">
            <span className="item-qty">{item.quantity}x</span>
            <span className="item-name">{item.name}</span>
          </div>
        ))}
      </div>
      <div className="order-card-footer">
        {order.status === 'NEW' || order.status === 'PLACED' ? (
          <div className="order-actions-row">
            <button className="action-btn btn-accept" onClick={() => onAccept(order.id)}>Accept</button>
            <button className="action-btn btn-decline" onClick={() => onDecline(order.id)}>Decline</button>
          </div>
        ) : order.status === 'PREPARING' ? (
          <button className="action-btn btn-mark-ready" onClick={() => onMarkReady(order.id)}>Mark Ready</button>
        ) : order.status === 'READY' ? (
          showPickupInput ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input type="text" placeholder="4-digit code" maxLength="4" value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value.replace(/\D/g, ''))}
                style={{ width: '100px', padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: '6px', textAlign: 'center', fontSize: '0.9rem', letterSpacing: '0.2em' }} />
              <button className="action-btn btn-accept" onClick={() => { onVerifyPickup(order.id, pickupCode); setShowPickupInput(false); setPickupCode(''); }}>Verify</button>
              <button className="action-btn" onClick={() => setShowPickupInput(false)}>×</button>
            </div>
          ) : (
            <button className="action-btn btn-complete" onClick={() => setShowPickupInput(true)}>
              Verify Pickup & Complete
            </button>
          )
        ) : (
          <button className="action-btn" disabled>View Details</button>
        )}
      </div>
    </div>
  );
};

export default OutletOrderCard;
