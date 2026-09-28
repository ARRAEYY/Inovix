import React from 'react';
import OutletSidebar from './OutletSidebar';
import OutletMobileHeader from './OutletMobileHeader';
import OutletBottomNav from './OutletBottomNav';
import '../../styles/outlet-dashboard.css';

const OutletLayout = ({ children }) => {
  return (
    <div className="outlet-layout">
      <OutletSidebar />
      <div className="outlet-main-wrapper">
        <OutletMobileHeader />
        <main className="outlet-main-content">
          {children}
        </main>
        <OutletBottomNav />
      </div>
    </div>
  );
};

export default OutletLayout;
