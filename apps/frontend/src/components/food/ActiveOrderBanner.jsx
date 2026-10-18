import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { orderService } from '../../services/api/orderService';

// Status labels & steps
const STATUS_CONFIG = {
  PENDING: {
    label: 'Order Placed',
    sublabel: 'Waiting for outlet to accept',
    tone: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    icon: '⏳',
    step: 1,
    percent: 25,
  },
  ACCEPTED: {
    label: 'Accepted',
    sublabel: 'Outlet confirmed your order',
    tone: '#2563eb',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: '✅',
    step: 2,
    percent: 50,
  },
  PREPARING: {
    label: 'Preparing',
    sublabel: 'Kitchen is preparing your food',
    tone: '#ea580c',
    bg: '#fff7ed',
    border: '#fed7aa',
    icon: '👨‍🍳',
    step: 3,
    percent: 75,
  },
  READY: {
    label: 'Ready for Pickup!',
    sublabel: 'Head to the counter to collect',
    tone: '#16a34a',
    bg: '#f0fdf4',
    border: '#86efac',
    icon: '🎉',
    step: 4,
    percent: 100,
  },
};

const STEPS = [
  { key: 'PENDING', label: 'Placed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PREPARING', label: 'Prep' },
  { key: 'READY', label: 'Ready' },
];

const parseOutletName = (order) => {
  try {
    const snap = JSON.parse(order.outletSnapshot || '{}');
    return snap.name || order.outlet?.name || 'Campus Outlet';
  } catch {
    return order.outlet?.name || 'Campus Outlet';
  }
};

const ActiveOrderBanner = () => {
  const navigate = useNavigate();
  const [activeOrders, setActiveOrders] = useState([]);
  const [copiedId, setCopiedId] = useState(null);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const res = await orderService.getMyOrders();
      const allOrders = res.data || [];
      const active = allOrders.filter((o) =>
        ['PENDING', 'ACCEPTED', 'PREPARING', 'READY'].includes(o.status)
      );
      setActiveOrders(active);
    } catch {
      // Silently fail if student has no orders or offline
    }
  }, []);

  useEffect(() => {
    fetchActiveOrders();

    // Listen to real-time socket events broadcast on window
    const handleOrderEvent = () => fetchActiveOrders();
    window.addEventListener('nosh:order-updated', handleOrderEvent);
    window.addEventListener('nosh:order-new', handleOrderEvent);
    window.addEventListener('nosh:notification', handleOrderEvent);

    // Poll every 12 seconds when there are active orders for real-time accuracy
    const interval = setInterval(fetchActiveOrders, 12000);

    return () => {
      window.removeEventListener('nosh:order-updated', handleOrderEvent);
      window.removeEventListener('nosh:order-new', handleOrderEvent);
      window.removeEventListener('nosh:notification', handleOrderEvent);
      clearInterval(interval);
    };
  }, [fetchActiveOrders]);

  if (!activeOrders.length) return null;

  const order = activeOrders[0];
  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const outletName = parseOutletName(order);
  const isReady = order.status === 'READY';
  const itemsSummary = (order.items || [])
    .map((i) => `${i.quantity}× ${i.name}`)
    .join(', ');

  const handleCopyCode = (e, code, orderId) => {
    e.stopPropagation();
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedId(orderId);
    toast.success(`Pickup code ${code} copied!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <aside
      aria-label="Active Order Status"
      style={{
        flex: '0 0 auto',
        width: '100%',
        maxWidth: '380px',
      }}
    >
      <div
        onClick={() => navigate('/student/orders')}
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          border: `1.5px solid ${isReady ? '#86efac' : '#e5e7eb'}`,
          boxShadow: isReady
            ? '0 10px 30px rgba(22, 163, 74, 0.15)'
            : '0 10px 28px rgba(0, 0, 0, 0.06)',
          padding: '1.15rem 1.25rem',
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-3px)';
          e.currentTarget.style.boxShadow = isReady
            ? '0 14px 34px rgba(22, 163, 74, 0.22)'
            : '0 14px 32px rgba(0, 0, 0, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isReady
            ? '0 10px 30px rgba(22, 163, 74, 0.15)'
            : '0 10px 28px rgba(0, 0, 0, 0.06)';
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: isReady
              ? 'linear-gradient(90deg, #16a34a, #4ade80)'
              : `linear-gradient(90deg, ${config.tone}, #f59e0b)`,
          }}
        />

        {/* Top Row: Live Pulse + Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                display: 'inline-block',
                boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)',
                animation: 'pulse 1.8s infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#374151',
              }}
            >
              Live Order
            </span>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              background: config.bg,
              color: config.tone,
              border: `1px solid ${config.border}`,
            }}
          >
            <span>{config.icon}</span> {config.label}
          </span>
        </div>

        {/* Outlet Name, Order # & Items */}
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#111827',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {outletName}
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '0.1rem 0.45rem',
                borderRadius: '6px',
                flexShrink: 0,
              }}
            >
              #{order.orderNumber}
            </span>
          </div>

          <p
            style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.82rem',
              color: '#4b5563',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {itemsSummary}
            {order.totalAmount && (
              <span style={{ fontWeight: 700, color: '#111827', marginLeft: '0.4rem' }}>
                • ₹{Math.round(Number(order.totalAmount))}
              </span>
            )}
          </p>
        </div>

        {/* Square-styled Pickup OTP Container */}
        {order.pickupCode ? (
          <div
            onClick={(e) => handleCopyCode(e, order.pickupCode, order.id)}
            title="Click to copy pickup OTP"
            style={{
              background: isReady ? '#f0fdf4' : '#faf5f6',
              border: `1.5px dashed ${isReady ? '#22c55e' : '#b10035'}`,
              borderRadius: '14px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)';
              e.currentTarget.style.borderColor = isReady ? '#16a34a' : '#8e002a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = isReady ? '#22c55e' : '#b10035';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                color: isReady ? '#16a34a' : '#b10035',
                textTransform: 'uppercase',
                marginBottom: '0.1rem',
              }}
            >
              <span>{isReady ? '🎉 READY FOR PICKUP' : 'PICKUP OTP'}</span>
              <span style={{ fontSize: '0.75rem' }}>📋</span>
            </div>

            <div
              style={{
                fontSize: '1.75rem',
                fontWeight: 900,
                letterSpacing: '0.22em',
                color: isReady ? '#15803d' : '#8e002a',
                fontFamily: 'monospace, ui-monospace, sans-serif',
                lineHeight: 1.1,
              }}
            >
              {order.pickupCode}
            </div>

            <div
              style={{
                fontSize: '0.68rem',
                color: copiedId === order.id ? '#16a34a' : '#6b7280',
                fontWeight: copiedId === order.id ? 700 : 500,
                marginTop: '0.2rem',
              }}
            >
              {copiedId === order.id ? '✓ Copied to clipboard!' : isReady ? 'Show at counter now' : 'Show at counter'}
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f9fafb',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            OTP ready upon confirmation
          </div>
        )}

        {/* Compact Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          {STEPS.map((s, idx) => {
            const isCompleted = idx < config.step;
            const isCurrent = idx === config.step - 1;

            return (
              <React.Fragment key={s.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      background: isCompleted
                        ? '#16a34a'
                        : isCurrent
                        ? config.tone
                        : '#e5e7eb',
                      color: isCompleted || isCurrent ? '#ffffff' : '#9ca3af',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isCompleted ? '✓' : idx + 1}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: isCurrent ? 700 : 500,
                      color: isCurrent ? config.tone : isCompleted ? '#374151' : '#9ca3af',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: '2px',
                      background: idx < config.step - 1 ? '#16a34a' : '#e5e7eb',
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Footer: Multi-order indicator + Details Link */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid #f3f4f6',
            paddingTop: '0.65rem',
            marginTop: '-0.2rem',
            fontSize: '0.76rem',
          }}
        >
          {activeOrders.length > 1 ? (
            <span
              style={{
                color: '#b10035',
                fontWeight: 600,
                background: '#fff1f2',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                border: '1px solid #fecdd3',
              }}
            >
              +{activeOrders.length - 1} more active
            </span>
          ) : (
            <span style={{ color: '#9ca3af', fontWeight: 500 }}>
              Live tracking
            </span>
          )}

          <span
            style={{
              color: '#b10035',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            {activeOrders.length > 1 ? `View all (${activeOrders.length}) →` : 'View details →'}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default ActiveOrderBanner;
