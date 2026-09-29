import React, { useState, useEffect } from 'react';
import OutletAdminLayout from '../../../components/layout/OutletAdminLayout';
import OrderBoard from '../../../components/outlet/OrderBoard';
import DeclineOrderModal from '../../../components/outlet/DeclineOrderModal';
import { getOrders } from '../../../services/outletAdminService';
import { orderService, OUTLET_DISPLAY_STATUS } from '../../../services/api/orderService';
import client from '../../../services/api/client';
import { toast } from 'react-hot-toast';

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
    // Auto-refresh every 15s so new orders appear without manual refresh.
    // Socket.IO events (order:status:changed) also trigger a refetch.
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await getOrders();
      // Keep the real backend status in `backendStatus` and put the board's
      // display status in `status` (PENDING→NEW, ACCEPTED→PREPARING).
      setOrders((res.data || []).map(o => ({
        ...o,
        backendStatus: o.status,
        status: OUTLET_DISPLAY_STATUS[o.status] || o.status,
      })));
      setError(null);
    } catch (err) {
      setError('Failed to fetch orders');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderInState = (orderId, patch) => {
    setOrders(prev => {
      return prev.map(o => o.id === orderId ? { ...o, ...patch } : o);
    });
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      updateOrderInState(orderId, {
        backendStatus: newStatus,
        status: OUTLET_DISPLAY_STATUS[newStatus] || newStatus,
      });
    } catch (err) {
      console.error('Failed to update status', err);
      toast(err.message || 'Failed to update status');
    }
  };

  // Accept: the backend only allows PENDING → ACCEPTED, then the order
  // shows in the Preparing column.
  const handleAccept = (orderId) => handleStatusUpdate(orderId, 'ACCEPTED');

  const handleVerifyPickup = async (orderId, code) => {
    try {
      const res = await orderService.updateOrderStatus;
      // Use the outlet API directly for verify-pickup
      client
      await client.post(`/outlet/orders/${orderId}/verify-pickup`, { pickupCode: code });
      toast('✓ Pickup verified! Order completed.');
      updateOrderInState(orderId, { backendStatus: 'COMPLETED', status: 'COMPLETED' });
      fetchOrders();
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid pickup code');
    }
  };

  // Mark Ready: the backend requires ACCEPTED → PREPARING → READY — run
  // both transitions when the order was just accepted.
  const handleMarkReady = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    try {
      if (order?.backendStatus === 'ACCEPTED') {
        await orderService.updateOrderStatus(orderId, 'PREPARING');
      }
      await orderService.updateOrderStatus(orderId, 'READY');
      updateOrderInState(orderId, { backendStatus: 'READY', status: 'READY' });
    } catch (err) {
      console.error('Failed to mark ready', err);
      toast(err.message || 'Failed to mark order ready');
    }
  };

  const submitDeclineOrder = async (orderId, reason, note) => {
    try {
      const reasonText = note ? `${reason} — ${note}` : reason;
      await orderService.updateOrderStatus(orderId, 'REJECTED', reasonText);
      updateOrderInState(orderId, { backendStatus: 'REJECTED', status: 'REJECTED' });
      setDeclineModalOpen(false);
      setOrderToDecline(null);
    } catch (err) {
      toast(err.message || 'Failed to decline order');
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
          onAccept={handleAccept}
          onMarkReady={handleMarkReady}
          onComplete={(id) => handleStatusUpdate(id, 'COMPLETED')}
          onVerifyPickup={handleVerifyPickup}
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
