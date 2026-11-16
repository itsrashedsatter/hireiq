const { readCollection, writeCollection } = require('../config/database');

class EmailLog {
  static getAll(filters = {}) {
    let logs = readCollection('email_logs');

    if (filters.status && filters.status !== 'All') {
      logs = logs.filter(l => l.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.template_key && filters.template_key !== 'All') {
      logs = logs.filter(l => l.template_key === filters.template_key);
    }

    if (filters.search && filters.search.trim() !== '') {
      const q = filters.search.trim().toLowerCase();
      logs = logs.filter(l => 
        (l.recipient_email && l.recipient_email.toLowerCase().includes(q)) ||
        (l.recipient_name && l.recipient_name.toLowerCase().includes(q)) ||
        (l.subject && l.subject.toLowerCase().includes(q)) ||
        (l.id && l.id.toLowerCase().includes(q))
      );
    }

    // Sort newest first
    logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return logs;
  }

  static getById(id) {
    const logs = readCollection('email_logs');
    return logs.find(l => l.id === id) || null;
  }

  static create(data) {
    const logs = readCollection('email_logs');
    const newId = `EML-${1000 + logs.length + 1}`;
    const timestamp = new Date().toISOString();

    const newLog = {
      id: newId,
      template_key: data.template_key,
      recipient_email: data.recipient_email,
      recipient_name: data.recipient_name || '',
      subject: data.subject,
      body_html: data.body_html,
      status: data.status || 'Queued',
      attempts: data.attempts !== undefined ? data.attempts : 0,
      max_attempts: data.max_attempts || 3,
      error_message: data.error_message || null,
      sent_at: data.status === 'Sent' ? timestamp : null,
      created_at: timestamp,
      metadata: data.metadata || {}
    };

    logs.push(newLog);
    writeCollection('email_logs', logs);
    return newLog;
  }

  static update(id, updates) {
    const logs = readCollection('email_logs');
    const index = logs.findIndex(l => l.id === id);
    if (index === -1) return null;

    logs[index] = {
      ...logs[index],
      ...updates
    };

    writeCollection('email_logs', logs);
    return logs[index];
  }

  static updateStatus(id, status, errorMessage = null) {
    const logs = readCollection('email_logs');
    const index = logs.findIndex(l => l.id === id);
    if (index === -1) return null;

    const log = logs[index];
    log.status = status;
    log.error_message = errorMessage;
    if (status === 'Sent') {
      log.sent_at = new Date().toISOString();
      log.error_message = null;
    }

    writeCollection('email_logs', logs);
    return log;
  }

  static incrementAttempts(id) {
    const logs = readCollection('email_logs');
    const index = logs.findIndex(l => l.id === id);
    if (index === -1) return null;

    logs[index].attempts = (logs[index].attempts || 0) + 1;
    writeCollection('email_logs', logs);
    return logs[index];
  }

  static getMetrics() {
    const logs = readCollection('email_logs');
    const total = logs.length;
    let sent = 0;
    let failed = 0;
    let queued = 0;

    for (const l of logs) {
      if (l.status === 'Sent') sent++;
      else if (l.status === 'Failed') failed++;
      else if (l.status === 'Queued') queued++;
    }

    const rate = total > 0 ? Math.round((sent / total) * 100) : 100;

    return {
      total,
      sent,
      failed,
      queued,
      success_rate: `${rate}%`
    };
  }
}

module.exports = EmailLog;
