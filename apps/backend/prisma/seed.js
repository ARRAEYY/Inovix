/**
 * Seed script — runs via `npm run db:seed` or automatically after `prisma migrate reset`.
 *
 * Idempotent: uses upsert keyed on natural unique fields (email, slug, orderNumber, pickupCode),
 * so running it twice won't duplicate data.
 *
 * Data source: refactored from the original src/data/mockUsers.js + mockData.js.
 * Dev test accounts (adilreyaz.*) keep their pre-baked bcrypt hashes so the
 * dev-login flow continues to work without re-hashing.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// Pre-computed bcrypt hashes (12 rounds) so seeding is fast.
// Dev-only passwords (DO NOT use in production):
//   adilreyaz.admin@nosh.local  → NoshAdmin@123
//   adilreyaz.outlet@nosh.local → NoshOutlet@123
const PREBAKED_HASHES = {
  admin: '$2b$12$eNYg96kD8o7KcEyswm5QRel6xBf3DUCgQIu44b.rtafkMzJ4X8Dk2',
  outlet: '$2b$12$DyaJApDYK3Upa5eHWHtCcOvU9tSAwPCeDpF1K5/e.PvkmNIRvfuI.',
};

const COLLEGE_DOMAIN = process.env.COLLEGE_EMAIL_DOMAIN || '.rishihood.edu.in';

async function main() {
  console.log('— Seeding Nosh dev database —');

  // ─── 1. Campus ────────────────────────────────────────────────────────
  const campus = await prisma.campus.upsert({
    where: { code: 'RH' },
    update: {},
    create: {
      name: 'Rishihood University',
      code: 'RH',
      domain: COLLEGE_DOMAIN,
    },
  });
  console.log(`  ✓ Campus: ${campus.name}`);

  // ─── 2. Outlets ──────────────────────────────────────────────────────
  const outletSpecs = [
    { slug: 'the-commons',    name: 'The Commons',       description: 'Main campus cafeteria serving meals and snacks.',           location: 'Block A, Ground Floor', tags: ['Meals','Beverages'],           rating: 4.5, estimatedTime: '15-20 min', status: 'OPEN',   featured: true },
    { slug: 'brew-and-bites', name: 'Brew & Bites',       description: 'Fresh coffee, pastries, and quick bites.',                location: 'Library Hub',            tags: ['Coffee','Snacks'],             rating: 4.8, estimatedTime: '5-10 min',  status: 'BUSY',   featured: true },
    { slug: 'curry-corner',   name: 'Curry Corner',       description: 'Authentic Indian curries and thalis.',                    location: 'Block B, 1st Floor',      tags: ['Indian','Meals'],              rating: 4.2, estimatedTime: '20-25 min', status: 'CLOSED', featured: false },
    { slug: 'adil-food-hub',  name: 'Adilreyaz Food Hub', description: 'Delicious quick bites and premium meals curated for dev.', location: 'Dev Campus, Level 42',   tags: ['Meals','Snacks','Beverages'],  rating: 4.9, estimatedTime: '10-15 min', status: 'OPEN',   featured: true },
  ];

  const outlets = {};
  for (const spec of outletSpecs) {
    const o = await prisma.outlet.upsert({
      where: { slug: spec.slug },
      update: {
        name: spec.name, description: spec.description, location: spec.location,
        tags: spec.tags.join(','), rating: spec.rating, estimatedTime: spec.estimatedTime,
        status: spec.status, featured: spec.featured, campusId: campus.id,
      },
      create: {
        slug: spec.slug, name: spec.name, description: spec.description, location: spec.location,
        tags: spec.tags.join(','), rating: spec.rating, estimatedTime: spec.estimatedTime,
        status: spec.status, featured: spec.featured, campusId: campus.id,
        defaultPrepMins: 15, pickupTimeoutMins: 30,
      },
    });
    outlets[spec.slug] = o;
    console.log(`  ✓ Outlet: ${o.name}`);

    // Operating hours: 9 AM to 9 PM daily; closed on Sunday
    for (let day = 0; day <= 6; day++) {
      const isClosed = day === 0;
      await prisma.operatingHours.upsert({
        where: { outletId_dayOfWeek: { outletId: o.id, dayOfWeek: day } },
        update: {},
        create: {
          outletId: o.id, dayOfWeek: day,
          openTime: isClosed ? '00:00' : '09:00',
          closeTime: isClosed ? '00:00' : '21:00',
          isClosed,
        },
      });
    }
  }

  // ─── 3. Categories ──────────────────────────────────────────────────
  const allCategories = ['Popular','Meals','Snacks','Beverages','Desserts','Healthy'];
  for (const o of Object.values(outlets)) {
    for (let i = 0; i < allCategories.length; i++) {
      await prisma.menuCategory.upsert({
        where: { outletId_name: { outletId: o.id, name: allCategories[i] } },
        update: { sortOrder: i },
        create: { outletId: o.id, name: allCategories[i], sortOrder: i },
      });
    }
  }

  async function catId(outletId, name) {
    const c = await prisma.menuCategory.findUnique({ where: { outletId_name: { outletId, name } } });
    return c?.id;
  }

  // ─── 4. Menu items (findFirst-based; idempotent by outletId+name) ───
  const menuSpecs = [
    { outletSlug: 'the-commons',   name: 'Miso sesame grain bowl',    description: 'Healthy grain bowl with fresh veggies and miso dressing.', price: 150, category: 'Meals',     image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80', discount: null,  popular: true,  vegetarian: true,  prepTimeMins: 15 },
    { outletSlug: 'the-commons',   name: 'Campus club sandwich',      description: 'Triple decker sandwich with chicken, lettuce, and mayo.',  price: 120, category: 'Snacks',    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=500&q=80', discount: '10%', popular: true,  vegetarian: false, prepTimeMins: 10 },
    { outletSlug: 'brew-and-bites',name: 'Cold brew coffee',          description: 'Overnight steeped cold brew.',                              price: 90,  category: 'Beverages', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80', discount: null,  popular: true,  vegetarian: true,  prepTimeMins: 5  },
    { outletSlug: 'curry-corner',  name: 'Paneer Butter Masala Thali',description: 'Served with 3 rotis, rice, and dal.',                     price: 180, category: 'Meals',     image: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80', discount: null,  popular: false, vegetarian: true,  prepTimeMins: 20, isAvailable: false },
    { outletSlug: 'adil-food-hub', name: 'Adil Special Burger',        description: 'Double patty signature burger.',                            price: 250, category: 'Meals',     image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80', discount: '20%', popular: true,  vegetarian: false, prepTimeMins: 15 },
    { outletSlug: 'adil-food-hub', name: 'Paneer Wrap',               description: 'Spicy paneer tikka wrapped in a soft tortilla.',           price: 150, category: 'Snacks',    image: 'https://images.unsplash.com/photo-1588167389502-d3b10b0ff1da?w=500&q=80',  discount: null,  popular: true,  vegetarian: true,  prepTimeMins: 10 },
    { outletSlug: 'adil-food-hub', name: 'Masala Fries',              description: 'Crispy fries tossed in secret masala.',                     price: 80,  category: 'Snacks',    image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=500&q=80', discount: null,  popular: false, vegetarian: true,  prepTimeMins: 5  },
    { outletSlug: 'adil-food-hub', name: 'Cold Coffee',               description: 'Classic creamy cold coffee.',                                price: 120, category: 'Beverages', image: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=500&q=80', discount: null,  popular: true,  vegetarian: true,  prepTimeMins: 5  },
    { outletSlug: 'adil-food-hub', name: 'Chocolate Brownie',         description: 'Fudgy walnut brownie served warm.',                         price: 90,  category: 'Desserts',  image: 'https://images.unsplash.com/photo-1606890737304-57a1ca8a5b62?w=500&q=80', discount: null,  popular: false, vegetarian: true,  prepTimeMins: 2  },
  ];

  for (const m of menuSpecs) {
    const outlet = outlets[m.outletSlug];
    if (!outlet) continue;
    const cId = await catId(outlet.id, m.category);
    const existing = await prisma.menuItem.findFirst({
      where: { outletId: outlet.id, name: m.name },
    });
    if (existing) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: {
          description: m.description, price: m.price, imageUrl: m.image,
          isAvailable: m.isAvailable !== undefined ? m.isAvailable : true,
          discount: m.discount, popular: m.popular, vegetarian: m.vegetarian,
          prepTimeMins: m.prepTimeMins, categoryId: cId,
        },
      });
    } else {
      await prisma.menuItem.create({
        data: {
          outletId: outlet.id, categoryId: cId, name: m.name,
          description: m.description, price: m.price, imageUrl: m.image,
          isAvailable: m.isAvailable !== undefined ? m.isAvailable : true,
          discount: m.discount, popular: m.popular, vegetarian: m.vegetarian,
          prepTimeMins: m.prepTimeMins,
        },
      });
    }
  }
  console.log('  ✓ Menu items');

  // ─── 5. Users ──────────────────────────────────────────────────────────
  const userSpecs = [
    { email: 'outlet1@rishihood.edu.in',       name: 'The Commons Staff',  role: 'OUTLET_ADMIN', outletSlug: 'the-commons',    onboardingCompleted: true },
    { email: 'outlet1.staff@rishihood.edu.in', name: 'The Commons Crew',   role: 'OUTLET_STAFF', outletSlug: 'the-commons',    onboardingCompleted: true },
    { email: 'outlet2@rishihood.edu.in',       name: 'Brew & Bites Staff', role: 'OUTLET_ADMIN', outletSlug: 'brew-and-bites', onboardingCompleted: true },
    { email: 'outlet2.staff@rishihood.edu.in', name: 'Brew & Bites Crew',  role: 'OUTLET_STAFF', outletSlug: 'brew-and-bites', onboardingCompleted: true },
    { email: 'outlet3@rishihood.edu.in',       name: 'Curry Corner Staff', role: 'OUTLET_ADMIN', outletSlug: 'curry-corner',  onboardingCompleted: true },
    { email: 'outlet3.staff@rishihood.edu.in', name: 'Curry Corner Crew',  role: 'OUTLET_STAFF', outletSlug: 'curry-corner',  onboardingCompleted: true },
    { email: 'outlet4@rishihood.edu.in',       name: 'Adil Hub Staff',     role: 'OUTLET_ADMIN', outletSlug: 'adil-food-hub',  onboardingCompleted: true },
    { email: 'outlet4.staff@rishihood.edu.in', name: 'Adil Hub Crew',     role: 'OUTLET_STAFF', outletSlug: 'adil-food-hub',   onboardingCompleted: true },
    { email: 'adil@rishihood.edu.in',          name: 'Adil Reyaz',         role: 'STUDENT',     outletSlug: null,             onboardingCompleted: true, profile: { fullName: 'Adil Reyaz', phone: '9876543210', course: 'BTech CS & AI', year: '2', collegeId: 'RU12345' } },
    { email: 'admin@rishihood.edu.in',         name: 'Platform Admin',    role: 'SUPER_ADMIN', outletSlug: null,             onboardingCompleted: true },
    { email: 'adilreyaz.admin@nosh.local',     name: 'Adilreyaz',         role: 'SUPER_ADMIN', outletSlug: null,             onboardingCompleted: true, passwordHash: PREBAKED_HASHES.admin },
    { email: 'adilreyaz.outlet@nosh.local',    name: 'Adilreyaz Outlet',  role: 'OUTLET_ADMIN',outletSlug: 'adil-food-hub',  onboardingCompleted: true, passwordHash: PREBAKED_HASHES.outlet },
  ];

  const usersByEmail = {};
  for (const u of userSpecs) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, onboardingCompleted: u.onboardingCompleted, passwordHash: u.passwordHash ?? null },
      create: {
        email: u.email, name: u.name, role: u.role,
        onboardingCompleted: u.onboardingCompleted,
        passwordHash: u.passwordHash ?? null, status: 'ACTIVE',
      },
    });
    usersByEmail[u.email] = user;

    if (u.outletSlug) {
      const outlet = outlets[u.outletSlug];
      const staffRole = u.role === 'OUTLET_ADMIN' ? 'ADMIN' : 'STAFF';
      await prisma.outletStaff.upsert({
        where: { userId_outletId: { userId: user.id, outletId: outlet.id } },
        update: { role: staffRole, acceptedAt: new Date() },
        create: { userId: user.id, outletId: outlet.id, role: staffRole, acceptedAt: new Date() },
      });
    }

    if (u.role === 'STUDENT' && u.profile) {
      await prisma.studentProfile.upsert({
        where: { userId: user.id },
        update: { fullName: u.profile.fullName, phone: u.profile.phone, course: u.profile.course, year: u.profile.year, collegeId: u.profile.collegeId },
        create: {
          userId: user.id, fullName: u.profile.fullName, phone: u.profile.phone,
          course: u.profile.course, year: u.profile.year, collegeId: u.profile.collegeId,
          submittedAt: new Date(),
        },
      });
    }
  }
  console.log(`  ✓ ${userSpecs.length} users + staff assignments + student profile`);

  // ─── 6. Sample orders ────────────────────────────────────────────────
  const student = usersByEmail['adil@rishihood.edu.in'];
  const commons = outlets['the-commons'];
  const brew = outlets['brew-and-bites'];

  const itemGrainBowl = await prisma.menuItem.findFirst({ where: { outletId: commons.id, name: 'Miso sesame grain bowl' } });
  const itemSandwich = await prisma.menuItem.findFirst({ where: { outletId: commons.id, name: 'Campus club sandwich' } });
  const itemColdBrew = await prisma.menuItem.findFirst({ where: { outletId: brew.id, name: 'Cold brew coffee' } });

  if (itemGrainBowl && itemSandwich) {
    const total = 150 + 2 * 120;
    const ord1 = await prisma.order.upsert({
      where: { orderNumber: 'NOSH-0001' },
      update: {},
      create: {
        orderNumber: 'NOSH-0001', studentId: student.id, outletId: commons.id,
        outletSnapshot: JSON.stringify({ id: commons.id, name: commons.name }),
        status: 'COMPLETED', subtotal: total, discount: 0, platformFee: 5, totalAmount: total + 5,
        notes: '', pickupCode: 'PICKUP0001',
        acceptedAt: new Date(Date.now() - 60 * 60 * 1000),
        readyAt: new Date(Date.now() - 50 * 60 * 1000),
        completedAt: new Date(Date.now() - 40 * 60 * 1000),
        timeline: JSON.stringify([
          { status: 'PENDING',   at: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
          { status: 'ACCEPTED',  at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
          { status: 'PREPARING', at: new Date(Date.now() - 58 * 60 * 1000).toISOString() },
          { status: 'READY',     at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
          { status: 'COMPLETED', at: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
        ]),
      },
    });
    await prisma.orderItem.createMany({
      data: [
        { orderId: ord1.id, menuItemId: itemGrainBowl.id, name: itemGrainBowl.name, price: itemGrainBowl.price, quantity: 1, imageUrl: itemGrainBowl.imageUrl, itemTotal: itemGrainBowl.price },
        { orderId: ord1.id, menuItemId: itemSandwich.id,  name: itemSandwich.name,  price: itemSandwich.price,  quantity: 2, imageUrl: itemSandwich.imageUrl,  itemTotal: itemSandwich.price * 2 },
      ],
    });
    await prisma.payment.upsert({
      where: { orderId: ord1.id },
      update: {},
      create: { orderId: ord1.id, amount: total + 5, status: 'PAID', method: 'ONLINE' },
    });
  }

  if (itemColdBrew) {
    const ord2 = await prisma.order.upsert({
      where: { orderNumber: 'NOSH-0002' },
      update: {},
      create: {
        orderNumber: 'NOSH-0002', studentId: student.id, outletId: brew.id,
        outletSnapshot: JSON.stringify({ id: brew.id, name: brew.name }),
        status: 'PREPARING', subtotal: 90, discount: 0, platformFee: 5, totalAmount: 95,
        notes: '', pickupCode: 'PICKUP0002',
        acceptedAt: new Date(Date.now() - 5 * 60 * 1000),
        timeline: JSON.stringify([
          { status: 'PENDING',   at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
          { status: 'ACCEPTED',  at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
          { status: 'PREPARING', at: new Date(Date.now() - 4 * 60 * 1000).toISOString() },
        ]),
      },
    });
    await prisma.orderItem.create({
      data: { orderId: ord2.id, menuItemId: itemColdBrew.id, name: itemColdBrew.name, price: itemColdBrew.price, quantity: 1, imageUrl: itemColdBrew.imageUrl, itemTotal: itemColdBrew.price },
    });
    await prisma.payment.upsert({
      where: { orderId: ord2.id },
      update: {},
      create: { orderId: ord2.id, amount: 95, status: 'PAID', method: 'ONLINE' },
    });
  }
  console.log('  ✓ 2 sample orders + payments');

  console.log('\n✓ Seed complete.');
  console.log('  Dev test accounts (dev-login only, NON-production):');
  console.log('    SUPER_ADMIN:   adilreyaz.admin@nosh.local  / NoshAdmin@123');
  console.log('    OUTLET_ADMIN:  adilreyaz.outlet@nosh.local / NoshOutlet@123');
  console.log('    Students:     adil@rishihood.edu.in       / (no password, Google-only)');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
