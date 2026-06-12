const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Booking = require('../models/Booking');
const Service = require('../models/Service');

const isObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

router.post('/', auth, async (req, res) => {
  try {
    const {
      serviceId, serviceName, staffId,
      bookingDate, startTime, durationMinutes,
      totalAmount, notes,
    } = req.body;

    let start;
    if (bookingDate && typeof startTime === 'string' && /^\d{1,2}:\d{2}$/.test(startTime)) {
      start = new Date(`${bookingDate}T${startTime.padStart(5, '0')}:00+06:00`);
    } else if (startTime) {
      start = new Date(startTime);
    }
    if (!start || isNaN(start.getTime())) start = new Date();

    const dur = Number(durationMinutes) || 60;
    const end = new Date(start.getTime() + dur * 60 * 1000);

    let serviceRef;
    let amount = (totalAmount != null && totalAmount !== '') ? Number(totalAmount) : null;
    let name = serviceName;
    if (isObjectId(serviceId)) {
      const svc = await Service.findById(serviceId);
      if (svc) {
        serviceRef = svc._id;
        if (amount == null) amount = svc.price;
        if (!name) name = svc.name;
      }
    }

    const booking = await Booking.create({
      customer:    req.userId,
      service:     serviceRef,
      serviceName: name || 'Service',
      staff:       isObjectId(staffId) ? staffId : undefined,
      startTime:   start,
      endTime:     end,
      totalAmount: amount != null ? amount : 0,
      notes,
    });

    res.status(201).json({ data: { id: booking._id.toString(), status: booking.status } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create booking' });
  }
});

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
    serviceName: b.serviceName || b.service?.name || 'Service',
    servicePrice: b.totalAmount != null ? b.totalAmount : (b.service?.price || 0),
    stylistName: b.staff?.name || 'Salon assigns',
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes || '',
  };
}

module.exports = router;