const { readCollection, writeCollection } = require('../config/database');

class JobSkill {
  static getAll() {
    return readCollection('job_skills');
  }

  static getByJobPostingId(jobPostingId) {
    const skills = this.getAll();
    return skills.filter(s => s.job_posting_id === jobPostingId);
  }

  static setForJobPosting(jobPostingId, skillsList) {
    let allSkills = this.getAll();
    // Remove existing skills for this job
    allSkills = allSkills.filter(s => s.job_posting_id !== jobPostingId);

    // Insert new skills
    const newSkills = (skillsList || []).map((s, index) => ({
      id: s.id || `SKL-${Date.now()}-${index + 1}`,
      job_posting_id: jobPostingId,
      skill_name: (s.skill_name || '').trim(),
      weight: Math.min(Math.max(parseInt(s.weight, 10) || 1, 1), 5)
    })).filter(s => s.skill_name.length > 0);

    allSkills.push(...newSkills);
    writeCollection('job_skills', allSkills);
    return newSkills;
  }

  static deleteForJobPosting(jobPostingId) {
    let allSkills = this.getAll();
    allSkills = allSkills.filter(s => s.job_posting_id !== jobPostingId);
    writeCollection('job_skills', allSkills);
  }
}

module.exports = JobSkill;
