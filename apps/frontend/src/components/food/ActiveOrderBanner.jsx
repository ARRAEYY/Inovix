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
        maxWidth: '280px',
      }}
    >
      <div
        onClick={() => navigate('/student/orders')}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: `1.5px solid ${isReady ? '#86efac' : '#e5e7eb'}`,
          boxShadow: isReady
            ? '0 6px 20px rgba(22, 163, 74, 0.12)'
            : '0 6px 18px rgba(0, 0, 0, 0.05)',
          padding: '0.75rem 0.85rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.45rem',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = isReady
            ? '0 8px 24px rgba(22, 163, 74, 0.18)'
            : '0 8px 22px rgba(0, 0, 0, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = isReady
            ? '0 6px 20px rgba(22, 163, 74, 0.12)'
            : '0 6px 18px rgba(0, 0, 0, 0.05)';
        }}
      >
        {/* Top Accent Strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: isReady
              ? 'linear-gradient(90deg, #16a34a, #4ade80)'
              : `linear-gradient(90deg, ${config.tone}, #f59e0b)`,
          }}
        />

        {/* Top Row: Live Pulse + Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: '#16a34a',
                display: 'inline-block',
                boxShadow: '0 0 0 2.5px rgba(22, 163, 74, 0.25)',
                animation: 'pulse 1.8s infinite',
              }}
            />
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: '#4b5563',
              }}
            >
              Live Order
            </span>
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.12rem 0.45rem',
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
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.4rem' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '0.92rem',
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
                fontSize: '0.65rem',
                fontWeight: 600,
                color: '#6b7280',
                background: '#f3f4f6',
                padding: '0.08rem 0.35rem',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              #{order.orderNumber}
            </span>
          </div>

          <p
            style={{
              margin: '0.15rem 0 0 0',
              fontSize: '0.74rem',
              color: '#4b5563',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {itemsSummary}
            {order.totalAmount && (
              <span style={{ fontWeight: 700, color: '#111827', marginLeft: '0.35rem' }}>
                • ₹{Math.round(Number(order.totalAmount))}
              </span>
            )}
          </p>
        </div>

        {/* Compact Square-styled Pickup OTP Box */}
        {order.pickupCode ? (
          <div
            onClick={(e) => handleCopyCode(e, order.pickupCode, order.id)}
            title="Click to copy pickup OTP"
            style={{
              background: isReady ? '#f0fdf4' : '#faf5f6',
              border: `1.5px dashed ${isReady ? '#22c55e' : '#b10035'}`,
              borderRadius: '10px',
              padding: '0.35rem 0.65rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.01)';
              e.currentTarget.style.borderColor = isReady ? '#16a34a' : '#8e002a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.borderColor = isReady ? '#22c55e' : '#b10035';
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: isReady ? '#16a34a' : '#b10035',
                  textTransform: 'uppercase',
                  lineHeight: 1.1,
                }}
              >
                {isReady ? '🎉 READY' : 'PICKUP OTP'}
              </span>
              <span
                style={{
                  fontSize: '0.6rem',
                  color: copiedId === order.id ? '#16a34a' : '#6b7280',
                  fontWeight: copiedId === order.id ? 700 : 500,
                  lineHeight: 1.1,
                  marginTop: '0.1rem',
                }}
              >
                {copiedId === order.id ? '✓ Copied!' : 'Show at counter'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  color: isReady ? '#15803d' : '#8e002a',
                  fontFamily: 'monospace, ui-monospace, sans-serif',
                  lineHeight: 1,
                }}
              >
                {order.pickupCode}
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>📋</span>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#f9fafb',
              borderRadius: '8px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              color: '#6b7280',
              textAlign: 'center',
            }}
          >
            OTP ready upon confirmation
          </div>
        )}

        {/* Pickup Time Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.62rem',
            fontWeight: 600,
            color: isReady ? '#15803d' : '#4b5563',
            background: isReady ? '#f0fdf4' : '#f9fafb',
            border: `1px solid ${isReady ? '#bbf7d0' : '#f3f4f6'}`,
            borderRadius: '6px',
            padding: '0.2rem 0.45rem',
            lineHeight: 1.2,
          }}
        >
          <span style={{ fontSize: '0.72rem', flexShrink: 0 }}>⏱</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isReady
              ? 'Please pick up your order within 15 minutes'
              : 'Please pick up your order within 15 minutes once ready'}
          </span>
        </div>

        {/* Compact Mini Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
          {STEPS.map((s, idx) => {
            const isCompleted = idx < config.step;
            const isCurrent = idx === config.step - 1;

            return (
              <React.Fragment key={s.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.15rem',
                  }}
                >
                  <span
                    style={{
                      width: '13px',
                      height: '13px',
                      borderRadius: '50%',
                      background: isCompleted
                        ? '#16a34a'
                        : isCurrent
                        ? config.tone
                        : '#e5e7eb',
                      color: isCompleted || isCurrent ? '#ffffff' : '#9ca3af',
                      fontSize: '8px',
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
                      fontSize: '0.62rem',
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
            paddingTop: '0.35rem',
            fontSize: '0.68rem',
          }}
        >
          {activeOrders.length > 1 ? (
            <span
              style={{
                color: '#b10035',
                fontWeight: 600,
                background: '#fff1f2',
                padding: '0.1rem 0.35rem',
                borderRadius: '9999px',
                border: '1px solid #fecdd3',
              }}
            >
              +{activeOrders.length - 1} more
            </span>
          ) : (
            <span style={{ color: '#9ca3af', fontWeight: 500 }}>
              Live status
            </span>
          )}

          <span
            style={{
              color: '#b10035',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.15rem',
            }}
          >
            {activeOrders.length > 1 ? `View all (${activeOrders.length}) →` : 'View order →'}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default ActiveOrderBanner;
