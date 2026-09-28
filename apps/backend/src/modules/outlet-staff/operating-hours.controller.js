const prisma = require('../../lib/prisma');
const { audit } = require('../../lib/audit');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /outlet/operating-hours — returns the outlet's weekly hours
async function getOperatingHours(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) return res.status(400).json({ success: false, message: 'No outlet assigned' });
    let hours = await prisma.operatingHours.findMany({
      where: { outletId },
      orderBy: { dayOfWeek: 'asc' },
    });
    // If no hours exist yet, seed defaults (all days 9-21, not closed)
    if (hours.length === 0) {
      hours = await Promise.all(
        Array.from({ length: 7 }).map((_, dayOfWeek) =>
          prisma.operatingHours.create({
            data: { outletId, dayOfWeek, openTime: '09:00', closeTime: '21:00', isClosed: false },
          })
        )
      );
    }
    res.status(200).json({ success: true, data: hours.map(h => ({ ...h, dayName: DAYS[h.dayOfWeek] })) });
  } catch (error) { next(error); }
}

// PUT /outlet/operating-hours — updates the outlet's weekly hours
// Body: { hours: [{ dayOfWeek, openTime, closeTime, isClosed }, ...] }
async function updateOperatingHours(req, res, next) {
  try {
    const outletId = req.user.outletId;
    if (!outletId) return res.status(400).json({ success: false, message: 'No outlet assigned' });
    const { hours } = req.body;
    if (!Array.isArray(hours)) return res.status(400).json({ success: false, message: 'hours must be an array' });

    const updated = await Promise.all(
      hours.map(h =>
        prisma.operatingHours.upsert({
          where: { outletId_dayOfWeek: { outletId, dayOfWeek: h.dayOfWeek } },
          create: { outletId, dayOfWeek: h.dayOfWeek, openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
          update: { openTime: h.openTime, closeTime: h.closeTime, isClosed: h.isClosed },
        })
      )
    );

    await audit({ actorId: req.user.id, action: 'OPERATING_HOURS_UPDATED', targetType: 'Outlet', targetId: outletId, after: hours, req });
    res.status(200).json({ success: true, data: updated.map(h => ({ ...h, dayName: DAYS[h.dayOfWeek] })) });
  } catch (error) { next(error); }
}

module.exports = { getOperatingHours, updateOperatingHours };
