const express = require('express');
const router = express.Router();
const hcrPenugasanController = require('../controllers/hcrPenugasanController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-penugasan', hanyaRole('admin', 'input', 'eksekutif'), hcrPenugasanController.index);
router.get('/hcr-penugasan/tambah', hanyaRole('admin', 'input'), hcrPenugasanController.showTambah);
router.post('/hcr-penugasan/tambah', hanyaRole('admin', 'input'), hcrPenugasanController.tambah);
router.get('/hcr-penugasan/edit/:id', hanyaRole('admin', 'input'), hcrPenugasanController.showEdit);
router.post('/hcr-penugasan/edit/:id', hanyaRole('admin', 'input'), hcrPenugasanController.edit);
router.post('/hcr-penugasan/hapus/:id', hanyaRole('admin'), hcrPenugasanController.hapus);

module.exports = router;