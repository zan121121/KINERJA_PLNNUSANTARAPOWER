const express = require('express');
const router = express.Router();
const hcrEvaluasiController = require('../controllers/hcrEvaluasiController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-evaluasi', hanyaRole('admin', 'input', 'eksekutif'), hcrEvaluasiController.index);
router.get('/hcr-evaluasi/tambah', hanyaRole('admin', 'input'), hcrEvaluasiController.showTambah);
router.post('/hcr-evaluasi/tambah', hanyaRole('admin', 'input'), hcrEvaluasiController.uploadMiddleware, hcrEvaluasiController.tambah);
router.get('/hcr-evaluasi/edit/:id', hanyaRole('admin', 'input'), hcrEvaluasiController.showEdit);
router.post('/hcr-evaluasi/edit/:id', hanyaRole('admin', 'input'), hcrEvaluasiController.uploadMiddleware, hcrEvaluasiController.edit);
router.post('/hcr-evaluasi/hapus/:id', hanyaRole('admin'), hcrEvaluasiController.hapus);

module.exports = router;