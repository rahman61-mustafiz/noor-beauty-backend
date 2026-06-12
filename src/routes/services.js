const router      = require('express').Router();
const Service     = require('../models/Service');
const ServiceType = require('../models/ServiceType');

router.get('/', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const services = await Service.find(filter).sort({ category: 1, name: 1 }).lean();
    res.json({ data: services.map((s) => ({ ...s, id: s._id.toString() })) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load services' });
  }
});

router.get('/menu', async (req, res) => {
  try {
    const types = await ServiceType.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    const services = await Service.find({ isActive: true }).lean();
    const byType = {};
    services.forEach((s) => {
      if (!s.serviceType) return;
      const k = String(s.serviceType);
      (byType[k] = byType[k] || []).push(s);
    });
    const data = types
      .map((t) => {
        const list = (byType[String(t._id)] || []).sort((a, b) => a.price - b.price);
        const prices = list.map((s) => s.price);
        const durs = list.map((s) => s.duration);
        return {
          id: t._id.toString(),
          name: t.name,
          description: t.description || '',
          icon: t.icon || 'spa',
          startingPrice: prices.length ? Math.min.apply(null, prices) : 0,
          baseDurationMin: durs.length ? Math.min.apply(null, durs) : 30,
          baseDurationMax: durs.length ? Math.max.apply(null, durs) : 60,
          subOptions: list.map((s) => ({
            name: s.name,
            durationMin: s.duration,
            price: s.price,
            variants: Array.isArray(s.variants)
              ? s.variants.map((v) => ({ label: v.label, price: v.price }))
              : [],
          })),
        };
      })
      .filter((t) => t.subOptions.length > 0);
    res.json({ data });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load menu' });
  }
});

module.exports = router;