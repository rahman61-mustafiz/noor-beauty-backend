const router    = require('express').Router();
const adminAuth = require('../../middleware/adminAuth');
const Review    = require('../../models/Review');

router.get('/', adminAuth, async (req, res) => {
  const reviews = await Review.find()
    .sort({ createdAt: -1 })
    .populate('customer', 'name phone')
    .lean();
  res.json({ data: reviews.map(toDto) });
});

router.put('/:id', adminAuth, async (req, res) => {
  const { adminResponse, isVisible } = req.body;
  const update = {};
  if (adminResponse !== undefined) update.adminResponse = adminResponse;
  if (isVisible !== undefined) update.isVisible = isVisible;
  const r = await Review.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
  if (!r) return res.status(404).json({ message: 'Review not found' });
  res.json({ data: toDto(r) });
});

function toDto(r) {
  return {
    id: r._id.toString(),
    customerName: r.customer?.name || 'Unknown',
    customerPhone: r.customer?.phone || '',
    rating: r.rating,
    comment: r.comment || '',
    adminResponse: r.adminResponse || '',
    isVisible: r.isVisible,
    createdAt: r.createdAt,
  };
}

module.exports = router;
