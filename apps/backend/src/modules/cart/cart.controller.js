const cartService = require('./cart.service');

async function getCart(req, res, next) {
  try {
    const studentId = req.user.id;
    const { outletId } = req.query;
    const cart = await cartService.getCart(studentId, outletId);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

async function getActiveCart(req, res, next) {
  try {
    const cart = await cartService.getActiveCart(req.user.id);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

async function addItem(req, res, next) {
  try {
    const studentId = req.user.id;
    const { outletId } = req.params;
    const cart = await cartService.addItem(studentId, outletId, req.body);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const studentId = req.user.id;
    const { cartItemId } = req.params;
    const cart = await cartService.updateItem(studentId, cartItemId, req.body.quantity);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

async function removeItem(req, res, next) {
  try {
    const studentId = req.user.id;
    const { cartItemId } = req.params;
    const cart = await cartService.removeItem(studentId, cartItemId);
    res.status(200).json({ success: true, data: cart });
  } catch (error) {
    next(error);
  }
}

async function clearCart(req, res, next) {
  try {
    await cartService.clearCart(req.user.id);
    res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
}

async function getTotals(req, res, next) {
  try {
    const cart = await cartService.getActiveCart(req.user.id);
    const totals = cartService.computeTotals(cart);
    res.status(200).json({ success: true, data: totals });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCart, getActiveCart, addItem, updateItem, removeItem, clearCart, getTotals };
