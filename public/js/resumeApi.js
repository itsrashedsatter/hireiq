// F4: Resume Parsing & Data Extraction — frontend API service
// Author: M M Tariqul Islam Siam (23101118)
const ResumeAPI = {
  async getResumes(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters.job_posting_id && filters.job_posting_id !== 'All') params.append('job_posting_id', filters.job_posting_id);
    if (filters.min_experience) params.append('min_experience', filters.min_experience);
    const res = await fetch(`/api/resumes?${params.toString()}`);
    return await res.json();
  },

  async getMetrics() {
    const res = await fetch('/api/resumes/metrics');
    return await res.json();
  },

  async getTaxonomy() {
    const res = await fetch('/api/resumes/skills/taxonomy');
    return await res.json();
  },

  async getResume(id, blind = false) {
    const res = await fetch(`/api/resumes/${encodeURIComponent(id)}${blind ? '?view=blind' : ''}`);
    return await res.json();
  },

  async uploadResume(file, jobPostingId) {
    const form = new FormData();
    form.append('resume', file);
    if (jobPostingId) form.append('job_posting_id', jobPostingId);
    const res = await fetch('/api/resumes/upload', { method: 'POST', body: form });
    return await res.json();
  },

  async parseText(text, jobPostingId) {
    const res = await fetch('/api/resumes/parse-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, job_posting_id: jobPostingId || null })
    });
    return await res.json();
  },

  async updateResume(id, data) {
    const res = await fetch(`/api/resumes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async reparse(id) {
    const res = await fetch(`/api/resumes/${encodeURIComponent(id)}/reparse`, { method: 'POST' });
    return await res.json();
  },

  async deleteResume(id) {
    const res = await fetch(`/api/resumes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    return await res.json();
  }
};
