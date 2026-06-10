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
