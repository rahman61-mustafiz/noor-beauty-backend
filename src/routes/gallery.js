const router      = require('express').Router();
const GalleryItem = require('../models/GalleryItem');

router.get('/', async (req, res) => {
  try {
    const items = await GalleryItem.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json({ data: items.map(toDto) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load gallery' });
  }
});

function toDto(g) {
  return {
    id: g._id.toString(),
    type: g.type,
    url: g.url,
    title: g.title || '',
    caption: g.caption || '',
    order: g.order,
  };
}

module.exports = router;