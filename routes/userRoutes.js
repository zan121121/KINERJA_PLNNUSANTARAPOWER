const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/kelola-user', hanyaRole('admin'), userController.index);
router.get('/kelola-user/tambah', hanyaRole('admin'), userController.showTambah);
router.post('/kelola-user/tambah', hanyaRole('admin'), userController.tambah);
router.post('/kelola-user/hapus/:id', hanyaRole('admin'), userController.hapus);

module.exports = router;