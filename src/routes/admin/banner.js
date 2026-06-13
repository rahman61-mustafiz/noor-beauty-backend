const router    = require('express').Router();
const multer    = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const adminAuth = require('../../middleware/adminAuth');
const Banner    = require('../../models/Banner');

const s3     = new S3Client({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

function uploadSingle(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 15MB)' : err.message;
      return res.status(400).json({ message: msg });
    }
    next();
  });
}

function dto(b) {
  return { id: b._id.toString(), imageUrl: b.imageUrl || '', eyebrow: b.eyebrow || '', title: b.title || '', subtitle: b.subtitle || '', isActive: b.isActive };
}

router.get('/', adminAuth, async (req, res) => {
  const b = await Banner.getSingleton();
  res.json({ data: dto(b) });
});

router.put('/', adminAuth, async (req, res) => {
  try {
    const b = await Banner.getSingleton();
    if (typeof req.body.eyebrow === 'string')   b.eyebrow = req.body.eyebrow;
    if (typeof req.body.title === 'string')      b.title = req.body.title;
    if (typeof req.body.subtitle === 'string')   b.subtitle = req.body.subtitle;
    if (typeof req.body.isActive === 'boolean')  b.isActive = req.body.isActive;
    if (typeof req.body.imageUrl === 'string')   b.imageUrl = req.body.imageUrl;
    await b.save();
    res.json({ data: dto(b) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/upload', adminAuth, uploadSingle, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image')) return res.status(400).json({ message: 'Only image files allowed' });

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const key = `banner/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: req.file.buffer, ContentType: mime }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    const b = await Banner.getSingleton();
    b.imageUrl = url;
    await b.save();
    res.json({ data: dto(b) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

module.exports = router;