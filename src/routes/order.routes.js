const express = require('express');
const { getOrders, createOrder, updateOrderStatus, deleteOrder } = require('../controllers/order.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const uploadDoc = require('../middlewares/uploadDoc');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getOrders)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), createOrder);

router.route('/:id/status')
  .patch(uploadDoc.fields([{ name: 'bookingCopy', maxCount: 1 }, { name: 'invoiceCopy', maxCount: 1 }]), updateOrderStatus);

router.route('/:id')
  .delete(deleteOrder);

module.exports = router;
