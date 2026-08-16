const express = require('express');
const router = express.Router();
const pegawaiController = require('../controllers/pegawaiController');
const { hanyaRole } = require('../middlewares/authMiddleware');
const pegawaiImportController = require('../controllers/pegawaiImportController');

router.get('/pegawai/import', hanyaRole('admin'), pegawaiImportController.showImport);
router.post('/pegawai/import', hanyaRole('admin'), pegawaiImportController.uploadMiddleware, pegawaiImportController.proses);

router.get('/pegawai', hanyaRole('admin', 'input', 'eksekutif'), pegawaiController.index);
router.get('/pegawai/tambah', hanyaRole('admin'), pegawaiController.showTambah);
router.post('/pegawai/tambah', hanyaRole('admin'), pegawaiController.tambah);
router.get('/pegawai/edit/:id', hanyaRole('admin'), pegawaiController.showEdit);
router.post('/pegawai/edit/:id', hanyaRole('admin'), pegawaiController.edit);
router.get('/pegawai/hapus/:id', hanyaRole('admin'), pegawaiController.showHapusConfirm);
router.post('/pegawai/hapus/:id', hanyaRole('admin'), pegawaiController.hapus);
router.get('/pegawai/detail/:id/json', hanyaRole('admin', 'input', 'eksekutif'), pegawaiController.detailJson);

module.exports = router;