const router      = require('express').Router();
const adminAuth   = require('../../middleware/adminAuth');
const ServiceType = require('../../models/ServiceType');

const DEFAULTS = [
  'Hair Cut & Styling','Hair Color','Hair Treatment','Hair Spa','Keratin & Smoothening',
  'Rebonding','Facial','Skin Treatment','Cleanup','Bridal Package','Party Makeup',
  'Manicure','Pedicure','Nail Art','Waxing','Threading','Henna / Mehedi','Body Massage','Body Polishing'
];

router.get('/', adminAuth, async (req, res) => {
  const types = await ServiceType.find().sort({ order: 1, name: 1 }).lean();
  res.json({ data: types.map(toDto) });
});

router.post('/seed-defaults', adminAuth, async (req, res) => {
  const count = await ServiceType.countDocuments();
  if (count > 0) return res.json({ data: [], message: 'Types already exist' });
  const docs = await ServiceType.insertMany(DEFAULTS.map((name, i) => ({ name, order: i })));
  res.status(201).json({ data: docs.map(d => toDto(d.toObject())) });
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const t = await ServiceType.create(req.body);
    res.status(201).json({ data: toDto(t.toObject()) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  const t = await ServiceType.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!t) return res.status(404).json({ message: 'Type not found' });
  res.json({ data: toDto(t) });
});

router.delete('/:id', adminAuth, async (req, res) => {
  await ServiceType.findByIdAndDelete(req.params.id);
  res.json({ message: 'Type deleted' });
});

function toDto(t) {
  return { ...t, id: t._id.toString() };
}

module.exports = router;