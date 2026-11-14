const JobPosting = require('../models/JobPosting');

// GET /api/job-postings
exports.getPostings = async (req, res) => {
  try {
    const { search, status, department, experience_level, source } = req.query;
    const postings = JobPosting.findWithFilters({
      search,
      status,
      department,
      experience_level,
      source
    });
    return res.status(200).json({
      success: true,
      count: postings.length,
      data: postings
    });
  } catch (error) {
    console.error('Error fetching job postings:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving job postings' });
  }
};

// GET /api/job-postings/metrics
exports.getMetrics = async (req, res) => {
  try {
    const metrics = JobPosting.getSummaryMetrics();
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving metrics' });
  }
};

// GET /api/job-postings/:id
exports.getPostingById = async (req, res) => {
  try {
    const posting = JobPosting.findById(req.params.id);
    if (!posting) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }
    return res.status(200).json({ success: true, data: posting });
  } catch (error) {
    console.error('Error fetching job posting:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving job posting' });
  }
};

// POST /api/job-postings
exports.createPosting = async (req, res) => {
  try {
    const {
      title,
      department,
      requisition_id,
      experience_level,
      salary_range,
      source,
      deadline,
      status,
      blind_mode,
      description,
      skills
    } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ success: false, message: 'Job title is required' });
    }
    if (!department || department.trim() === '') {
      return res.status(400).json({ success: false, message: 'Department is required' });
    }
    if (!deadline) {
      return res.status(400).json({ success: false, message: 'Application deadline is required' });
    }

    const newPosting = JobPosting.create({
      title,
      department,
      requisition_id,
      experience_level,
      salary_range,
      source,
      deadline,
      status,
      blind_mode,
      description,
      skills: Array.isArray(skills) ? skills : []
    });

    return res.status(201).json({
      success: true,
      message: 'Job posting created successfully',
      data: newPosting
    });
  } catch (error) {
    console.error('Error creating job posting:', error);
    return res.status(500).json({ success: false, message: 'Server error creating job posting' });
  }
};

// PUT /api/job-postings/:id
exports.updatePosting = async (req, res) => {
  try {
    const postingId = req.params.id;
    const existing = JobPosting.findById(postingId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    const updated = JobPosting.update(postingId, req.body);
    return res.status(200).json({
      success: true,
      message: 'Job posting updated successfully',
      data: updated
    });
  } catch (error) {
    console.error('Error updating job posting:', error);
    return res.status(500).json({ success: false, message: 'Server error updating job posting' });
  }
};

// PATCH /api/job-postings/:id/status
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'New status is required' });
    }

    const updated = JobPosting.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    return res.status(200).json({
      success: true,
      message: `Job posting status updated to ${status}`,
      data: updated
    });
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/job-postings/:id
exports.deletePosting = async (req, res) => {
  try {
    const deleted = JobPosting.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Job posting not found' });
    }
    return res.status(200).json({
      success: true,
      message: 'Job posting deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job posting:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting job posting' });
  }
};
