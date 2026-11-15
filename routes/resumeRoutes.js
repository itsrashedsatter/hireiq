/**
 * F4: Resume Parsing & Data Extraction
 * Routes: /api/resumes
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
const express = require('express');
const multer = require('multer');
const router = express.Router();
const resumeController = require('../controllers/resumeController');

const MAX_FILE_SIZE_MB = 5;

// Files are kept in memory, parsed, and only written to disk by the model
// after parsing succeeds.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 }
});

// Turn multer errors (e.g. file too large) into the API's JSON format
function uploadSingle(req, res, next) {
  upload.single('resume')(req, res, err => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `File is too large (max ${MAX_FILE_SIZE_MB} MB)`
      : err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Upload a single file using the field name "resume"'
        : err.message;
    return res.status(400).json({ success: false, message });
  });
}

// Metrics & reference data
router.get('/metrics', resumeController.getMetrics);
router.get('/skills/taxonomy', resumeController.getTaxonomy);

// Parsing
router.post('/upload', uploadSingle, resumeController.uploadResume);
router.post('/parse-text', resumeController.parseText);

// CRUD
router.get('/', resumeController.getResumes);
router.get('/:id', resumeController.getResumeById);
router.get('/:id/file', resumeController.downloadOriginal);
router.post('/:id/reparse', resumeController.reparseResume);
router.put('/:id', resumeController.updateResume);
router.delete('/:id', resumeController.deleteResume);

module.exports = router;
