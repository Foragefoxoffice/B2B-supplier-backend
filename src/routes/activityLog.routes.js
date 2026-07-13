const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../controllers/activityLog.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.get('/', protect, authorize('SUPER_ADMIN', 'ADMIN'), getActivityLogs);

module.exports = router;
