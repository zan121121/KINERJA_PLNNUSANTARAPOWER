const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Mode testing: halaman login & logout dialihkan langsung ke dashboard
router.get('/login', (req, res) => {
  res.redirect('/dashboard');
});
router.post('/login', (req, res) => {
  res.redirect('/dashboard');
});
router.get('/logout', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;