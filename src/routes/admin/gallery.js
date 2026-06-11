const router      = require('express').Router();
const adminAuth   = require('../../middleware/adminAuth');
const GalleryItem = require('../../models/GalleryItem');

router.get('/', adminAuth, async (req, res) => {
  const items = await GalleryItem.find().sort({ order: 1, createdAt: -1 }).lean();
  res.json({ data: items.map(toDto) });
});

router.post('/', adminAuth, async (req, res) => {
  try {
    const item = await GalleryItem.create(req.body);
    res.status(201).json({ data: toDto(item.toObject()) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  const item = await GalleryItem.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!item) return res.status(404).json({ message: 'Gallery item not found' });
  res.json({ data: toDto(item) });
});

router.delete('/:id', adminAuth, async (req, res) => {
  await GalleryItem.findByIdAndDelete(req.params.id);
  res.json({ message: 'Gallery item deleted' });
});

function toDto(g) {
  return { ...g, id: g._id.toString() };
}

module.exports = router;