const express = require('express');
const router = express.Router();
const hcrDashboardController = require('../controllers/hcrDashboardController');
const { hanyaRole } = require('../middlewares/authMiddleware');

// Dashboard Terpadu — 8 modul HCR (5 MLI + 3 KPI) dalam 1 halaman
router.get('/hcr-dashboard', hanyaRole('admin', 'input', 'eksekutif'), hcrDashboardController.index);

module.exports = router;
