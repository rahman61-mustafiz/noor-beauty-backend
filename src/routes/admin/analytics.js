const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Booking   = require('../../models/Booking');
const User      = require('../../models/User');
const Review    = require('../../models/Review');

router.get('/', adminAuth, async (req, res) => {
  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const [bookingsByService, bookingsByStaff, monthlyCounts, retentionData] =
      await Promise.all([
        Booking.aggregate([
          { $group: { _id: '$service', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'svc' } },
          { $unwind: { path: '$svc', preserveNullAndEmptyArrays: true } },
          { $project: { name: { $ifNull: ['$svc.name', 'Unknown'] }, count: 1 } },
        ]),
        Booking.aggregate([
          { $group: { _id: '$staff', bookings: { $sum: 1 } } },
          { $sort: { bookings: -1 } },
          { $limit: 5 },
          { $lookup: { from: 'staff', localField: '_id', foreignField: '_id', as: 'st' } },
          { $unwind: { path: '$st', preserveNullAndEmptyArrays: true } },
          { $project: { name: { $ifNull: ['$st.name', 'Unknown'] }, bookings: 1, rating: { $ifNull: ['$st.rating', 0] } } },
        ]),
        Booking.aggregate([
          { $match: { createdAt: { $gte: sixMonthsAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Booking.aggregate([
          { $group: { _id: '$customer', count: { $sum: 1 } } },
          { $group: { _id: null, total: { $sum: 1 }, returning: { $sum: { $cond: [{ $gt: ['$count', 1] }, 1, 0] } } } },
        ]),
      ]);

    const retention = retentionData[0] || { total: 0, returning: 0 };

    res.json({
      topServices: bookingsByService.map((s) => ({ name: s.name, count: s.count })),
      topStylists: bookingsByStaff.map((s) => ({ name: s.name, bookings: s.bookings, rating: s.rating })),
      monthlyTrends: monthlyCounts.map((m) => ({ month: m._id, bookings: m.bookings, newCustomers: 0 })),
      retentionRate: retention.total ? Math.round((retention.returning / retention.total) * 100) / 100 : 0,
    });
  } catch (err) {
    console.error('analytics error:', err);
    res.status(500).json({ message: 'Failed to load analytics' });
  }
});

module.exports = router;
