const router    = require('express').Router();
const HomeImage = require('../models/HomeImage');

router.get('/', async (req, res) => {
  try {
    const items = await HomeImage.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json({ data: items.map(toDto) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load home images' });
  }
});

function toDto(g) {
  return {
    id: g._id.toString(),
    url: g.url,
    title: g.title || '',
    caption: g.caption || '',
    order: g.order,
  };
}

module.exports = router;