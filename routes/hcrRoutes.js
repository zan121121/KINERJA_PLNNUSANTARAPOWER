const express = require('express');
const router = express.Router();
const hcrController = require('../controllers/hcrController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-menu', hanyaRole('admin', 'input', 'eksekutif'), hcrController.menuHcr);

router.get('/hcr-realisasi', hanyaRole('admin', 'input', 'eksekutif'), hcrController.pilihPegawai);
router.get('/hcr-realisasi/input/:pegawaiId', hanyaRole('admin', 'input'), hcrController.showInput);
router.post('/hcr-realisasi/input/:pegawaiId', hanyaRole('admin', 'input'), hcrController.simpanInput);

router.get('/hcr-skor-gabungan-json', hanyaRole('admin', 'input', 'eksekutif'), hcrController.skorGabunganJson);
router.get('/hcr-tren-tahunan-json', hanyaRole('admin', 'input', 'eksekutif'), hcrController.trenTahunanJson);
router.get('/hcr-detail-item/:pegawaiId', hanyaRole('admin', 'input', 'eksekutif'), hcrController.detailItemJson);
router.get('/hcr-detail-pegawai', hanyaRole('admin', 'input', 'eksekutif'), hcrController.detailPegawaiIndex);
router.get('/hcr-detail-pegawai/profil/:pegawaiId', hanyaRole('admin', 'input', 'eksekutif'), hcrController.profilLengkapJson);


module.exports = router;