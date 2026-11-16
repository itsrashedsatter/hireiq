const express = require('express');
const router = express.Router();
const EmailController = require('../controllers/emailController');

// Metrics
router.get('/metrics', EmailController.getMetrics);

// Templates
router.get('/templates', EmailController.getTemplates);
router.get('/templates/:key', EmailController.getTemplateByKey);
router.put('/templates/:key', EmailController.updateTemplate);
router.post('/templates/:key/preview', EmailController.previewTemplate);

// Dispatch & Triggers
router.post('/send-test', EmailController.sendTest);
router.post('/weekly-digest', EmailController.triggerWeeklyDigest);

// Audit Logs & Retry
router.get('/logs', EmailController.getLogs);
router.get('/logs/:id', EmailController.getLogById);
router.post('/logs/:id/retry', EmailController.retryEmail);

module.exports = router;
