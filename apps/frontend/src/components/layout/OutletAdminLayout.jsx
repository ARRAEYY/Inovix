import React from 'react';
import OutletAdminSidebar from './OutletAdminSidebar';
import OutletAdminMobileHeader from './OutletAdminMobileHeader';
import OutletAdminBottomNav from './OutletAdminBottomNav';
import '../../styles/outlet-dashboard.css'; // Re-using styles

const OutletAdminLayout = ({ children }) => {
  return (
    <div className="outlet-layout">
      <OutletAdminSidebar />
      <div className="outlet-main-wrapper">
        <OutletAdminMobileHeader />
        <main className="outlet-main-content">
          {children}
        </main>
        <OutletAdminBottomNav />
      </div>
    </div>
  );
};

export default OutletAdminLayout;
