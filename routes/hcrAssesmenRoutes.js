const express = require('express');
const router = express.Router();
const hcrAssesmenController = require('../controllers/hcrAssesmenController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-assesmen', hanyaRole('admin', 'input', 'eksekutif'), hcrAssesmenController.index);
router.get('/hcr-assesmen/tambah', hanyaRole('admin', 'input'), hcrAssesmenController.showTambah);
router.post('/hcr-assesmen/tambah', hanyaRole('admin', 'input'), hcrAssesmenController.tambah);
router.get('/hcr-assesmen/edit/:id', hanyaRole('admin', 'input'), hcrAssesmenController.showEdit);
router.post('/hcr-assesmen/edit/:id', hanyaRole('admin', 'input'), hcrAssesmenController.edit);
router.post('/hcr-assesmen/hapus/:id', hanyaRole('admin'), hcrAssesmenController.hapus);

module.exports = router;