document.addEventListener('DOMContentLoaded', () => {
  // State
  let currentFilters = {
    search: '',
    status: 'All',
    department: 'All',
    experience_level: 'All',
    source: 'All'
  };
  let currentView = 'recruiter'; // 'recruiter' or 'candidate'
  let cachedRequisitions = [];

  // DOM Elements
  const postingsContainer = document.getElementById('postingsContainer');
  const searchInput = document.getElementById('searchInput');
  const statusFilter = document.getElementById('statusFilter');
  const departmentFilter = document.getElementById('departmentFilter');
  const expFilter = document.getElementById('expFilter');
  const sourceFilter = document.getElementById('sourceFilter');
  
  // Metrics elements
  const metricTotal = document.getElementById('metricTotal');
  const metricPublished = document.getElementById('metricPublished');
  const metricPaused = document.getElementById('metricPaused');
  const metricClosed = document.getElementById('metricClosed');
  const metricExpiring = document.getElementById('metricExpiring');

  // Modals
  const postingModal = document.getElementById('postingModal');
  const modalTitle = document.getElementById('modalTitle');
  const postingForm = document.getElementById('postingForm');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnOpenCreate = document.getElementById('btnOpenCreate');
  const requisitionSelect = document.getElementById('requisitionSelect');

  // Skills Builder
  const skillsContainer = document.getElementById('skillsContainer');
  const btnAddSkill = document.getElementById('btnAddSkill');

  // Details Modal
  const detailsModal = document.getElementById('detailsModal');
  const detailsBody = document.getElementById('detailsBody');
  const btnCloseDetails = document.getElementById('btnCloseDetails');

  // View Switchers
  const navRecruiter = document.getElementById('navRecruiter');
  const navCandidate = document.getElementById('navCandidate');
  const recruiterView = document.getElementById('recruiterView');
  const candidateView = document.getElementById('candidateView');
  const candidatePostingsContainer = document.getElementById('candidatePostingsContainer');

  // --- INITIALIZATION ---
  init();

  async function init() {
    setupEventListeners();
    await loadRequisitions();
    await refreshData();
  }

  function setupEventListeners() {
    // Search with debounce
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentFilters.search = e.target.value;
        loadPostings();
      }, 250);
    });

    // Filters
    statusFilter.addEventListener('change', (e) => {
      currentFilters.status = e.target.value;
      loadPostings();
    });

    departmentFilter.addEventListener('change', (e) => {
      currentFilters.department = e.target.value;
      loadPostings();
    });

    expFilter.addEventListener('change', (e) => {
      currentFilters.experience_level = e.target.value;
      loadPostings();
    });

    sourceFilter.addEventListener('change', (e) => {
      currentFilters.source = e.target.value;
      loadPostings();
    });

    // Modals
    btnOpenCreate.addEventListener('click', () => openCreateModal());
    btnCloseModal.addEventListener('click', () => closeModal(postingModal));
    btnCancelModal.addEventListener('click', () => closeModal(postingModal));
    btnCloseDetails.addEventListener('click', () => closeModal(detailsModal));

    postingModal.addEventListener('click', (e) => {
      if (e.target === postingModal) closeModal(postingModal);
    });
    detailsModal.addEventListener('click', (e) => {
      if (e.target === detailsModal) closeModal(detailsModal);
    });

    // Skills
    btnAddSkill.addEventListener('click', () => addSkillRow());

    // Requisition Auto-fill
    requisitionSelect.addEventListener('change', onRequisitionSelect);

    // Form Submit
    postingForm.addEventListener('submit', handleFormSubmit);

    // View Navigation
    navRecruiter.addEventListener('click', () => switchView('recruiter'));
    navCandidate.addEventListener('click', () => switchView('candidate'));
  }

  function switchView(view) {
    currentView = view;
    if (view === 'recruiter') {
      navRecruiter.classList.add('active');
      navCandidate.classList.remove('active');
      recruiterView.style.display = 'block';
      candidateView.style.display = 'none';
      loadPostings();
    } else {
      navCandidate.classList.add('active');
      navRecruiter.classList.remove('active');
      recruiterView.style.display = 'none';
      candidateView.style.display = 'block';
      loadCandidatePostings();
    }
  }

  async function refreshData() {
    await Promise.all([loadMetrics(), loadPostings()]);
  }

  async function loadMetrics() {
    try {
      const res = await API.getMetrics();
      if (res.success) {
        const m = res.data;
        metricTotal.textContent = m.total;
        metricPublished.textContent = m.published;
        metricPaused.textContent = m.paused;
        metricClosed.textContent = m.closed;
        metricExpiring.textContent = m.expiring_soon;
      }
    } catch (err) {
      console.error('Error loading metrics:', err);
    }
  }

  async function loadRequisitions() {
    try {
      const res = await API.getApprovedRequisitions();
      if (res.success) {
        cachedRequisitions = res.data;
        requisitionSelect.innerHTML = '<option value="">-- None (Standalone Job Posting) --</option>';
        cachedRequisitions.forEach(r => {
          const opt = document.createElement('option');
          opt.value = r.id;
          opt.textContent = `[${r.id}] ${r.title} (${r.department}) - Budget: ${r.budget_range}`;
          requisitionSelect.appendChild(opt);
        });
      }
    } catch (err) {
      console.error('Error loading requisitions:', err);
    }
  }

  function onRequisitionSelect() {
    const selectedId = requisitionSelect.value;
    if (!selectedId) return;
    const req = cachedRequisitions.find(r => r.id === selectedId);
    if (req) {
      document.getElementById('jobTitle').value = req.title;
      document.getElementById('jobDepartment').value = req.department;
      document.getElementById('jobSalary').value = req.budget_range;
      if (!document.getElementById('jobDescription').value) {
        document.getElementById('jobDescription').value = `Vacancy for approved requisition ${req.id}. ${req.justification}`;
      }
      showToast(`Auto-filled details from Requisition ${req.id}`, 'info');
    }
  }

  async function loadPostings() {
    try {
      postingsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading postings...</div>';
      const res = await API.getPostings(currentFilters);
      
      if (!res.success || res.data.length === 0) {
        postingsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3 class="empty-title">No Job Postings Found</h3>
            <p class="empty-text">Try adjusting your filters or search keywords, or click "+ Create Job Posting" to add one.</p>
          </div>
        `;
        return;
      }

      postingsContainer.innerHTML = '';
      res.data.forEach(job => {
        postingsContainer.appendChild(renderJobCard(job));
      });
    } catch (err) {
      console.error('Error loading postings:', err);
      postingsContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">Failed to load job postings.</div>';
    }
  }

  async function loadCandidatePostings() {
    try {
      candidatePostingsContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading available openings...</div>';
      // Only show Published postings to candidates
      const res = await API.getPostings({ ...currentFilters, status: 'Published' });
      
      if (!res.success || res.data.length === 0) {
        candidatePostingsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">💼</div>
            <h3 class="empty-title">No Open Positions Currently</h3>
            <p class="empty-text">Check back soon for new career opportunities!</p>
          </div>
        `;
        return;
      }

      candidatePostingsContainer.innerHTML = '';
      res.data.forEach(job => {
        candidatePostingsContainer.appendChild(renderCandidateJobCard(job));
      });
    } catch (err) {
      console.error('Error loading candidate postings:', err);
      candidatePostingsContainer.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align: center;">Failed to load job postings.</div>';
    }
  }

  function renderJobCard(job) {
    const card = document.createElement('div');
    card.className = 'posting-card';

    // Status styling
    let statusClass = 'status-published';
    let dotClass = 'dot-published';
    if (job.status === 'Paused') {
      statusClass = 'status-paused';
      dotClass = 'dot-paused';
    } else if (job.status === 'Closed') {
      statusClass = 'status-closed';
      dotClass = 'dot-closed';
    }

    // Deadline calculation
    const now = new Date();
    const deadlineDate = new Date(`${job.deadline}T23:59:59`);
    const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    
    let deadlineBadgeHtml = '';
    if (job.status === 'Closed' && job.auto_closed) {
      deadlineBadgeHtml = `<div class="deadline-info deadline-passed"><span>⚠️ Expired & Auto-Closed</span><span>${job.deadline}</span></div>`;
    } else if (diffDays < 0) {
      deadlineBadgeHtml = `<div class="deadline-info deadline-passed"><span>⏱️ Expired</span><span>${job.deadline}</span></div>`;
    } else if (diffDays <= 5) {
      deadlineBadgeHtml = `<div class="deadline-info deadline-urgent"><span>🔥 Closes in ${diffDays} day${diffDays === 1 ? '' : 's'}</span><span>${job.deadline}</span></div>`;
    } else {
      deadlineBadgeHtml = `<div class="deadline-info deadline-active"><span>📅 Application Deadline</span><span>${job.deadline} (${diffDays} days left)</span></div>`;
    }

    // Skills HTML
    let skillsHtml = '';
    if (job.skills && job.skills.length > 0) {
      const skillsChips = job.skills.map(s => {
        const stars = '★'.repeat(s.weight) + '☆'.repeat(5 - s.weight);
        return `<span class="skill-tag skill-weight-${s.weight}" title="Weight: ${s.weight}/5">${escapeHtml(s.skill_name)} <span class="weight-stars">${stars}</span></span>`;
      }).join('');
      
      skillsHtml = `
        <div class="skills-block">
          <div class="skills-heading">
            <span>Weighted Required Skills (${job.skills.length})</span>
            <span style="font-size: 0.65rem; text-transform: none; color: var(--neutral-400);">Max W: 5</span>
          </div>
          <div class="skills-tags-wrap">${skillsChips}</div>
        </div>
      `;
    } else {
      skillsHtml = `<div class="skills-block" style="font-size: 0.8rem; color: var(--neutral-400); text-align: center;">No specific skill weights defined</div>`;
    }

    card.innerHTML = `
      <div class="card-top">
        <div>
          <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary); margin-bottom: 0.2rem;">${escapeHtml(job.id)}</div>
          <h3 class="card-title">${escapeHtml(job.title)}</h3>
        </div>
        <span class="status-badge ${statusClass}">
          <span class="status-dot ${dotClass}"></span>
          ${escapeHtml(job.status)}
        </span>
      </div>

      <div class="card-meta-chips">
        <span class="meta-chip">🏢 ${escapeHtml(job.department)}</span>
        <span class="meta-chip">💼 ${escapeHtml(job.experience_level)}</span>
        <span class="meta-chip">💵 ${escapeHtml(job.salary_range)}</span>
        <span class="meta-chip">🏷️ ${escapeHtml(job.source || 'Website')}</span>
        ${job.requisition_id ? `<span class="meta-chip req-badge">📄 ${escapeHtml(job.requisition_id)}</span>` : ''}
        ${job.blind_mode ? `<span class="meta-chip blind-badge">🕶️ Blind Mode Active</span>` : ''}
      </div>

      <p class="card-description">${escapeHtml(job.description || 'No description provided.')}</p>

      ${skillsHtml}

      ${deadlineBadgeHtml}

      <div class="card-actions">
        <button class="btn-card btn-card-primary btn-view" data-id="${job.id}">👁️ View Details</button>
        <button class="btn-card btn-edit" data-id="${job.id}">✏️ Edit</button>
        
        <!-- Status quick actions -->
        ${job.status === 'Published' 
          ? `<button class="btn-card btn-toggle-status" data-id="${job.id}" data-status="Paused" title="Pause applications">⏸️ Pause</button>` 
          : `<button class="btn-card btn-toggle-status" data-id="${job.id}" data-status="Published" title="Publish / Resume">▶️ Publish</button>`}
        
        ${job.status !== 'Closed' 
          ? `<button class="btn-card btn-card-danger btn-toggle-status" data-id="${job.id}" data-status="Closed" title="Close posting">🛑 Close</button>` 
          : ''}

        <button class="btn-card btn-card-danger btn-delete" data-id="${job.id}" title="Delete posting" style="margin-left: auto;">🗑️</button>
      </div>
    `;

    // Attach card event listeners
    card.querySelector('.btn-view').addEventListener('click', () => viewDetails(job.id));
    card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(job.id));
    card.querySelectorAll('.btn-toggle-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const newStatus = e.currentTarget.dataset.status;
        changeStatus(id, newStatus);
      });
    });
    card.querySelector('.btn-delete').addEventListener('click', () => confirmDelete(job.id, job.title));

    return card;
  }

  function renderCandidateJobCard(job) {
    const card = document.createElement('div');
    card.className = 'posting-card';

    const skillsChips = (job.skills || []).map(s => {
      return `<span class="skill-tag skill-weight-${s.weight}">${escapeHtml(s.skill_name)}</span>`;
    }).join('');

    card.innerHTML = `
      <div class="card-top">
        <div>
          <h3 class="card-title">${escapeHtml(job.title)}</h3>
          <div style="font-size: 0.85rem; color: var(--neutral-500); margin-top: 0.2rem;">${escapeHtml(job.department)} &bull; ${escapeHtml(job.experience_level)}</div>
        </div>
        <span class="status-badge status-published">
          <span class="status-dot dot-published"></span> Open
        </span>
      </div>

      <div class="card-meta-chips" style="margin-top: 0.5rem;">
        <span class="meta-chip">💵 Salary: ${escapeHtml(job.salary_range)}</span>
        <span class="meta-chip">📅 Apply Before: ${escapeHtml(job.deadline)}</span>
      </div>

      <p class="card-description">${escapeHtml(job.description || '')}</p>

      <div class="skills-block">
        <div class="skills-heading">Required Competencies & Skills</div>
        <div class="skills-tags-wrap">${skillsChips}</div>
      </div>

      <div class="card-actions" style="margin-top: 1rem;">
        <button class="btn-primary btn-apply" style="width: 100%; justify-content: center;" onclick="alert('Candidate Application Portal (Sprint 1 / Member 1 Feature F3) will integrate here to receive applications.')">
          🚀 Apply for this Position
        </button>
      </div>
    `;
    return card;
  }

  // --- ACTIONS ---

  async function changeStatus(id, newStatus) {
    try {
      const res = await API.updateStatus(id, newStatus);
      if (res.success) {
        showToast(`Posting status changed to ${newStatus}`, 'success');
        refreshData();
      } else {
        showToast(res.message || 'Failed to update status', 'error');
      }
    } catch (err) {
      showToast('Error updating status', 'error');
    }
  }

  async function confirmDelete(id, title) {
    if (confirm(`Are you sure you want to permanently delete "${title}" (${id})?`)) {
      try {
        const res = await API.deletePosting(id);
        if (res.success) {
          showToast(`Deleted job posting ${id}`, 'success');
          refreshData();
        } else {
          showToast(res.message || 'Failed to delete posting', 'error');
        }
      } catch (err) {
        showToast('Error deleting posting', 'error');
      }
    }
  }

  async function viewDetails(id) {
    try {
      const res = await API.getPostingById(id);
      if (!res.success) return showToast('Could not load posting details', 'error');

      const job = res.data;
      
      let reqHtml = '';
      if (job.requisition) {
        reqHtml = `
          <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 700; color: #9d174d; margin-bottom: 0.3rem;">Linked Requisition: ${job.requisition.id} (${job.requisition.status})</div>
            <div style="font-size: 0.85rem; color: #831843;"><strong>Requested by:</strong> ${job.requisition.requested_by}</div>
            <div style="font-size: 0.85rem; color: #831843;"><strong>Approved Budget:</strong> ${job.requisition.budget_range} &bull; Headcount: ${job.requisition.headcount}</div>
            <div style="font-size: 0.85rem; color: #831843; margin-top: 0.2rem;"><strong>Justification:</strong> ${job.requisition.justification}</div>
          </div>
        `;
      }

      let skillsTableHtml = '';
      if (job.skills && job.skills.length > 0) {
        skillsTableHtml = `
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 0.5rem;">
            <thead>
              <tr style="background: var(--neutral-100); text-align: left; border-bottom: 1px solid var(--neutral-300);">
                <th style="padding: 0.5rem;">Skill Name</th>
                <th style="padding: 0.5rem; width: 80px;">Weight</th>
                <th style="padding: 0.5rem;">Significance Level</th>
              </tr>
            </thead>
            <tbody>
              ${job.skills.map(s => {
                const labels = {
                  1: '1/5 - Nice to have / Basic',
                  2: '2/5 - Familiar',
                  3: '3/5 - Competent / Working',
                  4: '4/5 - Advanced',
                  5: '5/5 - Critical / Must-have'
                };
                return `
                  <tr style="border-bottom: 1px solid var(--neutral-200);">
                    <td style="padding: 0.5rem; font-weight: 600;">${escapeHtml(s.skill_name)}</td>
                    <td style="padding: 0.5rem;">
                      <span class="skill-tag skill-weight-${s.weight}">${s.weight} / 5</span>
                    </td>
                    <td style="padding: 0.5rem; color: var(--neutral-600);">${labels[s.weight]}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      } else {
        skillsTableHtml = '<p style="color: var(--neutral-500); font-size: 0.85rem;">No skills configured.</p>';
      }

      detailsBody.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary);">${job.id}</div>
            <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--neutral-900);">${escapeHtml(job.title)}</h2>
            <div style="font-size: 0.9rem; color: var(--neutral-500); margin-top: 0.2rem;">${escapeHtml(job.department)} &bull; ${escapeHtml(job.experience_level)}</div>
          </div>
          <span class="status-badge status-${job.status.toLowerCase()}">${job.status}</span>
        </div>

        ${reqHtml}

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.25rem; background: var(--neutral-100); padding: 1rem; border-radius: var(--radius-md);">
          <div><span style="color: var(--neutral-500); font-size: 0.8rem;">Salary Range:</span> <div style="font-weight: 700;">${escapeHtml(job.salary_range)}</div></div>
          <div><span style="color: var(--neutral-500); font-size: 0.8rem;">Source Tag:</span> <div style="font-weight: 700;">${escapeHtml(job.source || 'Direct')}</div></div>
          <div><span style="color: var(--neutral-500); font-size: 0.8rem;">Application Deadline:</span> <div style="font-weight: 700;">${escapeHtml(job.deadline)}</div></div>
          <div><span style="color: var(--neutral-500); font-size: 0.8rem;">Blind Screening Mode:</span> <div style="font-weight: 700;">${job.blind_mode ? '✅ Enabled' : '❌ Disabled'}</div></div>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--neutral-700); margin-bottom: 0.4rem;">Job Description</h4>
          <div style="background: #ffffff; border: 1px solid var(--neutral-200); border-radius: var(--radius-md); padding: 1rem; font-size: 0.875rem; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(job.description || 'No description.')}</div>
        </div>

        <div>
          <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--neutral-700); margin-bottom: 0.4rem;">Weighted Required Skills (For AI Job-Matching)</h4>
          ${skillsTableHtml}
        </div>
      `;

      openModal(detailsModal);
    } catch (err) {
      showToast('Error opening details', 'error');
    }
  }

  // --- MODAL & FORM HANDLING ---

  function openCreateModal() {
    modalTitle.textContent = 'Create New Job Posting';
    postingForm.reset();
    document.getElementById('editJobId').value = '';
    skillsContainer.innerHTML = '';
    
    // Add 2 default skill rows
    addSkillRow('', 5);
    addSkillRow('', 4);

    // Set default deadline to +14 days from today
    const d = new Date();
    d.setDate(d.getDate() + 14);
    document.getElementById('jobDeadline').value = d.toISOString().split('T')[0];

    openModal(postingModal);
  }

  async function openEditModal(id) {
    try {
      const res = await API.getPostingById(id);
      if (!res.success) return showToast('Could not load posting', 'error');

      const job = res.data;
      modalTitle.textContent = `Edit Job Posting: ${job.id}`;
      document.getElementById('editJobId').value = job.id;

      requisitionSelect.value = job.requisition_id || '';
      document.getElementById('jobTitle').value = job.title;
      document.getElementById('jobDepartment').value = job.department;
      document.getElementById('jobExpLevel').value = job.experience_level;
      document.getElementById('jobSalary').value = job.salary_range;
      document.getElementById('jobSource').value = job.source;
      document.getElementById('jobDeadline').value = job.deadline;
      document.getElementById('jobStatus').value = job.status;
      document.getElementById('jobBlindMode').checked = Boolean(job.blind_mode);
      document.getElementById('jobDescription').value = job.description || '';

      // Populate skills
      skillsContainer.innerHTML = '';
      if (job.skills && job.skills.length > 0) {
        job.skills.forEach(s => addSkillRow(s.skill_name, s.weight));
      } else {
        addSkillRow('', 3);
      }

      openModal(postingModal);
    } catch (err) {
      showToast('Error loading posting for edit', 'error');
    }
  }

  function addSkillRow(name = '', weight = 3) {
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <input type="text" class="form-input skill-name-input" placeholder="e.g. Node.js, System Design" value="${escapeHtml(name)}" required />
      <select class="form-select skill-weight-select">
        <option value="1" ${weight == 1 ? 'selected' : ''}>Weight 1 (Basic / Nice to have)</option>
        <option value="2" ${weight == 2 ? 'selected' : ''}>Weight 2 (Familiar)</option>
        <option value="3" ${weight == 3 ? 'selected' : ''}>Weight 3 (Competent)</option>
        <option value="4" ${weight == 4 ? 'selected' : ''}>Weight 4 (Advanced)</option>
        <option value="5" ${weight == 5 ? 'selected' : ''}>Weight 5 (Critical / Must-Have)</option>
      </select>
      <button type="button" class="btn-remove-skill" title="Remove skill">&times;</button>
    `;

    row.querySelector('.btn-remove-skill').addEventListener('click', () => {
      if (skillsContainer.querySelectorAll('.skill-row').length > 1) {
        row.remove();
      } else {
        showToast('At least one skill requirement is recommended', 'warning');
      }
    });

    skillsContainer.appendChild(row);
  }

  async function handleFormSubmit(e) {
    e.preventDefault();

    const editId = document.getElementById('editJobId').value;
    
    // Collect skills
    const skillRows = skillsContainer.querySelectorAll('.skill-row');
    const skills = [];
    skillRows.forEach(row => {
      const name = row.querySelector('.skill-name-input').value.trim();
      const weight = parseInt(row.querySelector('.skill-weight-select').value, 10);
      if (name) {
        skills.push({ skill_name: name, weight });
      }
    });

    const payload = {
      title: document.getElementById('jobTitle').value.trim(),
      department: document.getElementById('jobDepartment').value.trim(),
      requisition_id: requisitionSelect.value || null,
      experience_level: document.getElementById('jobExpLevel').value,
      salary_range: document.getElementById('jobSalary').value.trim(),
      source: document.getElementById('jobSource').value,
      deadline: document.getElementById('jobDeadline').value,
      status: document.getElementById('jobStatus').value,
      blind_mode: document.getElementById('jobBlindMode').checked,
      description: document.getElementById('jobDescription').value.trim(),
      skills
    };

    try {
      let res;
      if (editId) {
        res = await API.updatePosting(editId, payload);
      } else {
        res = await API.createPosting(payload);
      }

      if (res.success) {
        showToast(res.message, 'success');
        closeModal(postingModal);
        refreshData();
      } else {
        showToast(res.message || 'Operation failed', 'error');
      }
    } catch (err) {
      showToast('Network error while saving posting', 'error');
    }
  }

  function openModal(modal) {
    modal.classList.add('active');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
