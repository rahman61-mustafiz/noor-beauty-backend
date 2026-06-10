const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    customer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    booking:       { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    rating:        { type: Number, required: true, min: 1, max: 5 },
    comment:       { type: String },
    adminResponse: { type: String },
    isVisible:     { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
