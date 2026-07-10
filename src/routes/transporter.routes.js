const express = require('express');
const router = express.Router();
const transporterController = require('../controllers/transporter.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.route('/')
  .get(transporterController.getTransporters)
  .post(transporterController.createTransporter);

router.route('/:id')
  .put(transporterController.updateTransporter)
  .delete(transporterController.deleteTransporter);

module.exports = router;
