const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Service   = require('../../models/Service');

router.get('/',    adminAuth, async (req, res) => {
  const services = await Service.find().sort({ category: 1, name: 1 }).lean();
  res.json({ data: services.map(toDto) });
});

router.post('/',   adminAuth, async (req, res) => {
  try {
    const s = await Service.create(req.body);
    res.status(201).json({ data: toDto(s.toObject()) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Merge services sharing a base name (e.g. "Hair Omega - Short/Medium/Long")
// into one service with size variants. Safe to run more than once.
router.post('/merge-variants', adminAuth, async (req, res) => {
  try {
    const splitName = (n) => String(n || '').split(/ [-\u2013] /);
    const baseOf    = (n) => splitName(n)[0].trim();
    const suffixOf  = (n) => {
      const p = splitName(n);
      return p.length > 1 ? p.slice(1).join(' - ').trim() : '';
    };
    const all = await Service.find().lean();
    const groups = {};
    all.forEach((s) => {
      if (!s.serviceType) return;
      const key = String(s.serviceType) + '|' + baseOf(s.name);
      (groups[key] = groups[key] || []).push(s);
    });
    let mergedCount = 0;
    for (const key of Object.keys(groups)) {
      const items = groups[key];
      if (items.length < 2) continue;
      items.sort((a, b) => a.price - b.price);
      const variants  = items.map((it) => ({ label: suffixOf(it.name) || it.name, price: it.price }));
      const durations = items.map((it) => it.duration).filter((d) => typeof d === 'number');
      const newDoc = {
        name:        baseOf(items[0].name),
        description: items[0].description || '',
        serviceType: items[0].serviceType,
        category:    items[0].category,
        duration:    durations.length ? Math.max.apply(null, durations) : 60,
        price:       Math.min.apply(null, items.map((it) => it.price)),
        variants,
        isActive:    items.some((it) => it.isActive !== false),
      };
      await Service.deleteMany({ _id: { $in: items.map((it) => it._id) } });
      await Service.create(newDoc);
      mergedCount += 1;
    }
    const after = await Service.countDocuments();
    res.json({ message: 'Merge complete', groupsMerged: mergedCount, before: all.length, after });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  const s = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!s) return res.status(404).json({ message: 'Service not found' });
  res.json({ data: toDto(s) });
});

router.delete('/:id', adminAuth, async (req, res) => {
  await Service.findByIdAndDelete(req.params.id);
  res.json({ message: 'Service deleted' });
});

function toDto(s) {
  return { ...s, id: s._id.toString() };
}

module.exports = router;