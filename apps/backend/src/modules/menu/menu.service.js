const menuRepo = require('./menu.repository');
const { categories } = require('../../data/mockData');

const validateMenuItemData = (data) => {
  const { name, price, category } = data;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw { status: 400, message: 'Valid name is required' };
  }

  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) <= 0) {
    throw { status: 400, message: 'Price must be a number greater than 0' };
  }

  if (!category || !categories.includes(category)) {
    throw { status: 400, message: `Invalid category. Must be one of: ${categories.join(', ')}` };
  }

  if (data.preparationTime !== undefined && data.preparationTime !== null) {
    if (isNaN(Number(data.preparationTime)) || Number(data.preparationTime) < 0 || !Number.isInteger(Number(data.preparationTime))) {
      throw { status: 400, message: 'Preparation time must be a positive integer' };
    }
  }

  if (data.discount !== undefined && data.discount !== null) {
    // We allow string discounts like '10%' or numbers. If it's a number, it shouldn't be negative.
    if (typeof data.discount === 'number' && data.discount < 0) {
      throw { status: 400, message: 'Discount cannot be negative' };
    }
  }
};

const sanitizeInput = (data, outletId) => {
  return {
    outletId,
    name: data.name.trim(),
    description: data.description ? data.description.trim() : '',
    price: Number(data.price),
    category: data.category,
    image: data.image || null,
    isAvailable: data.isAvailable !== undefined ? Boolean(data.isAvailable) : true,
    discount: data.discount || null,
    popular: data.popular !== undefined ? Boolean(data.popular) : false,
    vegetarian: data.vegetarian !== undefined ? Boolean(data.vegetarian) : false,
    preparationTime: data.preparationTime ? Number(data.preparationTime) : 0,
  };
};

const getOutletMenu = async (outletId) => {
  return await menuRepo.findAllByOutletId(outletId);
};

const getMenuItem = async (outletId, itemId) => {
  const item = await menuRepo.findById(itemId);
  if (!item) {
    throw { status: 404, message: 'Menu item not found' };
  }

  if (item.outletId !== outletId) {
    throw { status: 403, message: 'You are not authorized to view this item' };
  }

  return item;
};

const createMenuItem = async (outletId, data) => {
  validateMenuItemData(data);
  const sanitizedData = sanitizeInput(data, outletId);
  return await menuRepo.create(sanitizedData);
};

const updateMenuItem = async (outletId, itemId, data) => {
  // To allow partial updates like PATCH /availability, we first fetch the item
  const existingItem = await getMenuItem(outletId, itemId);

  // Merge data for validation
  const mergedData = { ...existingItem, ...data };
  validateMenuItemData(mergedData);

  // Sanitize updates but ensure outletId remains unchanged
  const updates = {
    name: mergedData.name.trim(),
    description: mergedData.description ? mergedData.description.trim() : '',
    price: Number(mergedData.price),
    category: mergedData.category,
    image: mergedData.image || null,
    isAvailable: mergedData.isAvailable !== undefined ? Boolean(mergedData.isAvailable) : true,
    discount: mergedData.discount || null,
    popular: mergedData.popular !== undefined ? Boolean(mergedData.popular) : false,
    vegetarian: mergedData.vegetarian !== undefined ? Boolean(mergedData.vegetarian) : false,
    preparationTime: mergedData.preparationTime ? Number(mergedData.preparationTime) : 0,
  };

  return await menuRepo.update(itemId, updates);
};

const deleteMenuItem = async (outletId, itemId) => {
  // Implicitly checks existence and ownership
  await getMenuItem(outletId, itemId);
  
  const success = await menuRepo.delete(itemId);
  if (!success) {
    throw { status: 500, message: 'Failed to delete menu item' };
  }
  
  return true;
};

module.exports = {
  getOutletMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem
};
