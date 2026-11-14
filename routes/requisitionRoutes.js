const express = require('express');
const router = express.Router();
const requisitionController = require('../controllers/requisitionController');

router.get('/approved', requisitionController.getApprovedRequisitions);
router.get('/:id', requisitionController.getRequisitionById);

module.exports = router;
