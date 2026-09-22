import React from 'react';

const OutletOrderCard = ({ order, onAccept, onDecline, onMarkReady, onComplete }) => {
  return (
    <div className="outlet-order-card">
      <div className="order-card-header">
        <span className="order-id">#{order.id.slice(-4)}</span>
        <span className="order-time">12:30 PM</span>
      </div>
      <div className="order-card-items">
        {order.items.map((item, idx) => (
          <div key={idx} className="order-item-row">
            <span className="item-qty">{item.quantity}x</span>
            <span className="item-name">{item.name}</span>
          </div>
        ))}
      </div>
      <div className="order-card-footer">
        {order.status === 'NEW' || order.status === 'PLACED' ? (
          <div className="order-actions-row">
            <button 
              className="action-btn btn-accept" 
              onClick={() => onAccept(order.id)}
            >
              Accept
            </button>
            <button 
              className="action-btn btn-decline" 
              onClick={() => onDecline(order.id)}
            >
              Decline
            </button>
          </div>
        ) : order.status === 'PREPARING' ? (
          <button 
            className="action-btn btn-mark-ready" 
            onClick={() => onMarkReady(order.id)}
          >
            Mark Ready
          </button>
        ) : order.status === 'READY' ? (
          <button 
            className="action-btn btn-complete" 
            onClick={() => onComplete(order.id)}
          >
            Complete
          </button>
        ) : (
          <button className="action-btn" disabled>
            View Details
          </button>
        )}
      </div>
    </div>
  );
};

export default OutletOrderCard;
