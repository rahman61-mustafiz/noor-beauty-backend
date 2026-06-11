const mongoose = require('mongoose');

const galleryItemSchema = new mongoose.Schema(
  {
    type:     { type: String, enum: ['image', 'video'], default: 'image' },
    url:      { type: String, required: true, trim: true },
    title:    { type: String, trim: true },
    caption:  { type: String, trim: true },
    order:    { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('GalleryItem', galleryItemSchema);