const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

// POST /api/bookings
router.post('/', auth, async (req, res) => {
  try {
    const { serviceId, staffId, startTime } = req.body;
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ message: 'Service not found' });

    const start = new Date(startTime);
    const end   = new Date(start.getTime() + service.duration * 60 * 1000);

    const booking = await Booking.create({
      customer: req.userId,
      service:  serviceId,
      staff:    staffId,
      startTime: start,
      endTime: end,
      totalAmount: service.price,
      notes: req.body.notes,
    });

    res.status(201).json({ data: { id: booking._id.toString(), status: booking.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create booking' });
  }
});

// GET /api/bookings/customer/:customerId
router.get('/customer/:customerId', auth, async (req, res) => {
  try {
    if (req.userId !== req.params.customerId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const bookings = await Booking.find({ customer: req.userId })
      .sort({ startTime: -1 })
      .populate('service', 'name price category')
      .populate('staff', 'name')
      .lean();
    res.json({ data: bookings.map(toDto) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load bookings' });
  }
});

// GET /api/bookings/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id)
      .populate('service', 'name price duration')
      .populate('staff', 'name')
      .lean();
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    if (b.customer.toString() !== req.userId) return res.status(403).json({ message: 'Forbidden' });
    res.json({ data: toDto(b) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load booking' });
  }
});

// PUT /api/bookings/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const b = await Booking.findById(req.params.id);
    if (!b) return res.status(404).json({ message: 'Booking not found' });
    if (b.customer.toString() !== req.userId) return res.status(403).json({ message: 'Forbidden' });
    if (req.body.status === 'cancelled') b.status = 'cancelled';
    await b.save();
    res.json({ data: { id: b._id.toString(), status: b.status } });
  } catch (err) {
    res.status(500).json({ message: 'Update failed' });
  }
});

function toDto(b) {
  return {
    id: b._id.toString(),
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
