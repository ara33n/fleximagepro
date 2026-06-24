const express = require('express');
const {
  downloadImage,
  getImageBatch,
  uploadCompressedImage,
  uploadCompressedImages,
} = require('../controllers/imageController');
const { upload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post('/upload', upload.single('image'), uploadCompressedImage);
router.post('/batch', upload.array('images', 10), uploadCompressedImages);
router.get('/batch/:id', getImageBatch);
router.get('/:id/download', downloadImage);

module.exports = router;
