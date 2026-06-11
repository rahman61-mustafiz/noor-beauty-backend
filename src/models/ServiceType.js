const mongoose = require('mongoose');

const serviceTypeSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    icon:        { type: String, default: 'spa' },
    description: { type: String, default: '' },
    order:       { type: Number, default: 0 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ServiceType', serviceTypeSchema);