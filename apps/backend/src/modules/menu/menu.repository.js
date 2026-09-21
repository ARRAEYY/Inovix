/**
 * Menu repository — Prisma-backed. All queries are outlet-scoped via the
 * `outletId` parameter (spec §3.2 Layer 3 — row-level filters).
 */

const prisma = require('../../lib/prisma');

async function findAllByOutletId(outletId) {
  return prisma.menuItem.findMany({
    where: { outletId },
    orderBy: [{ category: { sortOrder: 'asc' } }, { name: 'asc' }],
    include: { category: true },
  });
}

async function findAll() {
  return prisma.menuItem.findMany({ include: { category: true } });
}

async function findById(itemId) {
  return prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { category: true, customizationGroups: { include: { options: true } } },
  });
}

async function create(itemData) {
  return prisma.menuItem.create({ data: itemData, include: { category: true } });
}

async function update(itemId, updates) {
  return prisma.menuItem.update({
    where: { id: itemId },
    data: updates,
    include: { category: true },
  });
}

async function remove(itemId) {
  return prisma.menuItem.delete({ where: { id: itemId } });
}

module.exports = {
  findAll,
  findAllByOutletId,
  findById,
  create,
  update,
  delete: remove,
};
