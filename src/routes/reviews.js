const router = require('express').Router();
const auth   = require('../middleware/auth');
const Review = require('../models/Review');

router.get('/', async (req, res) => {
  try {
    const reviews = await Review.find({ isVisible: true })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('customer', 'name')
      .lean();
    res.json({ data: reviews.map((r) => ({
      id: r._id.toString(),
      customerName: r.customer?.name || 'Anonymous',
      rating: r.rating,
      comment: r.comment || '',
      adminResponse: r.adminResponse || '',
      createdAt: r.createdAt,
    })) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load reviews' });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { rating, comment, bookingId } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be 1–5' });
    }
    const review = await Review.create({
      customer: req.userId,
      booking: bookingId,
      rating,
      comment,
    });
    res.status(201).json({ data: { id: review._id.toString() } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to submit review' });
  }
});

module.exports = router;
