const router       = require('express').Router();
const adminAuth    = require('../../middleware/adminAuth');
const Announcement = require('../../models/Announcement');

router.get('/', adminAuth, async (req, res) => {
  const a = await Announcement.getSingleton();
  res.json({ data: { id: a._id.toString(), text: a.text || '', isActive: a.isActive } });
});

router.put('/', adminAuth, async (req, res) => {
  try {
    const a = await Announcement.getSingleton();
    if (typeof req.body.text === 'string')      a.text = req.body.text;
    if (typeof req.body.isActive === 'boolean') a.isActive = req.body.isActive;
    await a.save();
    res.json({ data: { id: a._id.toString(), text: a.text, isActive: a.isActive } });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;