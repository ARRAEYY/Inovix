/**
 * Menu service — outlet-scoped CRUD + validation.
 *
 * Role policy (spec §3.1):
 *   - OUTLET_STAFF + OUTLET_ADMIN: view menu (read)
 *   - OUTLET_ADMIN only: create / update / delete items
 *
 * `outletId` always comes from req.user.outletId, never from req.body. This
 * prevents the cross-outlet forgery attack (TEST 1 in test-menu-e2e.js).
 */

const menuRepo = require('./menu.repository');
const prisma = require('../../lib/prisma');

async function getOutletMenu(outletId) {
  return menuRepo.findAllByOutletId(outletId);
}

async function getMenuItem(outletId, itemId) {
  const item = await menuRepo.findById(itemId);
  if (!item) throw { statusCode: 404, message: 'Menu item not found' };
  if (item.outletId !== outletId) {
    throw { statusCode: 403, message: 'You are not authorized to view this item' };
  }
  return item;
}

async function createMenuItem(outletId, data) {
  // Resolve or create the category
  let category = null;
  if (data.category) {
    category = await prisma.menuCategory.findUnique({
      where: { outletId_name: { outletId, name: data.category } },
    });
    if (!category) {
      category = await prisma.menuCategory.create({
        data: { outletId, name: data.category, sortOrder: 0 },
      });
    }
  }

  return menuRepo.create({
    outletId,
    categoryId: category?.id || null,
    name: data.name,
    description: data.description || '',
    price: data.price,
    imageUrl: data.image || null,
    isAvailable: data.isAvailable !== undefined ? data.isAvailable : true,
    discount: data.discount != null ? String(data.discount) : null,
    popular: data.popular || false,
    vegetarian: data.vegetarian || false,
    prepTimeMins: data.preparationTime || 0,
    dietaryFlags: (data.dietaryFlags || []).join(','),
  });
}

async function updateMenuItem(outletId, itemId, data) {
  const existing = await getMenuItem(outletId, itemId); // ownership-checked

  // Category resolution
  let categoryId = existing.categoryId;
  if (data.category && data.category !== existing.category?.name) {
    let cat = await prisma.menuCategory.findUnique({
      where: { outletId_name: { outletId, name: data.category } },
    });
    if (!cat) {
      cat = await prisma.menuCategory.create({ data: { outletId, name: data.category } });
    }
    categoryId = cat.id;
  }

  const updates = {
    name: data.name?.trim() || existing.name,
    description: data.description !== undefined ? data.description.trim() : existing.description,
    price: data.price !== undefined ? Number(data.price) : Number(existing.price),
    categoryId,
    imageUrl: data.image !== undefined ? (data.image || null) : existing.imageUrl,
    isAvailable: data.isAvailable !== undefined ? data.isAvailable : existing.isAvailable,
    discount: data.discount !== undefined ? (data.discount != null ? String(data.discount) : null) : existing.discount,
    popular: data.popular !== undefined ? data.popular : existing.popular,
    vegetarian: data.vegetarian !== undefined ? data.vegetarian : existing.vegetarian,
    prepTimeMins: data.preparationTime !== undefined ? Number(data.preparationTime) : existing.prepTimeMins,
    dietaryFlags: data.dietaryFlags ? data.dietaryFlags.join(',') : existing.dietaryFlags,
  };

  return menuRepo.update(itemId, updates);
}

async function deleteMenuItem(outletId, itemId) {
  await getMenuItem(outletId, itemId); // ownership-checked
  return menuRepo.delete(itemId);
}

module.exports = {
  getOutletMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
