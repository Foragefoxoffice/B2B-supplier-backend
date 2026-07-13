const express = require('express');
const router = express.Router();
const { getUsers, createUser, updateUser, deleteUser, getRoles } = require('../controllers/user.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

router.get('/', protect, authorize('SUPER_ADMIN', 'ADMIN'), getUsers);
router.post('/', protect, authorize('SUPER_ADMIN', 'ADMIN'), createUser);
router.put('/:id', protect, authorize('SUPER_ADMIN', 'ADMIN'), updateUser);
router.delete('/:id', protect, authorize('SUPER_ADMIN', 'ADMIN'), deleteUser);
router.get('/roles', protect, authorize('SUPER_ADMIN', 'ADMIN'), getRoles);

module.exports = router;
