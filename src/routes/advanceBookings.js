const router = require('express').Router();

const AdvanceBooking = require('../models/AdvanceBooking');
const SalonVisit      = require('../models/SalonVisit');
const SalonCustomer   = require('../models/SalonCustomer');
const User            = require('../models/User'); // READ ONLY here

const tabletAuth = require('../middleware/tabletAuth');
router.use(tabletAuth); // guard all advance-booking endpoints, same as the rest of /api/tablet

const isObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

function splitOf(payments) {
  return {
    cash:  Math.max(0, Number(payments && payments.cash)  || 0),
    bkash: Math.max(0, Number(payments && payments.bkash) || 0),
    card:  Math.max(0, Number(payments && payments.card)  || 0),
  };
}
function splitTotal(s) { return s.cash + s.bkash + s.card; }

// ── GET /api/tablet/advance-bookings?status=pending|settled|cancelled|all ────
// Defaults to pending, soonest event first.
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const filter = status === 'all' ? {} : { status };
    const bookings = await AdvanceBooking.find(filter)
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
        staff: (b.staff || []).map((s) => ({ id: s._id.toString(), name: s.name })),
        totalAmount: b.totalAmount,
        advanceAmount: b.advanceAmount,
        dueAmount: b.dueAmount,
        status: b.status,
        note: b.note || '',
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    console.error('advance-bookings list error:', err);
    res.status(500).json({ message: 'Failed to load advance bookings' });
  }
});

// ── POST /api/tablet/advance-bookings ─────────────────────────────────────────
// Create a future booking with a deposit. The deposit counts as revenue today
// (see /today-sales); the remaining balance counts when settled.
router.post('/', async (req, res) => {
  try {
    const {
      customerName, customerPhone, eventDate,
      items = [], staffIds = [],
      advanceAmount, payments, note,
    } = req.body;

    if (!customerName) return res.status(400).json({ message: 'Customer name is required' });
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one service is required' });
    }
    const eDate = new Date(eventDate);
    if (!eventDate || isNaN(eDate.getTime())) {
      return res.status(400).json({ message: 'A valid event date is required' });
    }

    const lineItems = items.map((it) => ({
      service: isObjectId(it.serviceId) ? it.serviceId : undefined,
      name: it.name,
      price: Number(it.price) || 0,
      quantity: Math.max(1, Math.round(Number(it.quantity) || 1)),
    }));
    const totalAmount = lineItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

    const advance = Math.round(Number(advanceAmount) || 0);
    if (advance <= 0) return res.status(400).json({ message: 'Advance amount must be greater than 0' });
    if (advance > totalAmount) {
      return res.status(400).json({ message: `Advance (৳${advance}) cannot exceed the total (৳${totalAmount})` });
    }
    const dueAmount = totalAmount - advance;

    const split = splitOf(payments);
    if (Math.abs(splitTotal(split) - advance) > 1) {
      return res.status(400).json({
        message: `Payment split (৳${splitTotal(split)}) must equal the advance amount (৳${advance})`,
      });
    }

    const phone = customerPhone ? User.normalizePhone(customerPhone) : '';

    const booking = await AdvanceBooking.create({
      customerName,
      customerPhone: phone,
      eventDate: eDate,
      items: lineItems,
      staff: (staffIds || []).filter(isObjectId),
      totalAmount,
      advanceAmount: advance,
      dueAmount,
      advancePayments: split,
      note,
    });

    // Same walk-in customer bookkeeping as a normal visit (never touches `User`).
    if (phone) {
      const appUser = await User.findOne({ phone }).lean();
      if (!appUser) {
        await SalonCustomer.findOneAndUpdate(
          { phone },
          { $set: { name: customerName }, $setOnInsert: { phone, visitCount: 0, totalSpent: 0 } },
          { upsert: true, setDefaultsOnInsert: true }
        );
      }
    }

    res.status(201).json({
      data: {
        id: booking._id.toString(),
        totalAmount, advanceAmount: advance, dueAmount,
      },
    });
  } catch (err) {
    console.error('advance-booking create error:', err);
    res.status(500).json({ message: 'Failed to create advance booking' });
  }
});

// ── POST /api/tablet/advance-bookings/:id/settle ──────────────────────────────
// Collect the remaining balance on the event day. Creates a normal SalonVisit
// for the DUE amount only (the advance was already counted as revenue on the
// day it was taken), so today's sales total is exactly what was collected today.
router.post('/:id/settle', async (req, res) => {
  try {
    const { payments, staffIds } = req.body;

    const booking = await AdvanceBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Advance booking not found' });
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `This booking is already ${booking.status}` });
    }

    const split = splitOf(payments);
    if (Math.abs(splitTotal(split) - booking.dueAmount) > 1) {
      return res.status(400).json({
        message: `Payment split (৳${splitTotal(split)}) must equal the due amount (৳${booking.dueAmount})`,
      });
    }

    const staff = Array.isArray(staffIds) && staffIds.length
      ? staffIds.filter(isObjectId)
      : (booking.staff || []).map((s) => s.toString());

    const dominantMethod = ['cash', 'bkash', 'card']
      .reduce((best, m) => (split[m] > split[best] ? m : best), 'cash');

    const visit = await SalonVisit.create({
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerSource: 'walkin',
      items: booking.items,
      staff,
      subtotal: booking.totalAmount,
      discountPercent: 0,
      discountAmount: 0,
      finalAmount: booking.dueAmount,
      payments: split,
      paymentMethod: dominantMethod,
      source: 'advance-settlement',
      note: `Advance booking settled — total ৳${booking.totalAmount} (৳${booking.advanceAmount} advance collected ${booking.createdAt.toDateString()}, ৳${booking.dueAmount} due collected today).`,
      advanceApplied: booking.advanceAmount,
      advanceBookingRef: booking._id,
    });

    if (booking.customerPhone) {
      await SalonCustomer.findOneAndUpdate(
        { phone: booking.customerPhone },
        {
          $set: { name: booking.customerName, lastVisitAt: new Date() },
          $inc: { visitCount: 1, totalSpent: booking.totalAmount },
          $setOnInsert: { phone: booking.customerPhone },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    booking.status = 'settled';
    booking.duePayments = split;
    booking.settledVisit = visit._id;
    booking.settledAt = new Date();
    await booking.save();

    res.json({
      data: {
        id: booking._id.toString(),
        visitId: visit._id.toString(),
        dueAmount: booking.dueAmount,
        status: booking.status,
      },
    });
  } catch (err) {
    console.error('advance-booking settle error:', err);
    res.status(500).json({ message: 'Failed to settle advance booking' });
  }
});

// ── PATCH /api/tablet/advance-bookings/:id/cancel ─────────────────────────────
router.patch('/:id/cancel', async (req, res) => {
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
    console.error('advance-booking cancel error:', err);
    res.status(500).json({ message: 'Failed to cancel advance booking' });
  }
});

module.exports = router;
