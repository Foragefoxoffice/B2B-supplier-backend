const express = require('express');
const { login, getMe, forgotPassword, verifyOtp, resetPassword, changePassword, updateProfile } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', login);
router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.put('/change-password', protect, changePassword);

module.exports = router;
