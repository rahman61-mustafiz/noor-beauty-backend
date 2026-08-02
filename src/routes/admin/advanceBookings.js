const router = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const AdvanceBooking = require('../../models/AdvanceBooking');

// ── GET /api/admin/advance-bookings ───────────────────────────────────────────
// Pending + settled bookings for the SaaS panel's Bookings view/calendar.
// Cancelled bookings are excluded here on purpose — the record still exists
// (any deposit already taken must stay in historical revenue math), it's just
// hidden from this list. See models/AdvanceBooking.js and routes/advanceBookings.js
// (tablet side) for the create/settle/cancel flow itself.
router.get('/', adminAuth, async (req, res) => {
  try {
    const bookings = await AdvanceBooking.find({ status: { $ne: 'cancelled' } })
      .sort({ eventDate: 1 })
      .populate('staff', 'name')
      .lean();

    res.json({
      data: bookings.map((b) => ({
        id: b._id.toString(),
        customerName: b.customerName,
        customerPhone: b.customerPhone || '',
        eventDate: b.eventDate,
        items: (b.items || []).map((i) => ({ name: i.name, price: i.price, quantity: i.quantity || 1 })),
        staff: (b.staff || []).map((s) => s.name),
        totalAmount: b.totalAmount,
        advanceAmount: b.advanceAmount,
        dueAmount: b.dueAmount,
        status: b.status, // 'pending' | 'settled'
        note: b.note || '',
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('admin advance-bookings list error:', err);
    res.status(500).json({ message: 'Failed to load advance bookings' });
  }
});

// ── PATCH /api/admin/advance-bookings/:id/cancel ──────────────────────────────
// Soft-cancel only (see comment above) — never deleted, so any deposit already
// taken stays correct in past revenue reports.
router.patch('/:id/cancel', adminAuth, async (req, res) => {
  try {
    const booking = await AdvanceBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Advance booking not found' });
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `This booking is already ${booking.status}` });
    }
    booking.status = 'cancelled';
    await booking.save();
    res.json({ data: { id: booking._id.toString(), status: booking.status } });
  } catch (err) {
    console.error('admin advance-booking cancel error:', err);
    res.status(500).json({ message: 'Failed to cancel advance booking' });
  }
});

module.exports = router;
