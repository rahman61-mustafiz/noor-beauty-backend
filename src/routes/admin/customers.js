const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const User      = require('../../models/User');
const Booking   = require('../../models/Booking');

// GET /api/admin/customers
router.get('/', adminAuth, async (req, res) => {
  try {
    const { search, banned } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
    if (banned === 'true')  filter.isBanned = true;
    if (banned === 'false') filter.isBanned = false;

    const users = await User.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ data: users.map(toDto) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load customers' });
  }
});

// PUT /api/admin/customers/:id  (ban / unban)
router.put('/:id', adminAuth, async (req, res) => {
  try {
    const { isBanned } = req.body;
    if (typeof isBanned !== 'boolean') {
      return res.status(400).json({ message: 'isBanned must be a boolean' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isBanned },
      { new: true }
    ).lean();
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    res.json({ data: toDto(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Update failed' });
  }
});

// DELETE /api/admin/customers/:id
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Customer not found' });
    // Remove their bookings too
    await Booking.deleteMany({ customer: req.params.id });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

function toDto(u) {
  return {
    id: u._id.toString(),
    name: u.name,
    phone: u.phone,
    email: u.email || null,
    isBanned: u.isBanned,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt || null,
  };
}

module.exports = router;
