const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/hcrGabunganController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-input-gabungan', hanyaRole('admin', 'input', 'eksekutif'), ctrl.pilihPegawai);
router.get('/hcr-input-gabungan/:pegawaiId', hanyaRole('admin', 'input', 'eksekutif'), ctrl.showGabungan);

router.post('/hcr-input-gabungan/simpan-assesmen', hanyaRole('admin', 'input'), ctrl.simpanAssesmen);
router.post('/hcr-input-gabungan/simpan-identifikasi', hanyaRole('admin', 'input'), ctrl.simpanIdentifikasi);
router.post('/hcr-input-gabungan/simpan-pelaksanaan', hanyaRole('admin', 'input'), ctrl.simpanPelaksanaan);
router.post('/hcr-input-gabungan/simpan-evaluasi', hanyaRole('admin', 'input'), ctrl.uploadEvaluasiMiddleware, ctrl.simpanEvaluasi);
router.post('/hcr-input-gabungan/simpan-penugasan', hanyaRole('admin', 'input'), ctrl.simpanPenugasan);
router.post('/hcr-input-gabungan/simpan-sertifikasi', hanyaRole('admin', 'input'), ctrl.simpanSertifikasi);
router.post('/hcr-input-gabungan/simpan-hari-pengembangan', hanyaRole('admin', 'input'), ctrl.simpanHariPengembangan);
router.post('/hcr-input-gabungan/simpan-aksi', hanyaRole('admin', 'input'), ctrl.simpanAksi);

module.exports = router;