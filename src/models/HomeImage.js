const mongoose = require('mongoose');

const homeImageSchema = new mongoose.Schema(
  {
    url:      { type: String, required: true, trim: true },
    title:    { type: String, trim: true },
    caption:  { type: String, trim: true },
    order:    { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('HomeImage', homeImageSchema);