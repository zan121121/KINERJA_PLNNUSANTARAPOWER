const express = require('express');
const router = express.Router();
const hcrBobotController = require('../controllers/hcrBobotController');
const { hanyaRole } = require('../middlewares/authMiddleware');

router.get('/hcr-bobot', hanyaRole('admin'), hcrBobotController.index);
router.post('/hcr-bobot', hanyaRole('admin'), hcrBobotController.update);

module.exports = router;