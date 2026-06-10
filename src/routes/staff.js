const router = require('express').Router();
const Staff  = require('../models/Staff');

router.get('/', async (req, res) => {
  try {
    const staff = await Staff.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({ data: staff.map((s) => ({ ...s, id: s._id.toString() })) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load staff' });
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).lean();
    if (!staff) return res.status(404).json({ message: 'Staff not found' });
    res.json({ workingDays: staff.workingDays, workStart: staff.workStart, workEnd: staff.workEnd });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load availability' });
  }
});

module.exports = router;
