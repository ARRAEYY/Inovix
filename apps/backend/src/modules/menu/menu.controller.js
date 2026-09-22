const menuService = require('./menu.service');

async function getOutletMenu(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const menu = await menuService.getOutletMenu(outletId);
    res.status(200).json({ success: true, data: menu });
  } catch (error) {
    next(error);
  }
}

async function getMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

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
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const newItem = await menuService.createMenuItem(outletId, req.body);
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    next(error);
  }
}

async function updateMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const { itemId } = req.params;
    const updatedItem = await menuService.updateMenuItem(outletId, itemId, req.body);
    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
}

async function updateAvailability(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const { itemId } = req.params;
    const { available } = req.body;
    
    if (available === undefined) {
      throw { status: 400, message: 'available status is required' };
    }

    const updatedItem = await menuService.updateAvailability(outletId, itemId, available);
    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
}

async function deleteMenuItem(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) {
      throw { status: 403, message: 'User is not assigned to an outlet' };
    }

    const { itemId } = req.params;
    await menuService.deleteMenuItem(outletId, itemId);
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
  updateAvailability,
  deleteMenuItem
};
