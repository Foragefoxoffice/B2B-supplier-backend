const express = require('express');
const { getSettings, updateSettings } = require('../controllers/setting.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getSettings)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), updateSettings);

module.exports = router;
