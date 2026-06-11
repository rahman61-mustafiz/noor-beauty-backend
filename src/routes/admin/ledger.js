const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Ledger    = require('../../models/LedgerEntry');

const BD = 6 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
function bdDateStr(d) {
  const t = new Date(new Date(d).getTime() + BD);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

router.get('/', adminAuth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const todayBd = bdDateStr(new Date());
    const fromStr = from || `${todayBd.slice(0, 7)}-01`;
    const toStr   = to || todayBd;
    const start = new Date(`${fromStr}T00:00:00.000+06:00`);
    const end   = new Date(`${toStr}T23:59:59.999+06:00`);
    const entries = await Ledger.find({ date: { $gte: start, $lte: end } }).sort({ date: -1 }).lean();
    const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
    res.json({
      data: {
        from: start, to: end, total, count: entries.length,
        entries: entries.map((e) => ({
          id: e._id.toString(),
          customerName: e.customerName,
          customerPhone: e.customerPhone || '',
          serviceName: e.serviceName || '',
          amount: e.amount || 0,
          date: e.date,
          note: e.note || '',
        })),
      },
    });
  } catch (err) { res.status(500).json({ message: 'Failed to load ledger' }); }
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const { customerName, customerPhone, serviceName, amount, date, note } = req.body;
    if (!customerName || amount == null || amount === '') {
      return res.status(400).json({ message: 'Customer name and amount are required' });
    }
    const when = date ? new Date(`${date}T12:00:00+06:00`) : new Date();
    const e = await Ledger.create({ customerName, customerPhone, serviceName, amount: Number(amount), date: when, note });
    res.status(201).json({ data: { id: e._id.toString() } });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', adminAuth, async (req, res) => {
  await Ledger.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;