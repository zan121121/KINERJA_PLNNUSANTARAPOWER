const express = require('express');
const router = express.Router();
const hcrSertifikasiController = require('../controllers/hcrSertifikasiController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-sertifikasi', hanyaRole('admin', 'input', 'eksekutif'), hcrSertifikasiController.index);
router.get('/hcr-sertifikasi/tambah', hanyaRole('admin', 'input'), hcrSertifikasiController.showTambah);
router.post('/hcr-sertifikasi/tambah', hanyaRole('admin', 'input'), hcrSertifikasiController.tambah);
router.get('/hcr-sertifikasi/edit/:id', hanyaRole('admin', 'input'), hcrSertifikasiController.showEdit);
router.post('/hcr-sertifikasi/edit/:id', hanyaRole('admin', 'input'), hcrSertifikasiController.edit);
router.post('/hcr-sertifikasi/hapus/:id', hanyaRole('admin'), hcrSertifikasiController.hapus);

module.exports = router;