const router  = require('express').Router();
const Service = require('../models/Service');

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

module.exports = router;
