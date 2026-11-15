// F4: Resume Parsing & Data Extraction — page controller (View helper)
// Author: M M Tariqul Islam Siam (23101118)
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    mode: 'file',
    file: null,
    filters: { search: '', status: 'All', job_posting_id: 'All', min_experience: '' },
    jobs: [],
    taxonomy: [],
    current: null,      // resume currently open in the modal
    tab: 'overview',
    blind: false,
    editSkills: []
  };

  const $ = id => document.getElementById(id);
  const container = $('resumesContainer');
  const fileInput = $('fileInput');
  const dropZone = $('dropZone');
  const btnParse = $('btnParse');
  const resumeText = $('resumeText');
  const detailsModal = $('detailsModal');
  const detailsBody = $('detailsBody');

  init();

  async function init() {
    setupUpload();
    setupFilters();
    setupModal();
    await Promise.all([loadJobs(), loadTaxonomy()]);
    await refresh();
  }

  /* ---------------- Data loading ---------------- */

  async function refresh() {
    await Promise.all([loadMetrics(), loadResumes()]);
  }

  async function loadJobs() {
    try {
      const res = await API.getPostings();
      state.jobs = res.success ? res.data : [];
      const options = state.jobs
        .map(j => `<option value="${escapeAttr(j.id)}">${escapeHtml(j.id)} — ${escapeHtml(j.title)}${j.status !== 'Published' ? ` (${escapeHtml(j.status)})` : ''}</option>`)
        .join('');
      $('uploadJob').insertAdjacentHTML('beforeend', options);
      $('jobFilter').insertAdjacentHTML('beforeend', options);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadTaxonomy() {
    try {
      const res = await ResumeAPI.getTaxonomy();
      state.taxonomy = res.success ? res.data : [];
    } catch (e) {
      console.error(e);
    }
  }

  async function loadMetrics() {
    const res = await ResumeAPI.getMetrics();
    if (!res.success) return;
    const m = res.data;
    $('metricTotal').textContent = m.total;
    $('metricParsed').textContent = m.parsed;
    $('metricReview').textContent = m.needs_review;
    $('metricVerified').textContent = m.verified;
    $('metricConfidence').textContent = `${Math.round(m.average_confidence * 100)}%`;
  }

  async function loadResumes() {
    container.innerHTML = '<div class="empty-state"><div class="empty-text">Loading resumes…</div></div>';
    const res = await ResumeAPI.getResumes(state.filters);
    if (!res.success) {
      container.innerHTML = `<div class="empty-state"><div class="empty-title">Could not load resumes</div><div class="empty-text">${escapeHtml(res.message || '')}</div></div>`;
      return;
    }
    if (!res.data.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No resumes found</div>
          <div class="empty-text">Upload a resume above, or change the filters.</div>
        </div>`;
      return;
    }
    container.innerHTML = res.data.map(renderCard).join('');
    container.querySelectorAll('[data-open]').forEach(btn =>
      btn.addEventListener('click', () => openDetails(btn.dataset.open)));
  }

  /* ---------------- Rendering ---------------- */

  function statusClass(status) {
    return { Parsed: 'status-published', 'Needs Review': 'status-paused', Verified: 'status-verified' }[status] || '';
  }

  function confidenceClass(c) {
    return c >= 0.8 ? 'conf-high' : c >= 0.6 ? 'conf-mid' : 'conf-low';
  }

  function jobLabel(id) {
    const job = state.jobs.find(j => j.id === id);
    return job ? `${job.id} · ${job.title}` : id;
  }

  function renderCard(r) {
    const conf = Math.round(r.confidence * 100);
    const edu = r.highest_education;
    return `
      <article class="posting-card resume-card">
        <div class="card-top">
          <div>
            <div class="card-title">${escapeHtml(r.candidate_name || 'Unknown candidate')}</div>
            <div class="resume-sub">${escapeHtml(r.email || 'No email found')}</div>
          </div>
          <span class="status-badge ${statusClass(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        <div class="card-meta-chips">
          <span class="meta-chip">🆔 ${escapeHtml(r.id)}</span>
          <span class="meta-chip">📎 ${escapeHtml(r.file_type.toUpperCase())}</span>
          <span class="meta-chip">💼 ${r.total_experience_years} yrs</span>
          ${edu ? `<span class="meta-chip">🎓 ${escapeHtml(edu.degree || edu.level)}</span>` : ''}
          ${r.job_posting_id ? `<span class="meta-chip">📌 ${escapeHtml(jobLabel(r.job_posting_id))}</span>` : ''}
        </div>
        <div class="confidence-row">
          <span class="confidence-label">Parse confidence</span>
          <div class="confidence-bar"><div class="confidence-fill ${confidenceClass(r.confidence)}" style="width:${conf}%"></div></div>
          <span class="confidence-value">${conf}%</span>
        </div>
        <div class="skills-block">
          <div class="skills-heading">Top skills (${r.skills_count})</div>
          <div class="skills-tags-wrap">
            ${r.top_skills.length ? r.top_skills.map(s => `<span class="skill-tag parsed-skill">${escapeHtml(s)}</span>`).join('') : '<span class="muted">No skills recognised</span>'}
          </div>
        </div>
        ${r.warnings_count ? `<div class="warning-note">⚠️ ${r.warnings_count} warning${r.warnings_count > 1 ? 's' : ''} to review</div>` : ''}
        <div class="card-actions">
          <button class="btn-card btn-card-primary" data-open="${escapeAttr(r.id)}">🔍 View parsed data</button>
        </div>
      </article>`;
  }

  function renderOverview(r) {
    const p = r.parsed;
    const c = p.contact;
    const link = url => url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(url.replace(/^https?:\/\//, ''))}</a>` : '<span class="muted">—</span>';
    const fieldConf = Object.entries(p.confidence.fields)
      .map(([k, v]) => `<span class="field-conf ${confidenceClass(v)}">${escapeHtml(k)} ${Math.round(v * 100)}%</span>`).join('');

    const skillsByCategory = {};
    for (const s of p.skills) (skillsByCategory[s.category] = skillsByCategory[s.category] || []).push(s);

    return `
      ${p.warnings.length ? `<div class="warning-box">${p.warnings.map(w => `<div>⚠️ ${escapeHtml(w)}</div>`).join('')}</div>` : ''}

      <div class="detail-section">
        <div class="detail-heading">Extraction confidence</div>
        <div class="field-conf-wrap">${fieldConf}</div>
      </div>

      <div class="detail-section">
        <div class="detail-heading">Contact</div>
        <div class="kv-grid">
          <span>Name</span><strong>${escapeHtml(c.name || '—')}</strong>
          <span>Email</span><span>${escapeHtml(c.email || '—')}</span>
          <span>Phone</span><span>${escapeHtml(c.phone || '—')}</span>
          <span>Location</span><span>${escapeHtml(c.location || '—')}</span>
          <span>LinkedIn</span><span>${link(c.linkedin)}</span>
          <span>GitHub</span><span>${link(c.github)}</span>
          <span>Portfolio</span><span>${link(c.portfolio)}</span>
        </div>
      </div>

      ${p.summary ? `<div class="detail-section"><div class="detail-heading">Summary</div><p class="detail-text">${escapeHtml(p.summary)}</p></div>` : ''}

      <div class="detail-section">
        <div class="detail-heading">Skills (${p.skills.length})</div>
        ${Object.entries(skillsByCategory).map(([cat, skills]) => `
          <div class="skill-cat">
            <span class="skill-cat-name">${escapeHtml(cat)}</span>
            <div class="skills-tags-wrap">
              ${skills.map(s => `<span class="skill-tag parsed-skill ${s.in_skills_section ? '' : 'skill-inferred'}" title="${s.mentions} mention(s) · confidence ${Math.round(s.confidence * 100)}%${s.in_skills_section ? '' : ' · found outside the Skills section'}">${escapeHtml(s.name)}</span>`).join('')}
            </div>
          </div>`).join('') || '<span class="muted">No skills recognised</span>'}
        ${p.unrecognized_skills.length ? `<div class="unrecognized">Not in taxonomy: ${p.unrecognized_skills.map(escapeHtml).join(', ')}</div>` : ''}
      </div>

      <div class="detail-section">
        <div class="detail-heading">Experience · ${p.total_experience_years} years total</div>
        ${p.experience.length ? p.experience.map(e => `
          <div class="timeline-item">
            <div class="timeline-title">${escapeHtml(e.title || 'Role not identified')} ${e.company ? `<span class="muted">at</span> ${escapeHtml(e.company)}` : ''}</div>
            <div class="timeline-meta">${escapeHtml(e.start_date || '?')} – ${escapeHtml(e.end_date || '?')}${e.duration_months ? ` · ${formatMonths(e.duration_months)}` : ''}${e.location ? ` · ${escapeHtml(e.location)}` : ''}</div>
            ${e.description && e.description.length ? `<ul class="timeline-desc">${e.description.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
          </div>`).join('') : '<span class="muted">No dated roles extracted</span>'}
      </div>

      <div class="detail-section">
        <div class="detail-heading">Education</div>
        ${p.education.length ? p.education.map(e => `
          <div class="timeline-item">
            <div class="timeline-title">${escapeHtml(e.degree || 'Degree not identified')}${e.field ? ` in ${escapeHtml(e.field)}` : ''}</div>
            <div class="timeline-meta">${escapeHtml(e.institution || 'Institution not identified')}${e.start_year || e.end_year ? ` · ${e.start_year || ''}${e.start_year && e.end_year ? '–' : ''}${e.end_year || (e.is_current ? 'Present' : '')}` : ''}${e.grade ? ` · CGPA ${e.grade.value}/${e.grade.scale}` : ''}</div>
          </div>`).join('') : '<span class="muted">No education entries extracted</span>'}
      </div>

      ${listBlock('Projects', p.projects)}
      ${listBlock('Certifications', p.certifications)}
      ${listBlock('Awards', p.awards)}
      ${p.languages.length ? `<div class="detail-section"><div class="detail-heading">Languages</div><div class="skills-tags-wrap">${p.languages.map(l => `<span class="meta-chip">${escapeHtml(l.language)}${l.proficiency ? ` · ${escapeHtml(l.proficiency)}` : ''}</span>`).join('')}</div></div>` : ''}
    `;
  }

  function listBlock(title, items) {
    if (!items || !items.length) return '';
    return `<div class="detail-section"><div class="detail-heading">${title}</div><ul class="timeline-desc">${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`;
  }

  function renderEditForm(r) {
    const p = r.parsed;
    const c = p.contact;
    state.editSkills = p.skills.map(s => s.name);
    const input = (id, label, value, type = 'text') => `
      <div class="form-group">
        <label class="form-label" for="${id}">${label}</label>
        <input type="${type}" id="${id}" class="form-input" value="${escapeAttr(value || '')}">
      </div>`;

    return `
      <p class="form-help edit-intro">Correct anything the parser got wrong. Saving marks this resume as <strong>Verified</strong>, and the corrected data is what job matching (F5) will use.</p>
      <div class="form-grid">
        ${input('editName', 'Full name', c.name)}
        ${input('editEmail', 'Email', c.email, 'email')}
        ${input('editPhone', 'Phone', c.phone)}
        ${input('editLocation', 'Location', c.location)}
        ${input('editLinkedin', 'LinkedIn', c.linkedin)}
        ${input('editGithub', 'GitHub', c.github)}
        ${input('editPortfolio', 'Portfolio', c.portfolio)}
        ${input('editYears', 'Total experience (years)', p.total_experience_years, 'number')}
        <div class="form-group">
          <label class="form-label" for="editJob">Applying for</label>
          <select id="editJob" class="form-select">
            <option value="">-- Not linked --</option>
            ${state.jobs.map(j => `<option value="${escapeAttr(j.id)}" ${j.id === r.job_posting_id ? 'selected' : ''}>${escapeHtml(j.id)} — ${escapeHtml(j.title)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group form-full">
          <label class="form-label" for="editSummary">Summary</label>
          <textarea id="editSummary" class="form-textarea">${escapeHtml(p.summary || '')}</textarea>
        </div>
        <div class="form-group form-full">
          <label class="form-label" for="skillInput">Skills</label>
          <div id="editSkillTags" class="skills-tags-wrap edit-skill-tags"></div>
          <div class="skill-add-row">
            <input id="skillInput" class="form-input" list="taxonomyList" placeholder="Type a skill and press Enter">
            <datalist id="taxonomyList">${state.taxonomy.map(t => `<option value="${escapeAttr(t.name)}">`).join('')}</datalist>
            <button type="button" id="btnAddSkill" class="btn-add-skill">➕ Add</button>
          </div>
        </div>
        <div class="form-group form-full">
          <div class="skills-builder-header">
            <label class="form-label">Experience</label>
            <button type="button" class="btn-add-skill" data-add-row="experience">➕ Add role</button>
          </div>
          <div id="experienceRows">${p.experience.map(experienceRow).join('')}</div>
        </div>
        <div class="form-group form-full">
          <div class="skills-builder-header">
            <label class="form-label">Education</label>
            <button type="button" class="btn-add-skill" data-add-row="education">➕ Add entry</button>
          </div>
          <div id="educationRows">${p.education.map(educationRow).join('')}</div>
        </div>
      </div>`;
  }

  function experienceRow(e = {}) {
    return `
      <div class="edit-row" data-row="experience" data-extra="${escapeAttr(JSON.stringify({ description: e.description || [], location: e.location || null }))}">
        <input class="form-input" data-f="title" placeholder="Job title" value="${escapeAttr(e.title || '')}">
        <input class="form-input" data-f="company" placeholder="Company" value="${escapeAttr(e.company || '')}">
        <input class="form-input small" data-f="start_date" placeholder="Start (YYYY-MM)" value="${escapeAttr(e.start_date || '')}">
        <input class="form-input small" data-f="end_date" placeholder="End / Present" value="${escapeAttr(e.end_date || '')}">
        <button type="button" class="btn-remove-skill" data-remove-row title="Remove">✕</button>
      </div>`;
  }

  function educationRow(e = {}) {
    return `
      <div class="edit-row" data-row="education" data-extra="${escapeAttr(JSON.stringify({ level: e.level || null, start_year: e.start_year || null, grade: e.grade || null, is_current: Boolean(e.is_current) }))}">
        <input class="form-input small" data-f="degree" placeholder="Degree" value="${escapeAttr(e.degree || '')}">
        <input class="form-input" data-f="field" placeholder="Field of study" value="${escapeAttr(e.field || '')}">
        <input class="form-input" data-f="institution" placeholder="Institution" value="${escapeAttr(e.institution || '')}">
        <input class="form-input small" data-f="end_year" placeholder="Year" value="${escapeAttr(e.end_year || '')}">
        <button type="button" class="btn-remove-skill" data-remove-row title="Remove">✕</button>
      </div>`;
  }

  function renderEditSkillTags() {
    const wrap = $('editSkillTags');
    if (!wrap) return;
    wrap.innerHTML = state.editSkills.length
      ? state.editSkills.map((s, i) => `<span class="skill-tag parsed-skill removable">${escapeHtml(s)} <button type="button" data-remove-skill="${i}" aria-label="Remove ${escapeAttr(s)}">×</button></span>`).join('')
      : '<span class="muted">No skills</span>';
    wrap.querySelectorAll('[data-remove-skill]').forEach(b => b.addEventListener('click', () => {
      state.editSkills.splice(+b.dataset.removeSkill, 1);
      renderEditSkillTags();
    }));
  }

  function bindEditForm() {
    renderEditSkillTags();
    const addSkill = () => {
      const input = $('skillInput');
      const v = input.value.trim();
      if (v && !state.editSkills.some(s => s.toLowerCase() === v.toLowerCase())) state.editSkills.push(v);
      input.value = '';
      renderEditSkillTags();
    };
    $('btnAddSkill').addEventListener('click', addSkill);
    $('skillInput').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });

    detailsBody.querySelectorAll('[data-add-row]').forEach(btn => btn.addEventListener('click', () => {
      const target = btn.dataset.addRow === 'experience' ? $('experienceRows') : $('educationRows');
      target.insertAdjacentHTML('beforeend', btn.dataset.addRow === 'experience' ? experienceRow() : educationRow());
    }));
  }

  function collectRows(type) {
    return [...detailsBody.querySelectorAll(`[data-row="${type}"]`)].map(row => {
      const extra = JSON.parse(row.dataset.extra || '{}');
      const data = { ...extra };
      row.querySelectorAll('[data-f]').forEach(inp => { data[inp.dataset.f] = inp.value.trim() || null; });
      if (type === 'education' && data.end_year) data.end_year = parseInt(data.end_year, 10) || null;
      if (type === 'experience') {
        data.is_current = /present/i.test(data.end_date || '');
        data.duration_months = monthsBetween(data.start_date, data.end_date);
      }
      return data;
    }).filter(d => Object.values(d).some(v => v && (typeof v !== 'object' || (Array.isArray(v) && v.length))));
  }

  function monthsBetween(start, end) {
    const parse = s => {
      if (!s) return null;
      if (/present/i.test(s)) { const n = new Date(); return n.getFullYear() * 12 + n.getMonth(); }
      const m = s.match(/^(\d{4})(?:-(\d{1,2}))?$/);
      return m ? +m[1] * 12 + (m[2] ? +m[2] - 1 : 0) : null;
    };
    const a = parse(start);
    const b = parse(end);
    return a !== null && b !== null && b >= a ? b - a + 1 : null;
  }

  /* ---------------- Modal ---------------- */

  async function openDetails(id) {
    state.blind = false;
    $('blindToggle').checked = false;
    state.tab = 'overview';
    await loadDetails(id);
    detailsModal.classList.add('active');
  }

  async function loadDetails(id) {
    const res = await ResumeAPI.getResume(id, state.blind);
    if (!res.success) return showToast(res.message || 'Could not load resume', 'error');
    state.current = res.data;
    renderDetails();
  }

  function renderDetails() {
    const r = state.current;
    $('detailsTitle').textContent = r.parsed.contact.name || 'Unknown candidate';
    $('detailsSubtitle').textContent = `${r.id} · ${r.original_filename} · ${r.status}${r.manually_corrected ? ' · corrected by recruiter' : ''}`;
    document.querySelectorAll('.detail-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === state.tab);
      t.disabled = state.blind && t.dataset.tab === 'edit';
    });
    const dl = $('btnDownload');
    dl.style.display = r.has_original_file && !state.blind ? '' : 'none';
    dl.href = `/api/resumes/${encodeURIComponent(r.id)}/file`;
    $('btnSave').style.display = state.tab === 'edit' ? '' : 'none';

    if (state.tab === 'overview') detailsBody.innerHTML = renderOverview(r);
    else if (state.tab === 'raw') detailsBody.innerHTML = `<pre class="raw-text">${escapeHtml(r.parsed.raw_text || '')}</pre>`;
    else if (state.tab === 'json') {
      const copy = { ...r.parsed };
      delete copy.raw_text;
      detailsBody.innerHTML = `<p class="form-help">This structured output is the contract consumed by F5 (match scoring), F6 (ranking) and F7 (blind screening).</p><pre class="raw-text">${escapeHtml(JSON.stringify(copy, null, 2))}</pre>`;
    } else if (state.tab === 'edit') {
      detailsBody.innerHTML = renderEditForm(r);
      bindEditForm();
    }
    detailsBody.scrollTop = 0;
  }

  function setupModal() {
    const close = () => detailsModal.classList.remove('active');
    $('btnCloseDetails').addEventListener('click', close);
    detailsModal.addEventListener('click', e => { if (e.target === detailsModal) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    detailsBody.addEventListener('click', e => {
      const row = e.target.matches('[data-remove-row]') && e.target.closest('.edit-row');
      if (row) row.remove();
    });

    document.querySelectorAll('.detail-tab').forEach(t => t.addEventListener('click', () => {
      state.tab = t.dataset.tab;
      renderDetails();
    }));

    $('blindToggle').addEventListener('change', async e => {
      state.blind = e.target.checked;
      if (state.blind && state.tab === 'edit') state.tab = 'overview';
      await loadDetails(state.current.id);
    });

    $('btnSave').addEventListener('click', async () => {
      const id = state.current.id;
      const payload = {
        contact: {
          name: $('editName').value,
          email: $('editEmail').value,
          phone: $('editPhone').value,
          location: $('editLocation').value,
          linkedin: $('editLinkedin').value,
          github: $('editGithub').value,
          portfolio: $('editPortfolio').value
        },
        summary: $('editSummary').value,
        total_experience_years: $('editYears').value,
        job_posting_id: $('editJob').value || null,
        skills: state.editSkills,
        experience: collectRows('experience'),
        education: collectRows('education')
      };
      const res = await ResumeAPI.updateResume(id, payload);
      if (!res.success) return showToast(res.message, 'error');
      showToast('Corrections saved — resume marked as Verified', 'success');
      state.current = res.data;
      state.tab = 'overview';
      renderDetails();
      refresh();
    });

    $('btnReparse').addEventListener('click', async () => {
      if (state.current.manually_corrected && !confirm('Re-parsing will discard the recruiter corrections. Continue?')) return;
      const res = await ResumeAPI.reparse(state.current.id);
      if (!res.success) return showToast(res.message, 'error');
      showToast('Resume re-parsed', 'success');
      await loadDetails(state.current.id);
      refresh();
    });

    $('btnDelete').addEventListener('click', async () => {
      if (!confirm(`Delete ${state.current.id}? The parsed data and the uploaded file will be removed.`)) return;
      const res = await ResumeAPI.deleteResume(state.current.id);
      if (!res.success) return showToast(res.message, 'error');
      showToast('Resume deleted', 'success');
      close();
      refresh();
    });
  }

  /* ---------------- Upload ---------------- */

  function setupUpload() {
    document.querySelectorAll('.upload-tab').forEach(tab => tab.addEventListener('click', () => {
      state.mode = tab.dataset.mode;
      document.querySelectorAll('.upload-tab').forEach(t => t.classList.toggle('active', t === tab));
      $('fileMode').style.display = state.mode === 'file' ? '' : 'none';
      $('textMode').style.display = state.mode === 'text' ? '' : 'none';
      updateParseButton();
    }));

    fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
    ['dragenter', 'dragover'].forEach(ev => dropZone.addEventListener(ev, e => {
      e.preventDefault();
      dropZone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(ev => dropZone.addEventListener(ev, e => {
      e.preventDefault();
      dropZone.classList.remove('dragging');
    }));
    dropZone.addEventListener('drop', e => selectFile(e.dataTransfer.files[0]));
    resumeText.addEventListener('input', updateParseButton);
    btnParse.addEventListener('click', parse);
  }

  function selectFile(file) {
    if (!file) return;
    const ok = /\.(pdf|docx|txt)$/i.test(file.name);
    if (!ok) {
      showToast(/\.doc$/i.test(file.name) ? 'Old .doc files are not supported — save as .docx or .pdf' : 'Only PDF, DOCX or TXT files are allowed', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File is larger than 5 MB', 'error');
      return;
    }
    state.file = file;
    $('selectedFile').textContent = `Selected: ${file.name} (${Math.ceil(file.size / 1024)} KB)`;
    updateParseButton();
  }

  function updateParseButton() {
    btnParse.disabled = state.mode === 'file' ? !state.file : resumeText.value.trim().length < 50;
  }

  async function parse() {
    btnParse.disabled = true;
    $('btnParseLabel').textContent = 'Parsing…';
    try {
      const job = $('uploadJob').value;
      const res = state.mode === 'file'
        ? await ResumeAPI.uploadResume(state.file, job)
        : await ResumeAPI.parseText(resumeText.value, job);
      if (!res.success) {
        showToast(res.message || 'Parsing failed', 'error');
        return;
      }
      showToast(res.message, res.data.status === 'Needs Review' ? 'warning' : 'success');
      state.file = null;
      fileInput.value = '';
      $('selectedFile').textContent = '';
      resumeText.value = '';
      await refresh();
      await openDetails(res.data.id);
    } catch (e) {
      console.error(e);
      showToast('Network error while parsing', 'error');
    } finally {
      $('btnParseLabel').textContent = 'Parse Resume';
      updateParseButton();
    }
  }

  /* ---------------- Filters ---------------- */

  function setupFilters() {
    let t;
    $('searchInput').addEventListener('input', e => {
      clearTimeout(t);
      t = setTimeout(() => { state.filters.search = e.target.value; loadResumes(); }, 250);
    });
    $('statusFilter').addEventListener('change', e => { state.filters.status = e.target.value; loadResumes(); });
    $('jobFilter').addEventListener('change', e => { state.filters.job_posting_id = e.target.value; loadResumes(); });
    $('expFilter').addEventListener('change', e => { state.filters.min_experience = e.target.value; loadResumes(); });
  }

  /* ---------------- Utils ---------------- */

  function formatMonths(m) {
    const y = Math.floor(m / 12);
    const mo = m % 12;
    return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', mo ? `${mo} mo` : ''].filter(Boolean).join(' ');
  }

  function escapeHtml(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const escapeAttr = escapeHtml;

  function showToast(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> <span>${escapeHtml(message)}</span>`;
    $('toastContainer').appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
});
