const router = require('express').Router();
const Banner = require('../models/Banner');

router.get('/', async (req, res) => {
  try {
    const b = await Banner.getSingleton();
    res.json({ data: { imageUrl: b.imageUrl || '', eyebrow: b.eyebrow || '', title: b.title || '', subtitle: b.subtitle || '', isActive: b.isActive } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load banner' });
  }
});

module.exports = router;