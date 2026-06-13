const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, default: '' },
    eyebrow:  { type: String, default: 'Bridal Special' },
    title:    { type: String, default: 'Complete Bridal Package' },
    subtitle: { type: String, default: 'Make your special day unforgettable' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

bannerSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) doc = await this.create({});
  return doc;
};

module.exports = mongoose.model('Banner', bannerSchema);