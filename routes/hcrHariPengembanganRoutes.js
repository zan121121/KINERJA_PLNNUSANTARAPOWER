const express = require('express');
const router = express.Router();
const hcrHariPengembanganController = require('../controllers/hcrHariPengembanganController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-hari-pengembangan', hanyaRole('admin', 'input', 'eksekutif'), hcrHariPengembanganController.index);
router.get('/hcr-hari-pengembangan/tambah', hanyaRole('admin', 'input'), hcrHariPengembanganController.showTambah);
router.post('/hcr-hari-pengembangan/tambah', hanyaRole('admin', 'input'), hcrHariPengembanganController.tambah);
router.get('/hcr-hari-pengembangan/edit/:id', hanyaRole('admin', 'input'), hcrHariPengembanganController.showEdit);
router.post('/hcr-hari-pengembangan/edit/:id', hanyaRole('admin', 'input'), hcrHariPengembanganController.edit);
router.post('/hcr-hari-pengembangan/hapus/:id', hanyaRole('admin'), hcrHariPengembanganController.hapus);

module.exports = router;