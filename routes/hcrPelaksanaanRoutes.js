const express = require('express');
const router = express.Router();
const hcrPelaksanaanController = require('../controllers/hcrPelaksanaanController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-pelaksanaan', hanyaRole('admin', 'input', 'eksekutif'), hcrPelaksanaanController.index);
router.get('/hcr-pelaksanaan/tambah', hanyaRole('admin', 'input'), hcrPelaksanaanController.showTambah);
router.post('/hcr-pelaksanaan/tambah', hanyaRole('admin', 'input'), hcrPelaksanaanController.tambah);
router.get('/hcr-pelaksanaan/edit/:id', hanyaRole('admin', 'input'), hcrPelaksanaanController.showEdit);
router.post('/hcr-pelaksanaan/edit/:id', hanyaRole('admin', 'input'), hcrPelaksanaanController.edit);
router.post('/hcr-pelaksanaan/hapus/:id', hanyaRole('admin'), hcrPelaksanaanController.hapus);

module.exports = router;