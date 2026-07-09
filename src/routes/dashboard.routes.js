const express = require('express');
const { getStats } = require('../controllers/dashboard.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/stats', getStats);

module.exports = router;
