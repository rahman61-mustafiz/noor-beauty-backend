const router     = require('express').Router();
const adminAuth  = require('../../middleware/adminAuth');
const SalonVisit = require('../../models/SalonVisit');

const BD  = 6 * 60 * 60 * 1000; // BD is UTC+6
const pad = (n) => String(n).padStart(2, '0');
function bdDateStr(d) {
  const t = new Date(new Date(d).getTime() + BD);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// ── GET /api/admin/salon-visits?from=YYYY-MM-DD&to=YYYY-MM-DD ──────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const todayBd = bdDateStr(new Date());
    const fromStr = from || todayBd;
    const toStr   = to   || todayBd;
    const start = new Date(`${fromStr}T00:00:00.000+06:00`);
    const end   = new Date(`${toStr}T23:59:59.999+06:00`);

    const visits = await SalonVisit.find({ date: { $gte: start, $lte: end } })
      .sort({ date: -1 })
      .populate('staff', 'name')
      .lean();

    res.json({
      data: {
        from: start,
        to: end,
        count: visits.length,
        visits: visits.map((v) => ({
          id: v._id.toString(),
          customerName: v.customerName,
          customerPhone: v.customerPhone || '',
          customerSource: v.customerSource,
          services: (v.items || []).map((i) => ({ name: i.name, price: i.price })),
          staff: (v.staff || []).map((s) => ({ id: s._id.toString(), name: s.name })),
          subtotal: v.subtotal,
          discountPercent: v.discountPercent,
          discountAmount: v.discountAmount,
          finalAmount: v.finalAmount,
          paymentMethod: v.paymentMethod,
          date: v.date,
          note: v.note || '',
        })),
      },
    });
  } catch (err) {
    console.error('salon-visits error:', err);
    res.status(500).json({ message: 'Failed to load visits' });
  }
});

// ── DELETE /api/admin/salon-visits/:id ────────────────────────────────────────
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const deleted = await SalonVisit.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Booking not found' });
    res.json({ data: { id: req.params.id, deleted: true } });
  } catch (err) {
    console.error('salon-visit delete error:', err);
    res.status(500).json({ message: 'Failed to delete booking' });
  }
});

module.exports = router;
