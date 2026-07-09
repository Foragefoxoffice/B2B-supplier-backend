const express = require('express');
const { getOrders, createOrder, updateOrderStatus } = require('../controllers/order.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getOrders)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), createOrder);

router.route('/:id/status')
  .patch(updateOrderStatus);

module.exports = router;
