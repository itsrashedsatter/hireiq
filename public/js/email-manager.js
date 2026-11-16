// HireIQ Automated Email Notification Engine (F13) - Frontend Controller
// Author: Mehrab Arefin (ID: 22301510) - CSE470 Sprint 1

let currentTemplates = [];
let activeEditKey = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadMetrics();
  loadTemplates();
  loadLogs();
  initEventHandlers();
});

// Toast notification helper
function showToast(message, duration = 3500) {
  const toast = document.getElementById('toast');
  toast.innerText = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

// Tab navigation
function initTabs() {
  const tabs = document.querySelectorAll('.subnav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.style.display = 'block';
    });
  });
}

// Fetch and display metrics
async function loadMetrics() {
  try {
    const res = await fetch('/api/email/metrics');
    const json = await res.json();
    if (json.success) {
      document.getElementById('metricTotal').innerText = json.data.total;
      document.getElementById('metricSuccessRate').innerText = json.data.success_rate;
      document.getElementById('metricQueued').innerText = json.data.queued;
      document.getElementById('metricFailed').innerText = json.data.failed;
    }
  } catch (err) {
    console.error('Failed to load email metrics:', err);
  }
}

// Load and render all 8 templates
async function loadTemplates() {
  const container = document.getElementById('templatesList');
  container.innerHTML = '<p style="color:#64748b;">Loading templates...</p>';

  try {
    const res = await fetch('/api/email/templates');
    const json = await res.json();
    if (json.success) {
      currentTemplates = json.data;
      renderTemplatesList(currentTemplates);
      populateTestTemplateDropdown(currentTemplates);
    }
  } catch (err) {
    container.innerHTML = `<p style="color:#ef4444;">Error loading templates: ${err.message}</p>`;
  }
}

function renderTemplatesList(templates) {
  const container = document.getElementById('templatesList');
  container.innerHTML = '';

  templates.forEach(tpl => {
    const card = document.createElement('div');
    card.className = 'template-card';

    const placeholdersHtml = tpl.placeholders.map(p => 
      `<span class="placeholder-chip">{{${p}}}</span>`
    ).join(' ');

    card.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
        <span style="font-size:12px; font-weight:700; background:#f1f5f9; color:#475569; padding:2px 8px; border-radius:4px;">${tpl.category}</span>
        <code style="font-size:12px; color:#2563eb;">${tpl.key}</code>
      </div>
      <h3 style="margin:0 0 8px 0; font-size:16px; color:#0f172a;">${tpl.name}</h3>
      <p style="margin:0 0 12px 0; font-size:13px; color:#475569; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
        <strong>Subject:</strong> ${escapeHtml(tpl.subject)}
      </p>
      <div style="margin-bottom:14px;">
        <span style="font-size:11px; color:#64748b; display:block; margin-bottom:4px;">Interpolated Placeholders:</span>
        <div style="max-height:46px; overflow-y:auto;">${placeholdersHtml}</div>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid #f1f5f9; padding-top:12px;">
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:13px;" onclick="openEditModal('${tpl.key}')">✏️ Edit & Preview</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function populateTestTemplateDropdown(templates) {
  const select = document.getElementById('testTemplateSelect');
  select.innerHTML = '';
  templates.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.key;
    opt.textContent = `${t.name} (${t.key})`;
    select.appendChild(opt);
  });
}

// Open Template Editor & Live Preview Modal
async function openEditModal(templateKey) {
  activeEditKey = templateKey;
  const tpl = currentTemplates.find(t => t.key === templateKey);
  if (!tpl) return;

  document.getElementById('modalTemplateTitle').innerText = `Edit Template: ${tpl.name}`;
  document.getElementById('editTemplateKey').value = tpl.key;
  document.getElementById('editTemplateSubject').value = tpl.subject;
  document.getElementById('editTemplateBody').value = tpl.body_html;

  // Render placeholder chips
  const chipsContainer = document.getElementById('placeholdersContainer');
  chipsContainer.innerHTML = '';
  tpl.placeholders.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'placeholder-chip';
    chip.innerText = `{{${p}}}`;
    chip.title = 'Click to insert into body';
    chip.onclick = () => {
      const textarea = document.getElementById('editTemplateBody');
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const insertText = `{{${p}}}`;
      textarea.value = text.substring(0, start) + insertText + text.substring(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertText.length;
      updateLivePreview();
    };
    chipsContainer.appendChild(chip);
  });

  document.getElementById('editTemplateModal').style.display = 'flex';
  updateLivePreview();
}

// Update live preview via API
async function updateLivePreview() {
  if (!activeEditKey) return;
  const bodyText = document.getElementById('editTemplateBody').value;
  const previewContainer = document.getElementById('livePreviewContainer');

  try {
    const res = await fetch(`/api/email/templates/${activeEditKey}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (json.success) {
      previewContainer.innerHTML = json.data.body_html;
    }
  } catch (err) {
    previewContainer.innerHTML = `<span style="color:#ef4444;">Preview error: ${err.message}</span>`;
  }
}

// Save template
async function saveTemplate() {
  if (!activeEditKey) return;
  const subject = document.getElementById('editTemplateSubject').value;
  const body_html = document.getElementById('editTemplateBody').value;

  try {
    const res = await fetch(`/api/email/templates/${activeEditKey}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body_html })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`✓ Template '${activeEditKey}' updated successfully!`);
      document.getElementById('editTemplateModal').style.display = 'none';
      await loadTemplates();
    } else {
      alert(`Error saving template: ${json.error}`);
    }
  } catch (err) {
    alert(`Failed to save template: ${err.message}`);
  }
}

// Load and filter audit logs
async function loadLogs() {
  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = '<tr><td colspan="8" style="padding:20px; text-align:center; color:#64748b;">Loading delivery logs...</td></tr>';

  const status = document.getElementById('logStatusFilter').value;
  const search = document.getElementById('logSearchInput').value;

  try {
    const params = new URLSearchParams();
    if (status !== 'All') params.append('status', status);
    if (search.trim() !== '') params.append('search', search.trim());

    const res = await fetch(`/api/email/logs?${params.toString()}`);
    const json = await res.json();

    if (json.success) {
      renderLogsTable(json.data);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding:20px; text-align:center; color:#ef4444;">Error loading logs: ${err.message}</td></tr>`;
  }
}

function renderLogsTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  tbody.innerHTML = '';

  if (logs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:24px; text-align:center; color:#64748b;">No delivery log records found matching criteria.</td></tr>';
    return;
  }

  logs.forEach(log => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid #f1f5f9';

    let badgeClass = 'status-queued';
    if (log.status === 'Sent') badgeClass = 'status-sent';
    else if (log.status === 'Failed') badgeClass = 'status-failed';

    const dispatchTime = log.sent_at 
      ? new Date(log.sent_at).toLocaleString() 
      : (log.created_at ? new Date(log.created_at).toLocaleString() : '--');

    const canRetry = log.status === 'Failed' || log.status === 'Queued';

    tr.innerHTML = `
      <td style="padding:12px 16px; font-family:monospace; font-weight:600; color:#2563eb;">${log.id}</td>
      <td style="padding:12px 16px;">
        <div style="font-weight:600; color:#0f172a;">${escapeHtml(log.recipient_name || 'Candidate')}</div>
        <div style="font-size:12px; color:#64748b;">${escapeHtml(log.recipient_email)}</div>
      </td>
      <td style="padding:12px 16px; max-width:240px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(log.subject)}">
        ${escapeHtml(log.subject)}
      </td>
      <td style="padding:12px 16px;">
        <span style="font-size:12px; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-family:monospace;">${log.template_key}</span>
      </td>
      <td style="padding:12px 16px;">
        <span class="status-badge ${badgeClass}">${log.status}</span>
      </td>
      <td style="padding:12px 16px; font-size:13px; color:#475569;">
        ${log.attempts} / ${log.max_attempts}
      </td>
      <td style="padding:12px 16px; font-size:12px; color:#64748b;">
        ${dispatchTime}
      </td>
      <td style="padding:12px 16px; text-align:right;">
        <div style="display:flex; justify-content:flex-end; gap:6px;">
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:12px;" onclick="viewLogDetails('${log.id}')">Inspect</button>
          ${canRetry ? `<button class="btn-retry" onclick="retryLog('${log.id}')">🔄 Retry</button>` : ''}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 1-Click Retry Handler
async function retryLog(logId) {
  try {
    showToast(`Retrying dispatch for ${logId}...`);
    const res = await fetch(`/api/email/logs/${logId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const json = await res.json();
    if (json.success) {
      showToast(`✓ Retry executed! Current status: ${json.data.log ? json.data.log.status : 'Processed'}`);
      await loadLogs();
      await loadMetrics();
    } else {
      alert(`Retry error: ${json.error}`);
    }
  } catch (err) {
    alert(`Failed to retry email: ${err.message}`);
  }
}

// View details modal
async function viewLogDetails(logId) {
  try {
    const res = await fetch(`/api/email/logs/${logId}`);
    const json = await res.json();
    if (!json.success) return;

    const log = json.data;
    document.getElementById('modalLogIdTitle').innerText = `Delivery Audit: ${log.id}`;
    
    let badgeClass = 'status-queued';
    if (log.status === 'Sent') badgeClass = 'status-sent';
    else if (log.status === 'Failed') badgeClass = 'status-failed';

    let errorBox = '';
    if (log.error_message) {
      errorBox = `
        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:12px; margin:14px 0; color:#b91c1c; font-size:13px;">
          <strong>Error Trace:</strong><br>${escapeHtml(log.error_message)}
        </div>
      `;
    }

    const contentHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-bottom:14px;">
        <div><strong>Recipient:</strong> ${escapeHtml(log.recipient_name)} &lt;${escapeHtml(log.recipient_email)}&gt;</div>
        <div><strong>Status:</strong> <span class="status-badge ${badgeClass}">${log.status}</span></div>
        <div><strong>Attempts:</strong> ${log.attempts} of ${log.max_attempts}</div>
        <div><strong>Trigger Key:</strong> <code>${log.template_key}</code></div>
      </div>
      <div style="margin-bottom:12px; font-size:14px;">
        <strong>Subject:</strong> ${escapeHtml(log.subject)}
      </div>
      ${errorBox}
      <div style="margin-top:14px;">
        <strong>Rendered HTML Message Body:</strong>
        <div class="preview-box" style="margin-top:6px;">${log.body_html}</div>
      </div>
    `;

    document.getElementById('logDetailsContent').innerHTML = contentHtml;

    const retryBtn = document.getElementById('btnModalRetryLog');
    if (log.status === 'Failed' || log.status === 'Queued') {
      retryBtn.style.display = 'inline-block';
      retryBtn.onclick = async () => {
        document.getElementById('viewLogModal').style.display = 'none';
        await retryLog(log.id);
      };
    } else {
      retryBtn.style.display = 'none';
    }

    document.getElementById('viewLogModal').style.display = 'flex';
  } catch (err) {
    alert(`Failed to load log details: ${err.message}`);
  }
}

// Global Event Handlers
function initEventHandlers() {
  // Modal closes
  document.getElementById('btnCloseEditModal').onclick = () => {
    document.getElementById('editTemplateModal').style.display = 'none';
  };
  document.getElementById('btnCancelEdit').onclick = () => {
    document.getElementById('editTemplateModal').style.display = 'none';
  };
  document.getElementById('btnSaveTemplate').onclick = saveTemplate;

  document.getElementById('btnCloseLogModal').onclick = () => {
    document.getElementById('viewLogModal').style.display = 'none';
  };
  document.getElementById('btnCloseLogModalBtn').onclick = () => {
    document.getElementById('viewLogModal').style.display = 'none';
  };

  // Live typing preview update
  document.getElementById('editTemplateBody').addEventListener('input', () => {
    document.getElementById('livePreviewContainer').innerHTML = document.getElementById('editTemplateBody').value;
  });

  // Filter logs
  document.getElementById('logStatusFilter').onchange = loadLogs;
  document.getElementById('logSearchInput').onkeyup = (e) => {
    if (e.key === 'Enter') loadLogs();
  };
  document.getElementById('btnRefreshLogs').onclick = () => {
    loadLogs();
    loadMetrics();
    showToast('Logs refreshed.');
  };

  // Test Modal
  document.getElementById('btnOpenTestModal').onclick = () => {
    document.getElementById('testSendModal').style.display = 'flex';
  };
  document.getElementById('btnCloseTestModal').onclick = () => {
    document.getElementById('testSendModal').style.display = 'none';
  };
  document.getElementById('btnCancelTest').onclick = () => {
    document.getElementById('testSendModal').style.display = 'none';
  };

  document.getElementById('btnConfirmSendTest').onclick = async () => {
    const templateKey = document.getElementById('testTemplateSelect').value;
    const recipientEmail = document.getElementById('testRecipientEmail').value;
    const recipientName = document.getElementById('testRecipientName').value;

    try {
      const res = await fetch('/api/email/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_key: templateKey,
          recipient_email: recipientEmail,
          recipient_name: recipientName
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`✓ Test email queued for ${recipientEmail}!`);
        document.getElementById('testSendModal').style.display = 'none';
        await loadLogs();
        await loadMetrics();
      } else {
        alert(`Failed to queue test email: ${json.error}`);
      }
    } catch (err) {
      alert(`Error sending test email: ${err.message}`);
    }
  };

  // Trigger Weekly Digest
  document.getElementById('btnTriggerDigest').onclick = async () => {
    if (!confirm('Are you sure you want to compile and broadcast the Weekly HR Recruitment Digest now?')) return;
    try {
      showToast('Generating Weekly HR Digest...');
      const res = await fetch('/api/email/weekly-digest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (json.success) {
        showToast('✓ Weekly HR Digest compiled and dispatched to HR management!');
        await loadLogs();
        await loadMetrics();
      } else {
        alert(`Error triggering digest: ${json.error}`);
      }
    } catch (err) {
      alert(`Failed to trigger digest: ${err.message}`);
    }
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
