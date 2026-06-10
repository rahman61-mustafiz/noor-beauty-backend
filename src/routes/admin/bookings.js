const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Booking   = require('../../models/Booking');

router.get('/', adminAuth, async (req, res) => {
  try {
    const { status, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      filter.startTime = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999)),
      };
    }
    const bookings = await Booking.find(filter)
      .sort({ startTime: -1 })
      .populate('customer', 'name phone')
      .populate('service', 'name price')
      .populate('staff', 'name')
      .lean();
    res.json({ data: bookings.map(toDto) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load bookings' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ data: toDto(booking) });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

function toDto(b) {
  return {
    id: b._id.toString(),
    customerName: b.customer?.name || 'Unknown',
    customerPhone: b.customer?.phone || '',
    serviceName: b.service?.name || 'Unknown',
    servicePrice: b.service?.price || 0,
    stylistName: b.staff?.name || 'Unknown',
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes || '',
  };
}

module.exports = router;
