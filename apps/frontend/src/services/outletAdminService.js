import api from './api/client';

export const getDashboardStats = async () => {
  const response = await api.get('/outlet/admin/dashboard');
  return response.data;
};

export const getOrders = async () => {
  const response = await api.get('/outlet/admin/orders');
  return response.data;
};

export const getMenu = async () => {
  const response = await api.get('/outlet/admin/menu');
  return response.data;
};

export const createMenuItem = async (itemData) => {
  const response = await api.post('/outlet/admin/menu', itemData);
  return response.data;
};

export const updateMenuItem = async (itemId, itemData) => {
  const response = await api.patch(`/outlet/admin/menu/${itemId}`, itemData);
  return response.data;
};

export const deleteMenuItem = async (itemId) => {
  const response = await api.delete(`/outlet/admin/menu/${itemId}`);
  return response.data;
};

export const updateMenuAvailability = async (itemId, isAvailable) => {
  const response = await api.patch(`/outlet/admin/menu/${itemId}/availability`, { isAvailable });
  return response.data;
};

export const getStaff = async () => {
  const response = await api.get('/outlet/admin/staff');
  return response.data;
};

export const createStaff = async (staffData) => {
  const response = await api.post('/outlet/admin/staff', staffData);
  return response.data;
};

export const updateStaffStatus = async (staffId, status) => {
  const response = await api.patch(`/outlet/admin/staff/${staffId}/status`, { status });
  return response.data;
};
