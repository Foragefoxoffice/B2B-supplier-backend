const express = require('express');
const router = express.Router();
const { getActivityLogs, deleteActivityLog } = require('../controllers/activityLog.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.get('/', protect, authorize('SUPER_ADMIN', 'ADMIN'), getActivityLogs);
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'ADMIN'), deleteActivityLog);

module.exports = router;
