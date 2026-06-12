const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Booking   = require('../../models/Booking');
const Ledger    = require('../../models/LedgerEntry');

const BD = 6 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
function bdDateStr(d) {
  const t = new Date(new Date(d).getTime() + BD);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

router.get('/sales', adminAuth, async (req, res) => {
  try {
    const { from, to, status } = req.query;
    const todayBd = bdDateStr(new Date());
    const fromStr = from || `${todayBd.slice(0, 7)}-01`;
    const toStr   = to || todayBd;
    const start = new Date(`${fromStr}T00:00:00.000+06:00`);
    const end   = new Date(`${toStr}T23:59:59.999+06:00`);

    const statusFilter = status === 'all'
      ? { $in: ['pending', 'confirmed', 'completed'] }
      : (status || 'completed');

    const bookings = await Booking.find({
      status: statusFilter,
      startTime: { $gte: start, $lte: end },
    }).populate('customer', 'name phone').sort({ startTime: -1 }).lean();

    const ledgerEntries = await Ledger.find({
      date: { $gte: start, $lte: end },
    }).sort({ date: -1 }).lean();

    let total = 0;
    const byDayMap = {}, byClientMap = {}, transactions = [];

    function addRow(amount, when, name, phone, serviceName, source) {
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
      transactions.push({ date: when, clientName: cname, clientPhone: cphone, serviceName: serviceName || 'Service', amount: amt, source });
    }

    bookings.forEach((b) => {
      addRow(b.totalAmount, b.startTime, b.customer?.name, b.customer?.phone, b.serviceName || b.service?.name || 'Service', 'app');
    });
    ledgerEntries.forEach((e) => {
      addRow(e.amount, e.date, e.customerName, e.customerPhone, e.serviceName || 'Walk-in', 'manual');
    });

    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    const byDay = Object.values(byDayMap).sort((a, b) => (a.date < b.date ? 1 : -1));
    const byClient = Object.values(byClientMap).sort((a, b) => b.total - a.total);

    res.json({ data: { from: start, to: end, total, count: bookings.length + ledgerEntries.length, byDay, byClient, transactions } });
  } catch (err) {
    console.error('reports error', err);
    res.status(500).json({ message: 'Failed to load report' });
  }
});

module.exports = router;