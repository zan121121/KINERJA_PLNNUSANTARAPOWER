const express = require('express');
const router = express.Router();
const hcrIdentifikasiController = require('../controllers/hcrIdentifikasiController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-identifikasi', hanyaRole('admin', 'input', 'eksekutif'), hcrIdentifikasiController.index);
router.get('/hcr-identifikasi/tambah', hanyaRole('admin', 'input'), hcrIdentifikasiController.showTambah);
router.post('/hcr-identifikasi/tambah', hanyaRole('admin', 'input'), hcrIdentifikasiController.tambah);
router.get('/hcr-identifikasi/edit/:id', hanyaRole('admin', 'input'), hcrIdentifikasiController.showEdit);
router.post('/hcr-identifikasi/edit/:id', hanyaRole('admin', 'input'), hcrIdentifikasiController.edit);
router.post('/hcr-identifikasi/hapus/:id', hanyaRole('admin'), hcrIdentifikasiController.hapus);

module.exports = router;