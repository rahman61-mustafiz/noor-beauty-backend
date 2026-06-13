const router    = require('express').Router();
const multer    = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const adminAuth = require('../../middleware/adminAuth');
const HomeImage = require('../../models/HomeImage');

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

router.get('/', adminAuth, async (req, res) => {
  const items = await HomeImage.find().sort({ order: 1, createdAt: -1 }).lean();
  res.json({ data: items.map(toDto) });
});

router.post('/upload', adminAuth, uploadSingle, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const mime = req.file.mimetype || '';
    if (!mime.startsWith('image')) return res.status(400).json({ message: 'Only image files allowed' });

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const key = `home/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: mime,
    }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    const item = await HomeImage.create({
      url,
      title: (req.body.title || '').trim(),
      caption: (req.body.caption || '').trim(),
      order: Number(req.body.order) || 0,
      isActive: true,
    });
    res.status(201).json({ data: toDto(item.toObject()) });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload failed' });
  }
});

router.put('/:id', adminAuth, async (req, res) => {
  const item = await HomeImage.findByIdAndUpdate(req.params.id, req.body, { new: true }).lean();
  if (!item) return res.status(404).json({ message: 'Home image not found' });
  res.json({ data: toDto(item) });
});

router.delete('/:id', adminAuth, async (req, res) => {
  await HomeImage.findByIdAndDelete(req.params.id);
  res.json({ message: 'Home image deleted' });
});

function toDto(g) {
  return { ...g, id: g._id.toString() };
}

module.exports = router;