const express = require('express');
const router = express.Router();
const jobPostingController = require('../controllers/jobPostingController');

// Metrics
router.get('/metrics', jobPostingController.getMetrics);

// CRUD
router.get('/', jobPostingController.getPostings);
router.post('/', jobPostingController.createPosting);
router.get('/:id', jobPostingController.getPostingById);
router.put('/:id', jobPostingController.updatePosting);
router.patch('/:id/status', jobPostingController.updateStatus);
router.delete('/:id', jobPostingController.deletePosting);

module.exports = router;
