const router = require('express').Router();

const SalonVisit    = require('../models/SalonVisit');
const SalonCustomer = require('../models/SalonCustomer');
const Settings      = require('../models/Settings');
const Booking       = require('../models/Booking');      // READ ONLY here
const User          = require('../models/User');         // READ ONLY here
const Service       = require('../models/Service');      // READ ONLY here
const ServiceType   = require('../models/ServiceType');  // READ ONLY here
const Staff         = require('../models/Staff');         // READ ONLY here

const tabletAuth = require('../middleware/tabletAuth');
router.use(tabletAuth); // guard all tablet endpoints (enforced once TABLET_KEY is set)


const isObjectId = (v) => typeof v === 'string' && /^[0-9a-fA-F]{24}$/.test(v);

// Bangladesh is UTC+6. Mirrors the date logic in src/routes/admin/salonVisits.js.
const BD  = 6 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
function bdDateStr(d) {
  const t = new Date(new Date(d).getTime() + BD);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// ── GET /api/tablet/customer/:phone ───────────────────────────────────────────
// Recognize a returning customer. Reads the app's `User` collection AND the
// walk-in `SalonCustomer` collection. Never writes to `User`.
router.get('/customer/:phone', async (req, res) => {
  try {
    const phone = User.normalizePhone(req.params.phone || '');

    let name = '';
    let source = null; // 'app' | 'walkin' | null

    const walkin = await SalonCustomer.findOne({ phone }).lean();
    if (walkin) { name = walkin.name; source = 'walkin'; }

    const appUser = await User.findOne({ phone }).lean();
    if (appUser) { name = appUser.name || name; source = 'app'; }

    const recent = await SalonVisit.find({ customerPhone: phone })
      .sort({ date: -1 })
      .limit(5)
      .populate('staff', 'name')
      .lean();

    res.json({
      data: {
        found: !!(walkin || appUser),
        phone,
        name,
        source,
        visitCount: walkin ? walkin.visitCount : 0,
        lastVisitAt: walkin ? walkin.lastVisitAt : null,
        recentVisits: recent.map((v) => ({
          id: v._id.toString(),
          date: v.date,
          services: (v.items || []).map((i) => i.name),
          staff: (v.staff || []).map((s) => s.name),
          finalAmount: v.finalAmount,
        })),
      },
    });
  } catch (err) {
    console.error('tablet customer lookup error:', err);
    res.status(500).json({ message: 'Lookup failed' });
  }
});

// ── GET /api/tablet/services ──────────────────────────────────────────────────
// Active categories (ServiceType) + active services, in one call.
router.get('/services', async (req, res) => {
  try {
    const [types, services] = await Promise.all([
      ServiceType.find({ isActive: true }).sort({ order: 1, name: 1 }).lean(),
      Service.find({ isActive: true }).sort({ name: 1 }).lean(),
    ]);

    const countByType = {};
    services.forEach((s) => {
      const key = s.serviceType ? s.serviceType.toString() : 'uncategorized';
      countByType[key] = (countByType[key] || 0) + 1;
    });

    res.json({
      data: {
        categories: types.map((t) => ({
          id: t._id.toString(),
          name: t.name,
          icon: t.icon,
          order: t.order,
          count: countByType[t._id.toString()] || 0,
        })),
        services: services.map((s) => ({
          id: s._id.toString(),
          name: s.name,
          price: s.price,
          duration: s.duration,
          category: s.category || '',
          serviceTypeId: s.serviceType ? s.serviceType.toString() : null,
          variants: s.variants || [],
          imageUrl: s.imageUrl || '',
        })),
      },
    });
  } catch (err) {
    console.error('tablet services error:', err);
    res.status(500).json({ message: 'Failed to load services' });
  }
});

// ── GET /api/tablet/staff ─────────────────────────────────────────────────────
router.get('/staff', async (req, res) => {
  try {
    const staff = await Staff.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({
      data: staff.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        specialty: s.specialty || [],
        photoUrl: s.photoUrl || '',
      })),
    });
  } catch (err) {
    console.error('tablet staff error:', err);
    res.status(500).json({ message: 'Failed to load staff' });
  }
});

// ── GET /api/tablet/discount-cap ──────────────────────────────────────────────
router.get('/discount-cap', async (req, res) => {
  try {
    const cap = Number(await Settings.get('discountCapPercent', 20)) || 0;
    res.json({ data: { discountCapPercent: cap } });
  } catch (err) {
    console.error('tablet discount-cap error:', err);
    res.status(500).json({ message: 'Failed to load discount cap' });
  }
});

// ── POST /api/tablet/visit ────────────────────────────────────────────────────
// Create a salon visit. Discount is re-validated against the admin cap on the
// server (never trust the client). Walk-in customers are upserted into
// `SalonCustomer` only — the app's `User` collection is never written to.
router.post('/visit', async (req, res) => {
  try {
    const {
      customerPhone, customerName,
      items = [], staffIds = [],
      discountPercent, discountAmount,
      paymentMethod = 'cash', note,
    } = req.body;

    if (!customerName) {
      return res.status(400).json({ message: 'Customer name is required' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one service is required' });
    }

    const lineItems = items.map((it) => ({
      service: isObjectId(it.serviceId) ? it.serviceId : undefined,
      name: it.name,
      price: Number(it.price) || 0,
    }));
    const subtotal = lineItems.reduce((sum, it) => sum + it.price, 0);

    // Server-side discount cap enforcement
    const cap = Number(await Settings.get('discountCapPercent', 20)) || 0;
    const maxDiscount = Math.round((subtotal * cap) / 100);

    let discAmt = 0;
    if (discountAmount != null && discountAmount !== '') {
      discAmt = Number(discountAmount) || 0;
    } else if (discountPercent != null && discountPercent !== '') {
      discAmt = Math.round((subtotal * (Number(discountPercent) || 0)) / 100);
    }
    if (discAmt < 0) discAmt = 0;
    if (discAmt > maxDiscount) discAmt = maxDiscount; // clamp to admin cap
    const discPct = subtotal > 0 ? Math.round((discAmt / subtotal) * 100) : 0;
    const finalAmount = Math.max(0, subtotal - discAmt);

    // Decide customer source by reading `User` (no writes to it)
    const phone = customerPhone ? User.normalizePhone(customerPhone) : '';
    let customerSource = 'walkin';
    if (phone) {
      const appUser = await User.findOne({ phone }).lean();
      if (appUser) customerSource = 'app';
    }

    const visit = await SalonVisit.create({
      customerName,
      customerPhone: phone,
      customerSource,
      items: lineItems,
      staff: (staffIds || []).filter(isObjectId),
      subtotal,
      discountPercent: discPct,
      discountAmount: discAmt,
      finalAmount,
      paymentMethod,
      note,
    });

    // Maintain the walk-in customer record (never touches `User`)
    if (phone && customerSource === 'walkin') {
      await SalonCustomer.findOneAndUpdate(
        { phone },
        {
          $set: { name: customerName, lastVisitAt: new Date() },
          $inc: { visitCount: 1, totalSpent: finalAmount },
          $setOnInsert: { phone },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    res.status(201).json({
      data: {
        id: visit._id.toString(),
        subtotal,
        discountPercent: discPct,
        discountAmount: discAmt,
        finalAmount,
        paymentMethod,
      },
    });
  } catch (err) {
    console.error('tablet visit error:', err);
    res.status(500).json({ message: 'Failed to create visit' });
  }
});

// ── GET /api/tablet/today-bookings ────────────────────────────────────────────
// Read-only combined view of TODAY's bookings from both sources:
//   • walk-in tablet visits (SalonVisit)
//   • app online appointments (Booking, excluding cancelled)
// Returns only customer (name + phone), services, and the staff who serve.
// Never writes to any collection.
router.get('/today-bookings', async (req, res) => {
  try {
    const todayBd = bdDateStr(new Date());
    const start = new Date(`${todayBd}T00:00:00.000+06:00`);
    const end   = new Date(`${todayBd}T23:59:59.999+06:00`);

    const [visits, bookings] = await Promise.all([
      SalonVisit.find({ date: { $gte: start, $lte: end } })
        .populate('staff', 'name')
        .lean(),
      Booking.find({
        startTime: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      })
        .populate('customer', 'name phone')
        .populate('staff', 'name')
        .lean(),
    ]);

    const walkinRows = visits.map((v) => ({
      name: v.customerName,
      phone: v.customerPhone || '',
      services: (v.items || []).map((i) => i.name),
      staff: (v.staff || []).map((s) => s.name).filter(Boolean),
      _t: v.date ? new Date(v.date).getTime() : 0,
    }));

    const appRows = bookings.map((b) => ({
      name: b.customer?.name || 'Guest',
      phone: b.customer?.phone || '',
      services: [b.serviceName].filter(Boolean),
      staff: (b.staff ? [b.staff.name] : []).filter(Boolean),
      _t: b.startTime ? new Date(b.startTime).getTime() : 0,
    }));

    const bookings_ = [...walkinRows, ...appRows]
      .sort((a, b) => b._t - a._t)
      .map(({ _t, ...row }) => row); // drop internal sort key

    res.json({ data: { count: bookings_.length, bookings: bookings_ } });
  } catch (err) {
    console.error('tablet today-bookings error:', err);
    res.status(500).json({ message: 'Failed to load today\'s bookings' });
  }
});

module.exports = router;
