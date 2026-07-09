const express = require('express');
const { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } = require('../controllers/supplier.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), getSuppliers)
  .post(authorize('SUPER_ADMIN', 'ADMIN'), createSupplier);

router.route('/:id')
  .get(authorize('SUPER_ADMIN', 'ADMIN', 'MANAGER'), getSupplier)
  .put(authorize('SUPER_ADMIN', 'ADMIN'), updateSupplier)
  .delete(authorize('SUPER_ADMIN', 'ADMIN'), deleteSupplier);

module.exports = router;
