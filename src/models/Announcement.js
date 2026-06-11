const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    text:     { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

announcementSchema.statics.getSingleton = async function () {
  let doc = await this.findOne();
  if (!doc) {
    doc = await this.create({
      text: 'Welcome to Noor Beauty Salon! Book your appointment today.',
      isActive: true,
    });
  }
  return doc;
};

module.exports = mongoose.model('Announcement', announcementSchema);