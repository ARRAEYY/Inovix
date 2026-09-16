const { menuItems } = require('../../data/mockData.js');

let currentMenuItems = [...menuItems];

const findAllByOutletId = async (outletId) => {
  return currentMenuItems.filter(item => item.outletId === outletId);
};

const findAll = async () => {
  return [...currentMenuItems];
};

const findById = async (itemId) => {
  return currentMenuItems.find(item => item.id === itemId) || null;
};

const create = async (itemData) => {
  const newItem = {
    ...itemData,
    id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
  };
  
  // Save to in-memory array (prepend to show newest first)
  currentMenuItems.unshift(newItem);
  return newItem;
};

const update = async (itemId, data) => {
  const itemIndex = currentMenuItems.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return null;

  // Preserve id and outletId
  const { id, outletId, ...updates } = data;

  currentMenuItems[itemIndex] = {
    ...currentMenuItems[itemIndex],
    ...updates,
  };

  return currentMenuItems[itemIndex];
};

const remove = async (itemId) => {
  const itemIndex = currentMenuItems.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return false;

  currentMenuItems.splice(itemIndex, 1);
  return true;
};

module.exports = {
  findAll,
  findAllByOutletId,
  findById,
  create,
  update,
  delete: remove
};
