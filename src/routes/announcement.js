const router       = require('express').Router();
const Announcement = require('../models/Announcement');

router.get('/', async (req, res) => {
  try {
    const a = await Announcement.getSingleton();
    res.json({ data: { text: a.text || '', isActive: a.isActive } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load announcement' });
  }
});

module.exports = router;