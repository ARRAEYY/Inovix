const express = require('express');
const { outlets, categories } = require('../../data/mockData');
const menuRepo = require('../menu/menu.repository');

const router = express.Router();

router.get('/outlets', (req, res) => {
  res.json({ success: true, data: outlets });
});

router.get('/outlets/:id', (req, res) => {
  const outlet = outlets.find(o => o.id === req.params.id);
  if (!outlet) return res.status(404).json({ success: false, message: 'Outlet not found' });
  res.json({ success: true, data: outlet });
});

router.get('/outlets/:id/menu', async (req, res) => {
  const menu = await menuRepo.findAllByOutletId(req.params.id);
  res.json({ success: true, data: menu });
});

router.get('/categories', (req, res) => {
  res.json({ success: true, data: categories });
});

// We need a quick way to get popular items across all menus.
// Since menuRepo only has findAllByOutletId right now, let's add findAll to menuRepo,
// or just do a quick hack here using the currentMenuItems inside menuRepo.
// Wait, we can add a findAll method to menuRepo.
router.get('/menu/popular', async (req, res) => {
  // Hack for Phase 7 mock data: we'll add findAll to menuRepo shortly
  const allItems = await menuRepo.findAll();
  const popular = allItems.filter(item => item.popular);
  res.json({ success: true, data: popular });
});

router.get('/search', async (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  if (!query) return res.json({ success: true, data: { outlets: [], menuItems: [] } });

  const matchedOutlets = outlets.filter(outlet => 
    outlet.name.toLowerCase().includes(query) ||
    outlet.tags.some(tag => tag.toLowerCase().includes(query))
  );

  const allItems = await menuRepo.findAll();
  const matchedItems = allItems.filter(item => 
    item.name.toLowerCase().includes(query) ||
    (item.description && item.description.toLowerCase().includes(query)) ||
    item.category.toLowerCase().includes(query)
  );

  res.json({ success: true, data: { outlets: matchedOutlets, menuItems: matchedItems } });
});

module.exports = router;
