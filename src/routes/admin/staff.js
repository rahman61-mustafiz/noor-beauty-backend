const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Staff     = require('../../models/Staff');

router.get('/',    adminAuth, async (req, res) => {
  const staff = await Staff.find().sort({ name: 1 }).lean();
  res.json({ data: staff.map(toDto) });
});

router.post('/',   adminAuth, async (req, res) => {
  try {
    const s = await Staff.create(req.body);
    res.status(201).json({ data: toDto(s.toObject()) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  const s = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!s) return res.status(404).json({ message: 'Staff not found' });
  res.json({ data: toDto(s) });
});

router.delete('/:id', adminAuth, async (req, res) => {
  await Staff.findByIdAndDelete(req.params.id);
  res.json({ message: 'Staff deleted' });
});

function toDto(s) {
  return { ...s, id: s._id.toString() };
}

module.exports = router;
