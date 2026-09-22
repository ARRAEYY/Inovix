import React, { useState, useEffect } from 'react';
import OutletLayout from '../../components/layout/OutletLayout';
import StatsGrid from '../../components/outlet/StatsGrid';
import OrderBoard from '../../components/outlet/OrderBoard';
import DeclineOrderModal from '../../components/outlet/DeclineOrderModal';
import { orderService } from '../../services/api/orderService';

const Dashboard = () => {
  const [stats, setStats] = useState({ new: 0, preparing: 0, ready: 0 });
  const [orders, setOrders] = useState([]);
  const [activeStatus, setActiveStatus] = useState('NEW');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Decline Modal State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [orderToDecline, setOrderToDecline] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStats = (currentOrders) => {
    const newStats = { new: 0, preparing: 0, ready: 0 };
    currentOrders.forEach(order => {
      if (order.status === 'PLACED' || order.status === 'NEW') newStats.new += 1;
      else if (order.status === 'PREPARING') newStats.preparing += 1;
      else if (order.status === 'READY') newStats.ready += 1;
    });
    setStats(newStats);
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await orderService.getOutletOrders();
      const fetchedOrders = res.data || [];
      setOrders(fetchedOrders);
      updateStats(fetchedOrders);
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
      const updated = prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
      updateStats(updated);
      return updated;
    });
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderService.updateOrderStatus(orderId, newStatus);
      updateOrderInState(orderId, newStatus);
    } catch (err) {
      console.error('Failed to update status', err);
      // In a real app, show a toast notification here
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
      throw err;
    }
  };

  const handleRefresh = () => {
    fetchOrders();
  };

  return (
    <OutletLayout>
      <div className="dashboard-header-row">
        <h1 className="dashboard-title">Dashboard</h1>
        <button className="refresh-btn" onClick={handleRefresh}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Refresh
        </button>
      </div>

      <StatsGrid stats={stats} activeStatus={activeStatus} setActiveStatus={setActiveStatus} />
      
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
