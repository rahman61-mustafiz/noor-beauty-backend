const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const serviceSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String },
    serviceType: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceType' },
    category:    { type: String },
    duration:    { type: Number, required: true },
    price:       { type: Number, required: true },
    variants:    { type: [variantSchema], default: [] },
    imageUrl:    { type: String },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);