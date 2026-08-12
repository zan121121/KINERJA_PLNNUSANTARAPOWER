const express = require('express');
const router = express.Router();
const customFieldController = require('../controllers/customFieldController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/pegawai/custom-fields', hanyaRole('admin'), customFieldController.index);
router.get('/pegawai/custom-fields/tambah', hanyaRole('admin'), customFieldController.showTambah);
router.post('/pegawai/custom-fields/tambah', hanyaRole('admin'), customFieldController.tambah);
router.get('/pegawai/custom-fields/edit/:id', hanyaRole('admin'), customFieldController.showEdit);
router.post('/pegawai/custom-fields/edit/:id', hanyaRole('admin'), customFieldController.edit);
router.get('/pegawai/custom-fields/hapus/:id', hanyaRole('admin'), customFieldController.showHapusConfirm);
router.post('/pegawai/custom-fields/hapus/:id', hanyaRole('admin'), customFieldController.hapus);

module.exports = router;