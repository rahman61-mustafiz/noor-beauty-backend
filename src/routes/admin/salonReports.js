const router     = require('express').Router();
const adminAuth  = require('../../middleware/adminAuth');
const SalonVisit = require('../../models/SalonVisit');
const Booking    = require('../../models/Booking');

const BD  = 6 * 60 * 60 * 1000; // BD is UTC+6
const pad = (n) => String(n).padStart(2, '0');
function bdDateStr(d) {
  const t = new Date(new Date(d).getTime() + BD);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
function rangeFromQuery(q) {
  const todayBd = bdDateStr(new Date());
  const fromStr = q.from || todayBd;
  const toStr   = q.to   || todayBd;
  return {
    start: new Date(`${fromStr}T00:00:00.000+06:00`),
    end:   new Date(`${toStr}T23:59:59.999+06:00`),
  };
}

// ── GET /api/admin/salon-reports/dashboard?from&to (defaults to today) ────────
// Unified metrics. Revenue = tablet visits + app bookings. Payment split and
// discounts come from tablet visits (app bookings have no payment method).
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const { start, end } = rangeFromQuery(req.query);

    const visits = await SalonVisit.find({ date: { $gte: start, $lte: end } })
      .sort({ date: -1 })
      .populate('staff', 'name')
      .lean();

    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'completed'] },
      startTime: { $gte: start, $lte: end },
    }).populate('staff', 'name').lean();

    const visitRevenue   = visits.reduce((s, v) => s + (v.finalAmount || 0), 0);
    const bookingRevenue = bookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const totalRevenue   = visitRevenue + bookingRevenue;

    const servicesDone  = visits.reduce((s, v) => s + (v.items ? v.items.length : 0), 0);
    const discountTotal = visits.reduce((s, v) => s + (v.discountAmount || 0), 0);
    const discountCount = visits.filter((v) => (v.discountAmount || 0) > 0).length;

    const payment = { cash: 0, bkash: 0, card: 0 };
    visits.forEach((v) => {
      if (payment[v.paymentMethod] != null) payment[v.paymentMethod] += v.finalAmount || 0;
    });

    const custSet = new Set();
    visits.forEach((v) => custSet.add(v.customerPhone || v.customerName));

    // ── Beautician performance (work split) ──
    // Tablet visit: finalAmount split equally across assigned staff.
    // App booking: single assigned staff gets the full amount.
    const bmap = {};
    function credit(id, name, amount) {
      if (!id) return;
      if (!bmap[id]) bmap[id] = { id, name: name || 'Unknown', amount: 0, count: 0 };
      bmap[id].amount += amount;
      bmap[id].count  += 1;
    }
    visits.forEach((v) => {
      const n = (v.staff || []).length;
      if (n === 0) return;
      const share = (v.finalAmount || 0) / n;
      v.staff.forEach((s) => credit(s._id.toString(), s.name, share));
    });
    bookings.forEach((b) => {
      if (b.staff && b.staff._id) credit(b.staff._id.toString(), b.staff.name, b.totalAmount || 0);
    });

    const beauticians = Object.values(bmap)
      .map((b) => ({ ...b, amount: Math.round(b.amount) }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      data: {
        from: start, to: end,
        customerCount: custSet.size,
        totalRevenue, visitRevenue, bookingRevenue,
        servicesDone, discountTotal, discountCount,
        payment,
        todaysCustomers: visits.map((v) => ({
          name: v.customerName,
          phone: v.customerPhone || '',
          services: (v.items || []).map((i) => i.name),
          finalAmount: v.finalAmount,
          paymentMethod: v.paymentMethod,
          source: v.customerSource,
        })),
        beauticians,
      },
    });
  } catch (err) {
    console.error('salon dashboard error:', err);
    res.status(500).json({ message: 'Failed to load dashboard' });
  }
});

// ── GET /api/admin/salon-reports/sales?from&to ────────────────────────────────
// Unified transaction list (tablet visits + app bookings), with per-day and
// per-client rollups. Mirrors the existing reports pattern, additively.
router.get('/sales', adminAuth, async (req, res) => {
  try {
    const { start, end } = rangeFromQuery(req.query);

    const visits = await SalonVisit.find({ date: { $gte: start, $lte: end } })
      .sort({ date: -1 }).lean();
    const bookings = await Booking.find({
      status: { $in: ['confirmed', 'completed'] },
      startTime: { $gte: start, $lte: end },
    }).populate('customer', 'name phone').lean();

    let total = 0;
    const byDayMap = {}, byClientMap = {}, transactions = [];

    function addRow(amount, when, name, phone, serviceName, source, paymentMethod) {
      const amt = amount || 0;
      total += amt;
      const dayKey = bdDateStr(when);
      if (!byDayMap[dayKey]) byDayMap[dayKey] = { date: dayKey, total: 0, count: 0 };
      byDayMap[dayKey].total += amt;
      byDayMap[dayKey].count += 1;
      const cname = name || 'Guest';
      const cphone = phone || '';
      const ckey = cphone || cname;
      if (!byClientMap[ckey]) byClientMap[ckey] = { name: cname, phone: cphone, total: 0, count: 0 };
      byClientMap[ckey].total += amt;
      byClientMap[ckey].count += 1;
      transactions.push({ date: when, clientName: cname, clientPhone: cphone, serviceName: serviceName || 'Service', amount: amt, source, paymentMethod: paymentMethod || '' });
    }

    visits.forEach((v) => {
      const svcNames = (v.items || []).map((i) => i.name).join(', ') || 'Service';
      addRow(v.finalAmount, v.date, v.customerName, v.customerPhone, svcNames, 'tablet', v.paymentMethod);
    });
    bookings.forEach((b) => {
      addRow(b.totalAmount, b.startTime, b.customer?.name, b.customer?.phone, b.serviceName || 'Service', 'app', '');
    });

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    const byDay = Object.values(byDayMap).sort((a, b) => (a.date < b.date ? 1 : -1));
    const byClient = Object.values(byClientMap).sort((a, b) => b.total - a.total);

    res.json({ data: { from: start, to: end, total, count: visits.length + bookings.length, byDay, byClient, transactions } });
  } catch (err) {
    console.error('salon sales error:', err);
    res.status(500).json({ message: 'Failed to load sales report' });
  }
});

module.exports = router;
