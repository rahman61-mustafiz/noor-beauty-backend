const router = require('express').Router();
const ServiceType = require('../models/ServiceType');

router.get('/', async (req, res) => {
  try {
    const types = await ServiceType.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    res.json({ data: types.map(t => ({ id: t._id.toString(), name: t.name, order: t.order })) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load service types' });
  }
});

module.exports = router;