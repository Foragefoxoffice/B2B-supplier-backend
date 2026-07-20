const express = require('express');
const { getOrders, createOrder, updateOrderStatus, deleteOrder, downloadOrderPdf, viewOrderHtml } = require('../controllers/order.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const uploadDoc = require('../middlewares/uploadDoc');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getOrders)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), uploadDoc.single('signature'), createOrder);

router.route('/:id/status')
  .patch(uploadDoc.fields([{ name: 'bookingCopy', maxCount: 1 }, { name: 'invoiceCopy', maxCount: 1 }]), updateOrderStatus);

router.route('/:id')
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), deleteOrder);

router.route('/:id/pdf')
  .get(downloadOrderPdf);

router.route('/:id/html')
  .get(viewOrderHtml);

module.exports = router;
