const express = require('express');
const router = express.Router();
const hcrAksiController = require('../controllers/hcrAksiController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-aksi', hanyaRole('admin', 'input', 'eksekutif'), hcrAksiController.index);
router.get('/hcr-aksi/tambah', hanyaRole('admin', 'input'), hcrAksiController.showTambah);
router.post('/hcr-aksi/tambah', hanyaRole('admin', 'input'), hcrAksiController.tambah);
router.get('/hcr-aksi/edit/:id', hanyaRole('admin', 'input'), hcrAksiController.showEdit);
router.post('/hcr-aksi/edit/:id', hanyaRole('admin', 'input'), hcrAksiController.edit);
router.post('/hcr-aksi/status/:id', hanyaRole('admin', 'input'), hcrAksiController.updateStatus);
router.post('/hcr-aksi/hapus/:id', hanyaRole('admin'), hcrAksiController.hapus);

module.exports = router;