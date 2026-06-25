const express = require('express');
const { generateQrCode } = require('../controllers/qrController');

const router = express.Router();

router.post('/generate', generateQrCode);

module.exports = router;
