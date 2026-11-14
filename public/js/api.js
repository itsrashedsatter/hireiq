const API = {
  // Postings
  async getPostings(filters = {}) {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'All') params.append('status', filters.status);
    if (filters.department && filters.department !== 'All') params.append('department', filters.department);
    if (filters.experience_level && filters.experience_level !== 'All') params.append('experience_level', filters.experience_level);
    if (filters.source && filters.source !== 'All') params.append('source', filters.source);

    const res = await fetch(`/api/job-postings?${params.toString()}`);
    return await res.json();
  },

  async getMetrics() {
    const res = await fetch('/api/job-postings/metrics');
    return await res.json();
  },

  async getPostingById(id) {
    const res = await fetch(`/api/job-postings/${id}`);
    return await res.json();
  },

  async createPosting(data) {
    const res = await fetch('/api/job-postings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updatePosting(id, data) {
    const res = await fetch(`/api/job-postings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateStatus(id, status) {
    const res = await fetch(`/api/job-postings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await res.json();
  },

  async deletePosting(id) {
    const res = await fetch(`/api/job-postings/${id}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // Requisitions
  async getApprovedRequisitions() {
    const res = await fetch('/api/requisitions/approved');
    return await res.json();
  }
};
