const express = require('express');
const { getCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/category.controller');
const { protect, authorize } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getCategories)
  .post(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPLIER'), createCategory);

router.route('/:id')
  .put(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPLIER'), updateCategory)
  .delete(authorize('SUPER_ADMIN', 'ADMIN', 'SUPPLIER'), deleteCategory);

module.exports = router;
