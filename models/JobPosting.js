const { readCollection, writeCollection } = require('../config/database');
const JobSkill = require('./JobSkill');
const Requisition = require('./Requisition');

class JobPosting {
  static getAll() {
    return readCollection('job_postings');
  }

  // Automatic deadline evaluation: closes postings when deadline has passed
  static checkAndCloseExpired() {
    const postings = this.getAll();
    const now = new Date();
    let updated = false;

    for (const job of postings) {
      if (job.deadline && job.status !== 'Closed') {
        const deadlineDate = new Date(`${job.deadline}T23:59:59`);
        if (deadlineDate < now) {
          job.status = 'Closed';
          job.auto_closed = true;
          job.closed_reason = 'Application deadline passed';
          job.updated_at = new Date().toISOString();
          updated = true;
        }
      }
    }

    if (updated) {
      writeCollection('job_postings', postings);
    }
    return postings;
  }

  static findWithFilters({ search, status, department, experience_level, source }) {
    // Ensure expired deadlines are checked first
    let postings = this.checkAndCloseExpired();

    // Attach skills to all postings for rich filtering
    const allSkills = JobSkill.getAll();
    const skillsMap = {};
    for (const s of allSkills) {
      if (!skillsMap[s.job_posting_id]) {
        skillsMap[s.job_posting_id] = [];
      }
      skillsMap[s.job_posting_id].push(s);
    }

    let results = postings.map(p => ({
      ...p,
      skills: skillsMap[p.id] || []
    }));

    // Status filter
    if (status && status !== 'All') {
      results = results.filter(p => p.status.toLowerCase() === status.toLowerCase());
    }

    // Department filter
    if (department && department !== 'All') {
      results = results.filter(p => p.department.toLowerCase() === department.toLowerCase());
    }

    // Experience Level filter
    if (experience_level && experience_level !== 'All') {
      results = results.filter(p => p.experience_level.toLowerCase() === experience_level.toLowerCase());
    }

    // Source Tag filter
    if (source && source !== 'All') {
      results = results.filter(p => p.source && p.source.toLowerCase() === source.toLowerCase());
    }

    // Search query (title, department, source, description, skill names)
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      results = results.filter(p => {
        const matchesTitle = p.title && p.title.toLowerCase().includes(q);
        const matchesDept = p.department && p.department.toLowerCase().includes(q);
        const matchesSource = p.source && p.source.toLowerCase().includes(q);
        const matchesDesc = p.description && p.description.toLowerCase().includes(q);
        const matchesSkill = p.skills.some(s => s.skill_name.toLowerCase().includes(q));
        return matchesTitle || matchesDept || matchesSource || matchesDesc || matchesSkill;
      });
    }

    // Sort by latest created/updated
    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return results;
  }

  static findById(id) {
    this.checkAndCloseExpired();
    const postings = this.getAll();
    const posting = postings.find(p => p.id === id);
    if (!posting) return null;

    const skills = JobSkill.getByJobPostingId(id);
    const requisition = posting.requisition_id ? Requisition.getById(posting.requisition_id) : null;

    return {
      ...posting,
      skills,
      requisition
    };
  }

  static create(data) {
    const postings = this.getAll();
    const newId = `JOB-${1000 + postings.length + 1}`;
    const timestamp = new Date().toISOString();

    const newPosting = {
      id: newId,
      requisition_id: data.requisition_id || null,
      title: data.title.trim(),
      department: data.department.trim(),
      experience_level: data.experience_level || 'Mid Level',
      salary_range: data.salary_range || 'Negotiable',
      source: data.source || 'Direct Website',
      deadline: data.deadline,
      status: data.status || 'Published',
      blind_mode: Boolean(data.blind_mode),
      description: data.description || '',
      created_at: timestamp,
      updated_at: timestamp
    };

    postings.push(newPosting);
    writeCollection('job_postings', postings);

    // Save weighted skills
    if (Array.isArray(data.skills)) {
      JobSkill.setForJobPosting(newId, data.skills);
    }

    return this.findById(newId);
  }

  static update(id, data) {
    const postings = this.getAll();
    const index = postings.findIndex(p => p.id === id);
    if (index === -1) return null;

    const current = postings[index];
    const timestamp = new Date().toISOString();

    const updated = {
      ...current,
      title: data.title !== undefined ? data.title.trim() : current.title,
      department: data.department !== undefined ? data.department.trim() : current.department,
      requisition_id: data.requisition_id !== undefined ? (data.requisition_id || null) : current.requisition_id,
      experience_level: data.experience_level !== undefined ? data.experience_level : current.experience_level,
      salary_range: data.salary_range !== undefined ? data.salary_range : current.salary_range,
      source: data.source !== undefined ? data.source : current.source,
      deadline: data.deadline !== undefined ? data.deadline : current.deadline,
      status: data.status !== undefined ? data.status : current.status,
      blind_mode: data.blind_mode !== undefined ? Boolean(data.blind_mode) : current.blind_mode,
      description: data.description !== undefined ? data.description : current.description,
      updated_at: timestamp
    };

    // If deadline was moved to future and status was auto-closed, user can re-open
    if (data.deadline && new Date(`${data.deadline}T23:59:59`) > new Date()) {
      delete updated.auto_closed;
      delete updated.closed_reason;
    }

    postings[index] = updated;
    writeCollection('job_postings', postings);

    if (Array.isArray(data.skills)) {
      JobSkill.setForJobPosting(id, data.skills);
    }

    return this.findById(id);
  }

  static updateStatus(id, newStatus) {
    const validStatuses = ['Published', 'Paused', 'Closed', 'Draft'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const postings = this.getAll();
    const index = postings.findIndex(p => p.id === id);
    if (index === -1) return null;

    postings[index].status = newStatus;
    postings[index].updated_at = new Date().toISOString();
    writeCollection('job_postings', postings);

    return this.findById(id);
  }

  static delete(id) {
    let postings = this.getAll();
    const initialLen = postings.length;
    postings = postings.filter(p => p.id !== id);

    if (postings.length === initialLen) return false;

    writeCollection('job_postings', postings);
    JobSkill.deleteForJobPosting(id);
    return true;
  }

  static getSummaryMetrics() {
    this.checkAndCloseExpired();
    const postings = this.getAll();
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const metrics = {
      total: postings.length,
      published: 0,
      paused: 0,
      closed: 0,
      expiring_soon: 0
    };

    for (const p of postings) {
      if (p.status === 'Published') metrics.published++;
      else if (p.status === 'Paused') metrics.paused++;
      else if (p.status === 'Closed') metrics.closed++;

      if (p.deadline && p.status === 'Published') {
        const d = new Date(`${p.deadline}T23:59:59`);
        if (d >= now && d <= sevenDaysFromNow) {
          metrics.expiring_soon++;
        }
      }
    }

    return metrics;
  }
}

module.exports = JobPosting;
