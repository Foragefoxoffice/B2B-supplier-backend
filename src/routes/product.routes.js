const express = require('express');
const { getProducts, createProduct, approveProduct, deleteProduct } = require('../controllers/product.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getProducts)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPLIER'), upload.array('images', 5), createProduct);

router.route('/:id')
  .delete(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPLIER'), deleteProduct);

router.patch('/:id/approve', authorize('SUPER_ADMIN', 'ADMIN'), approveProduct);

module.exports = router;
