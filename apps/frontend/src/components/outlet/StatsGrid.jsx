import React from 'react';

const StatCard = ({ title, value, colorClass, isActive, onClick }) => {
  return (
    <div 
      className={`stat-card ${colorClass} ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
};

const StatsGrid = ({ stats, activeStatus, setActiveStatus }) => {
  return (
    <div className="stats-grid">
      <StatCard 
        title="NEW ORDERS" 
        value={stats.new} 
        colorClass="border-red"
        isActive={activeStatus === 'NEW'} 
        onClick={() => setActiveStatus('NEW')} 
      />
      <StatCard 
        title="PREPARING" 
        value={stats.preparing} 
        colorClass="border-orange"
        isActive={activeStatus === 'PREPARING'} 
        onClick={() => setActiveStatus('PREPARING')} 
      />
      <StatCard 
        title="READY FOR PICKUP" 
        value={stats.ready} 
        colorClass="border-blue"
        isActive={activeStatus === 'READY'} 
        onClick={() => setActiveStatus('READY')} 
      />
    </div>
  );
};

export default StatsGrid;
