const menuService = require('./menu.service');
const { audit } = require('../../lib/audit');

async function getOutletMenu(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const menu = await menuService.getOutletMenu(outletId);
    res.status(200).json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
}

async function getMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const { itemId } = req.params;
    const item = await menuService.getMenuItem(outletId, itemId);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

async function createMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const newItem = await menuService.createMenuItem(outletId, req.body);

    await audit({
      actorId: req.user.id,
      action: 'MENU_ITEM_CREATED',
      targetType: 'MenuItem',
      targetId: newItem.id,
      after: { name: newItem.name, price: newItem.price, outletId },
      req,
    });

    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    next(error);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const { itemId } = req.params;
    const updated = await menuService.updateMenuItem(outletId, itemId, req.body);

    await audit({
      actorId: req.user.id,
      action: 'MENU_ITEM_UPDATED',
      targetType: 'MenuItem',
      targetId: itemId,
      after: { name: updated.name, price: updated.price, isAvailable: updated.isAvailable },
      req,
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) throw { statusCode: 403, message: 'User is not assigned to an outlet' };
    const { itemId } = req.params;
    await menuService.deleteMenuItem(outletId, itemId);

    await audit({
      actorId: req.user.id,
      action: 'MENU_ITEM_DELETED',
      targetType: 'MenuItem',
      targetId: itemId,
      req,
    });

    res.status(200).json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getOutletMenu,
  getMenuItem,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
};
