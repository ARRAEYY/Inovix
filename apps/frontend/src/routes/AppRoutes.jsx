import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Auth Pages
import StudentLogin from '../pages/auth/StudentLogin';
import OutletLogin from '../pages/auth/OutletLogin';
import AdminLogin from '../pages/auth/AdminLogin';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import Onboarding from '../pages/student/Onboarding';

// Dashboards (Dummy)
import StudentHome from '../pages/student/Home';
import StudentOrders from '../pages/student/Orders';
import OutletMenu from '../pages/student/OutletMenu';
import Profile from '../pages/student/Profile';
import OutletDashboard from '../pages/outlet/Dashboard';
import OutletMenuPage from '../pages/outlet/OutletMenuPage';
import OutletProfile from '../pages/outlet/OutletProfile';
import OutletAdminDashboard from '../pages/outlet/admin/OutletAdminDashboard';
import OutletAdminOrders from '../pages/outlet/admin/OutletAdminOrders';
import OutletAdminMenu from '../pages/outlet/admin/OutletAdminMenu';
import OutletAdminStaff from '../pages/outlet/admin/OutletAdminStaff';
import OutletAdminHours from '../pages/outlet/admin/OutletAdminHours';
import AdminDashboard from '../pages/admin/Dashboard';
import Outlets from '../pages/admin/Outlets';
import Users from '../pages/admin/Users';
import AdminOrders from '../pages/admin/Orders';
import AdminMenu from '../pages/admin/Menu';
import AdminStaff from '../pages/admin/Staff';
import AdminProfile from '../pages/admin/Profile';
import AdminSettings from '../pages/admin/Settings';
import NotFound from '../pages/NotFound';
// A simple PrivateRoute component to protect dashboard routes
const PrivateRoute = ({ children, allowedRolePrefix }) => {
  const { isAuthenticated, user } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  
  // Basic role check: if a specific role prefix is required
  if (allowedRolePrefix && user?.role && !user.role.startsWith(allowedRolePrefix)) {
    // If not authorized for this route, go to root (or an unauthorized page)
    return <Navigate to="/" replace />;
  }
  
  return children;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes - Auth */}
      <Route path="/" element={<StudentLogin />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/outlet/login" element={<OutletLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      {/* Protected Routes - Student */}
      <Route 
        path="/student/*" 
        element={
          <PrivateRoute allowedRolePrefix="STUDENT">
            <Routes>
              <Route path="/" element={<StudentHome />} />
              <Route path="/orders" element={<StudentOrders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/outlet/:id" element={<OutletMenu />} />
            </Routes>
          </PrivateRoute>
        } 
      />

      {/* Protected Routes - Outlet */}
      <Route 
        path="/outlet/*" 
        element={
          <PrivateRoute allowedRolePrefix="OUTLET">
            <Routes>
              <Route path="/" element={<OutletDashboard />} />
              <Route path="/menu" element={<OutletMenuPage />} />
              <Route path="/profile" element={<OutletProfile />} />
            </Routes>
          </PrivateRoute>
        } 
      />

      {/* Protected Routes - Outlet Admin */}
      <Route 
        path="/outlet/admin/*" 
        element={
          <PrivateRoute allowedRolePrefix="OUTLET_ADMIN">
            <Routes>
              <Route path="/" element={<OutletAdminDashboard />} />
              <Route path="/orders" element={<OutletAdminOrders />} />
              <Route path="/menu" element={<OutletAdminMenu />} />
              <Route path="/staff" element={<OutletAdminStaff />} />
              <Route path="/hours" element={<OutletAdminHours />} />
            </Routes>
          </PrivateRoute>
        } 
      />

      {/* Protected Routes - Admin */}
      <Route 
        path="/admin/*" 
        element={
          <PrivateRoute allowedRolePrefix="SUPER_ADMIN">
            <Routes>
              <Route path="/" element={<AdminDashboard />} />
              <Route path="/outlets" element={<Outlets />} />
              <Route path="/users" element={<Users />} />
              <Route path="/orders" element={<AdminOrders />} />
              <Route path="/menu" element={<AdminMenu />} />
              <Route path="/staff" element={<AdminStaff />} />
              <Route path="/profile" element={<AdminProfile />} />
              <Route path="/settings" element={<AdminSettings />} />
            </Routes>
          </PrivateRoute>
        } 
      />
      {/* 404 catch-all — any unmatched path shows the NotFound page */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
