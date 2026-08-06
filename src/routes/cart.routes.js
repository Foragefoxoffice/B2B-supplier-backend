const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.get('/', cartController.getCart);
router.post('/batch', cartController.addBatchToCart);
router.put('/:variantId', cartController.updateCartItem);
router.delete('/:variantId', cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;
