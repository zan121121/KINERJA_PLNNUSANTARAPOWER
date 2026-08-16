const express = require('express');
const router = express.Router();
const hcrLevelController = require('../controllers/hcrLevelController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-level', hanyaRole('admin'), hcrLevelController.index);
router.post('/hcr-level', hanyaRole('admin'), hcrLevelController.update);

module.exports = router;