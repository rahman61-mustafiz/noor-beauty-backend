const router  = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Booking = require('../../models/Booking');
const User    = require('../../models/User');

router.get('/', adminAuth, async (req, res) => {
  try {
    const now   = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd   = new Date(now.setHours(23, 59, 59, 999));

    const [todayBookings, upcomingBookings, totalCustomers, newCustomersToday] =
      await Promise.all([
        Booking.countDocuments({ startTime: { $gte: todayStart, $lte: todayEnd } }),
        Booking.countDocuments({ startTime: { $gt: new Date() }, status: { $nin: ['cancelled'] } }),
        User.countDocuments({ isBanned: false }),
        User.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      ]);

    // 7-day customer growth
    const growthData = await Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const start = new Date(d.setHours(0, 0, 0, 0));
        const end   = new Date(d.setHours(23, 59, 59, 999));
        return User.countDocuments({ createdAt: { $gte: start, $lte: end } });
      })
    );

    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('customer', 'name')
      .populate('service', 'name')
      .populate('staff', 'name')
      .lean();

    res.json({
      todayBookings,
      upcomingBookings,
      totalCustomers,
      newCustomersToday,
      customerGrowthData: growthData,
      recentBookings: recentBookings.map((b) => ({
        id: b._id.toString(),
        customerName: b.customer?.name || 'Unknown',
        serviceName:  b.service?.name  || 'Unknown',
        stylistName:  b.staff?.name    || 'Unknown',
        startTime:    b.startTime,
        status:       b.status,
      })),
    });
  } catch (err) {
    console.error('dashboard error:', err);
    res.status(500).json({ message: 'Failed to load dashboard data' });
  }
});

module.exports = router;
