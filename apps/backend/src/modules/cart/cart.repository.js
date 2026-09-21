/**
 * Cart repository — server-side cart per spec §6.2.
 *
 * "Cart is server-side, not just localStorage, so logging in from another
 *  device keeps the cart." — TanStack Query + local useCart hook backed
 *  by POST /api/v1/cart/items on the frontend.
 *
 * One active cart per (student, outlet). Cart expires 24h after last update.
 */

const prisma = require('../../lib/prisma');
const { normalizeSelectedOptions } = require('../menu/customization');

// INO-AUDIT3-5 fix: include customizationGroups.options on menuItem so
// computeTotals in cart.service.js can look up the priceDelta for the
// cart item's selectedOptions. Previously computeTotals used only the
// base menu price, showing ₹100 instead of ₹130 when extra cheese at
// +₹30 was selected.
const CART_INCLUDE = {
  items: {
    include: {
      menuItem: {
        include: { customizationGroups: { include: { options: true } } },
      },
    },
  },
  outlet: { select: { id: true, name: true, slug: true, status: true } },
};

async function findOrCreateCart(studentId, outletId) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Try to find existing active cart for this student + outlet
  let cart = await prisma.cart.findUnique({
    where: { studentId_outletId: { studentId, outletId } },
    include: CART_INCLUDE,
  });

  if (cart) {
    // Refresh expiry
    cart = await prisma.cart.update({
      where: { id: cart.id },
      data: { expiresAt },
      include: CART_INCLUDE,
    });
    return cart;
  }

  // If the student has carts for OTHER outlets, expire them (only one active
  // cart per student in V1). Per spec §4 "One active cart per student per
  // outlet" — actually the spec allows one per outlet, but the frontend UX
  // wants one at a time. We'll expire older carts to avoid confusion.
  // (Behavior can be tuned later without a migration.)
  await prisma.cart.updateMany({
    where: { studentId, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  // INO-AUDIT8-#8: handle P2002 (unique-constraint race). Two concurrent
  // requests can both pass the findUnique (cart not found) above and both
  // try to create. The @@unique([studentId, outletId]) constraint means
  // one succeeds and the other gets P2002. Catch it + re-fetch.
  try {
    return await prisma.cart.create({
      data: { studentId, outletId, expiresAt },
      include: CART_INCLUDE,
    });
  } catch (err) {
    // Prisma P2002 = unique constraint violation
    if (err.code === 'P2002') {
      // Another request created the cart between our findUnique and create.
      // Re-fetch the now-existing cart.
      cart = await prisma.cart.findUnique({
        where: { studentId_outletId: { studentId, outletId } },
        include: CART_INCLUDE,
      });
      if (cart) {
        // Refresh expiry on the re-fetched cart
        return prisma.cart.update({
          where: { id: cart.id },
          data: { expiresAt },
          include: CART_INCLUDE,
        });
      }
    }
    throw err; // re-throw unexpected errors
  }
}

async function findByStudent(studentId) {
  // Return the student's most recently updated active cart
  return prisma.cart.findFirst({
    where: { studentId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: 'desc' },
    include: CART_INCLUDE,
  });
}

async function addItem(cartId, menuItemId, quantity, selectedOptions) {
  // INO-AUDIT3-6 fix: normalize selectedOptions (sort by groupId + optionId,
  // dedupe) before storing/comparing. The previous implementation compared
  // JSON.stringify(selectedOptions) directly, so the same logical set
  // in different order was treated as a different cart item:
  //   [{"groupId":"A","optionId":"1"},{"groupId":"B","optionId":"2"}]
  //   [{"groupId":"B","optionId":"2"},{"groupId":"A","optionId":"1"}]
  // Both represent the same customization choice; now they produce the
  // same normalized JSON string and merge into one cart item.
  const normalized = normalizeSelectedOptions(selectedOptions);
  const normalizedJson = JSON.stringify(normalized);

  // If the same menu item + same options exists, increment quantity
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, menuItemId, selectedOptions: normalizedJson },
  });
  if (existing) {
    return prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  }
  return prisma.cartItem.create({
    data: {
      cartId,
      menuItemId,
      quantity,
      selectedOptions: normalizedJson,
    },
  });
}

async function updateItemQuantity(cartItemId, quantity) {
  return prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity },
  });
}

async function removeItem(cartItemId) {
  return prisma.cartItem.delete({ where: { id: cartItemId } });
}

async function clearCart(cartId) {
  return prisma.cartItem.deleteMany({ where: { cartId } });
}

async function deleteCart(cartId) {
  return prisma.cart.delete({ where: { id: cartId } });
}

module.exports = {
  findOrCreateCart,
  findByStudent,
  addItem,
  updateItemQuantity,
  removeItem,
  clearCart,
  deleteCart,
  CART_INCLUDE,
};
