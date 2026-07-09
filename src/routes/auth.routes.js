const express = require('express');
const { login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.get('/profile', protect, getMe);

module.exports = router;
