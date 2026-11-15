/**
 * F4: Resume Parsing & Data Extraction
 * Controller: HTTP handling, validation and JSON responses for resumes.
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
const Resume = require('../models/Resume');
const JobPosting = require('../models/JobPosting');

const MIN_TEXT_LENGTH = 50;
const MAX_TEXT_LENGTH = 50000;

function validateJobPosting(jobPostingId) {
  if (!jobPostingId) return null;
  return JobPosting.findById(jobPostingId) ? null : `Job posting ${jobPostingId} does not exist`;
}

// GET /api/resumes
exports.getResumes = async (req, res) => {
  try {
    const { search, skill, status, job_posting_id, min_experience } = req.query;
    const resumes = Resume.findWithFilters({ search, skill, status, job_posting_id, min_experience });
    return res.status(200).json({ success: true, count: resumes.length, data: resumes });
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving resumes' });
  }
};

// GET /api/resumes/metrics
exports.getMetrics = async (req, res) => {
  try {
    return res.status(200).json({ success: true, data: Resume.getSummaryMetrics() });
  } catch (error) {
    console.error('Error fetching resume metrics:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving metrics' });
  }
};

// GET /api/resumes/skills/taxonomy
exports.getTaxonomy = async (req, res) => {
  try {
    const taxonomy = Resume.getSkillTaxonomy();
    return res.status(200).json({ success: true, count: taxonomy.length, data: taxonomy });
  } catch (error) {
    console.error('Error fetching skill taxonomy:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving skill taxonomy' });
  }
};

// GET /api/resumes/:id   (?view=blind hides identity for F7 Blind Screening)
exports.getResumeById = async (req, res) => {
  try {
    const blind = req.query.view === 'blind';
    const resume = Resume.findById(req.params.id, { blind });
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.status(200).json({ success: true, data: resume });
  } catch (error) {
    console.error('Error fetching resume:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving resume' });
  }
};

// GET /api/resumes/:id/file
exports.downloadOriginal = async (req, res) => {
  try {
    const file = Resume.getOriginalFilePath(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'Original file not available for this resume' });
    }
    return res.download(file.filePath, file.filename);
  } catch (error) {
    console.error('Error downloading resume:', error);
    return res.status(500).json({ success: false, message: 'Server error downloading resume' });
  }
};

// POST /api/resumes/upload   (multipart/form-data, field "resume")
exports.uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A resume file is required (field name: "resume")' });
    }
    if (!Resume.isSupportedFile(req.file.originalname)) {
      return res.status(400).json({ success: false, message: 'Unsupported file type. Allowed: PDF, DOCX, TXT.' });
    }
    const jobError = validateJobPosting(req.body.job_posting_id);
    if (jobError) return res.status(400).json({ success: false, message: jobError });

    const resume = await Resume.createFromUpload({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      size: req.file.size,
      job_posting_id: req.body.job_posting_id || null
    });

    return res.status(201).json({
      success: true,
      message: resume.status === 'Needs Review'
        ? 'Resume parsed with low confidence. Please review the extracted data.'
        : 'Resume uploaded and parsed successfully',
      data: resume
    });
  } catch (error) {
    // Extraction errors (bad/corrupt/unsupported file) are client errors
    console.error('Error parsing uploaded resume:', error.message);
    return res.status(422).json({ success: false, message: error.message || 'Could not parse the resume' });
  }
};

// POST /api/resumes/parse-text   { text, filename?, job_posting_id? }
exports.parseText = async (req, res) => {
  try {
    const { text, filename, job_posting_id } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length < MIN_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Resume text is required (at least ${MIN_TEXT_LENGTH} characters)` });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ success: false, message: `Resume text is too long (max ${MAX_TEXT_LENGTH} characters)` });
    }
    const jobError = validateJobPosting(job_posting_id);
    if (jobError) return res.status(400).json({ success: false, message: jobError });

    const resume = Resume.createFromText({ text, filename, job_posting_id: job_posting_id || null });
    return res.status(201).json({ success: true, message: 'Resume text parsed successfully', data: resume });
  } catch (error) {
    console.error('Error parsing resume text:', error);
    return res.status(500).json({ success: false, message: 'Server error parsing resume text' });
  }
};

// POST /api/resumes/:id/reparse
exports.reparseResume = async (req, res) => {
  try {
    const resume = await Resume.reparse(req.params.id);
    if (!resume) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.status(200).json({ success: true, message: 'Resume re-parsed successfully', data: resume });
  } catch (error) {
    console.error('Error re-parsing resume:', error);
    return res.status(422).json({ success: false, message: error.message });
  }
};

// PUT /api/resumes/:id   (recruiter corrections)
exports.updateResume = async (req, res) => {
  try {
    const { contact } = req.body;
    if (contact && contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    if (req.body.skills !== undefined && !Array.isArray(req.body.skills)) {
      return res.status(400).json({ success: false, message: 'Skills must be an array' });
    }
    if (req.body.status !== undefined && !Resume.VALID_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${Resume.VALID_STATUSES.join(', ')}` });
    }
    const jobError = validateJobPosting(req.body.job_posting_id);
    if (jobError) return res.status(400).json({ success: false, message: jobError });

    const updated = Resume.updateParsed(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.status(200).json({ success: true, message: 'Parsed data updated successfully', data: updated });
  } catch (error) {
    console.error('Error updating resume:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/resumes/:id
exports.deleteResume = async (req, res) => {
  try {
    const deleted = Resume.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Resume not found' });
    }
    return res.status(200).json({ success: true, message: 'Resume deleted successfully' });
  } catch (error) {
    console.error('Error deleting resume:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting resume' });
  }
};
