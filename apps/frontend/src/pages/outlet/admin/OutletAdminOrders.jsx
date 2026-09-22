import React, { useState, useEffect } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import OrderBoard from '../../../components/outlet/OrderBoard';
import DeclineOrderModal from '../../../components/outlet/DeclineOrderModal';
import { getOrders } from '../../../services/outletAdminService';
import { orderService } from '../../../services/api/orderService';

const OutletAdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStatus, setActiveStatus] = useState('NEW'); // used for mobile view kanban
  
  // Decline Modal State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [orderToDecline, setOrderToDecline] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await getOrders();
      setOrders(res.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderInState = (orderId, newStatus) => {
    setOrders(prev => {
      return prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    });
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      updateOrderInState(orderId, newStatus);
    } catch (err) {
      console.error('Failed to update status', err);
      alert(err.message || 'Failed to update status');
    }
  };

  const submitDeclineOrder = async (orderId, reason, note) => {
    try {
      await orderService.updateOrderStatus(orderId, 'DECLINED', {
        rejectionReason: reason,
        rejectionNote: note
      });
      updateOrderInState(orderId, 'DECLINED');
      setDeclineModalOpen(false);
      setOrderToDecline(null);
    } catch (err) {
      alert(err.message || 'Failed to decline order');
      throw err;
    }
  };

  return (
    <OutletAdminLayout>
      <div className="dashboard-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="dashboard-title">Orders Kanban</h1>
          <p className="dashboard-subtitle">Manage and track live orders.</p>
        </div>
        <button className="btn btn-primary" onClick={fetchOrders} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      {/* Status tabs for mobile (Kanban columns are responsive) */}
      <div className="filters-row mobile-only" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', marginBottom: '16px' }}>
        {['NEW', 'PREPARING', 'READY'].map(status => (
          <button 
            key={status}
            onClick={() => setActiveStatus(status)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: activeStatus === status ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: activeStatus === status ? 'var(--primary)' : 'white',
              color: activeStatus === status ? 'white' : 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontSize: '0.9rem'
            }}
          >
            {status}
          </button>
        ))}
      </div>
      
      {loading ? (
        <p>Loading orders...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <OrderBoard 
          orders={orders} 
          activeStatus={activeStatus} 
          onAccept={(id) => handleStatusUpdate(id, 'PREPARING')}
          onMarkReady={(id) => handleStatusUpdate(id, 'READY')}
          onComplete={(id) => handleStatusUpdate(id, 'COMPLETED')}
          onDecline={(id) => {
            setOrderToDecline(id);
            setDeclineModalOpen(true);
          }}
        />
      )}

      {declineModalOpen && (
        <DeclineOrderModal 
          orderId={orderToDecline}
          onClose={() => {
            setDeclineModalOpen(false);
            setOrderToDecline(null);
          }}
          onSubmit={submitDeclineOrder}
        />
      )}
    </OutletAdminLayout>
  );
};

export default OutletAdminOrders;
