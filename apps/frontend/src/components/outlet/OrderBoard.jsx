import React from 'react';
import OutletOrderCard from './OutletOrderCard';

const OrderColumn = ({ title, orders, emptyText, onAccept, onDecline, onMarkReady, onComplete }) => {
  return (
    <div className="order-column">
      <div className="column-header">
        <h3 className="column-title">{title}</h3>
        <span className="order-count">{orders.length}</span>
      </div>
      <div className="column-content">
        {orders.length > 0 ? (
          orders.map(order => (
            <OutletOrderCard 
              key={order.id} 
              order={order} 
              onAccept={onAccept}
              onDecline={onDecline}
              onMarkReady={onMarkReady}
              onComplete={onComplete}
            />
          ))
        ) : (
          <div className="empty-state">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
};

const OrderBoard = ({ orders, activeStatus, onAccept, onDecline, onMarkReady, onComplete }) => {
  const newOrders = orders.filter(o => o.status === 'NEW' || o.status === 'PLACED');
  const preparingOrders = orders.filter(o => o.status === 'PREPARING');
  const readyOrders = orders.filter(o => o.status === 'READY');

  const activeTabClass = `active-tab-${activeStatus.toLowerCase()}`;

  return (
    <div className={`order-board kanban-board ${activeTabClass}`}>
      <div className="kanban-col-wrapper col-new">
        <OrderColumn 
          title="NEW ORDERS" 
          orders={newOrders} 
          emptyText="No new orders" 
          onAccept={onAccept}
          onDecline={onDecline}
          onMarkReady={onMarkReady}
          onComplete={onComplete}
        />
      </div>
      
      <div className="kanban-col-wrapper col-preparing">
        <OrderColumn 
          title="PREPARING" 
          orders={preparingOrders} 
          emptyText="No orders in prep" 
          onAccept={onAccept}
          onDecline={onDecline}
          onMarkReady={onMarkReady}
          onComplete={onComplete}
        />
      </div>
      
      <div className="kanban-col-wrapper col-ready">
        <OrderColumn 
          title="READY FOR PICKUP" 
          orders={readyOrders} 
          emptyText="No orders ready" 
          onAccept={onAccept}
          onDecline={onDecline}
          onMarkReady={onMarkReady}
          onComplete={onComplete}
        />
      </div>
    </div>
  );
};

export default OrderBoard;
