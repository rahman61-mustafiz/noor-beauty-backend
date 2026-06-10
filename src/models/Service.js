const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    category:    { type: String, enum: ['Hair','Nails','Facial','Bridal','Spa','Other'], default: 'Other' },
    duration:    { type: Number, required: true },
    price:       { type: Number, required: true },
    imageUrl:    { type: String },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
