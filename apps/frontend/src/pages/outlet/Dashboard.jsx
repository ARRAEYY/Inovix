import React, { useState, useEffect } from 'react';
import OutletLayout from '../../components/layout/OutletLayout';
import OrderBoard from '../../components/outlet/OrderBoard';
import DeclineOrderModal from '../../components/outlet/DeclineOrderModal';
import { orderService, OUTLET_DISPLAY_STATUS } from '../../services/api/orderService';
import client from '../../services/api/client';
import { toast } from 'react-hot-toast';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState('NEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const res = await orderService.getOutletOrders();
      // Keep the real backend status in `backendStatus` and put the board's
      // display status in `status` (PENDING→NEW, ACCEPTED→PREPARING).
      const fetchedOrders = (res.data || []).map(o => ({
        ...o,
        backendStatus: o.status,
        status: OUTLET_DISPLAY_STATUS[o.status] || o.status,
      }));
      setOrders(fetchedOrders);
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
      toast(err.message || 'Failed to update order status');
      console.error('Failed to update status', err);
    }
  };

  // Accept: the backend only allows PENDING → ACCEPTED, then the order
  // shows in the Preparing column.
  const handleAccept = (orderId) => handleStatusUpdate(orderId, 'ACCEPTED');

  // Mark Ready: if the order was just accepted (ACCEPTED), the backend
  // requires ACCEPTED → PREPARING → READY — run both transitions.
  const handleMarkReady = async (orderId) => {
    const order = orders.find(o => o.id === orderId);
    try {
      if (order?.backendStatus === 'ACCEPTED') {
        await orderService.updateOrderStatus(orderId, 'PREPARING');
      }
      await orderService.updateOrderStatus(orderId, 'READY');
      updateOrderInState(orderId, { backendStatus: 'READY', status: 'READY' });
    } catch (err) {
      toast(err.message || 'Failed to mark order ready');
      console.error('Failed to mark ready', err);
    }
  };

  const handleComplete = (orderId) => handleStatusUpdate(orderId, 'COMPLETED');

  // Verify Pickup: enter the student's 4-digit pickup code → READY → COMPLETED.
  const handleVerifyPickup = async (orderId, code) => {
    try {
      await client.post(`/outlet/orders/${orderId}/verify-pickup`, { pickupCode: code });
      toast('✓ Pickup verified! Order completed.');
      updateOrderInState(orderId, { backendStatus: 'COMPLETED', status: 'COMPLETED' });
      fetchOrders();
    } catch (err) {
      toast(err.response?.data?.message || 'Invalid pickup code');
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
    <OutletLayout>
      <div className="dashboard-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="dashboard-title">Orders</h1>
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

      {loading && orders.length === 0 ? (
        <p>Loading orders...</p>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <OrderBoard
          orders={orders}
          activeStatus={activeStatus}
          onAccept={handleAccept}
          onMarkReady={handleMarkReady}
          onComplete={handleComplete}
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
    </OutletLayout>
  );
};

export default Dashboard;
