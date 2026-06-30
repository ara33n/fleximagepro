const express = require('express');
const { repairPdf } = require('../controllers/pdfController');
const { pdfUpload } = require('../middleware/pdfUploadMiddleware');

const router = express.Router();

router.post('/repair', pdfUpload.single('pdf'), repairPdf);

module.exports = router;
