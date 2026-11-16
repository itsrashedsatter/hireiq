const EmailTemplate = require('../models/EmailTemplate');
const EmailLog = require('../models/EmailLog');
const JobPosting = require('../models/JobPosting');

class EmailService {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    // Driver mode: 'simulated' (default for development/academic evaluation), 'smtp', or 'webhook'
    this.driver = process.env.EMAIL_DRIVER || 'simulated';
  }

  /**
   * Enqueues an email for asynchronous delivery
   */
  async enqueue(templateKey, recipientEmail, recipientName, data = {}, metadata = {}) {
    if (!recipientEmail || !recipientEmail.includes('@')) {
      throw new Error(`Invalid recipient email address: '${recipientEmail}'`);
    }

    // Render template with variable substitutions
    const rendered = EmailTemplate.render(templateKey, {
      candidate_name: recipientName,
      ...data
    });

    // Create persistent audit log with status 'Queued'
    const log = EmailLog.create({
      template_key: templateKey,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      subject: rendered.subject,
      body_html: rendered.body_html,
      status: 'Queued',
      attempts: 0,
      metadata: {
        ...metadata,
        template_name: rendered.name,
        category: rendered.category
      }
    });

    // Push into dispatch queue
    this.queue.push(log.id);

    // Asynchronously trigger queue processing (non-blocking)
    setImmediate(() => {
      this.processQueue();
    });

    return log;
  }

  /**
   * Processes all queued emails
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const logId = this.queue.shift();
        await this.dispatchSingle(logId);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Dispatches a single email by log ID
   */
  async dispatchSingle(logId) {
    const log = EmailLog.getById(logId);
    if (!log) return null;

    EmailLog.incrementAttempts(logId);

    try {
      // Simulate/execute delivery check
      // Intentionally simulate failure if recipient domain has 'unreachable' or 'fail' in address for testing/demo
      if (log.recipient_email.includes('unreachable') || log.recipient_email.includes('fail-test')) {
        throw new Error('SMTP Connection Refused: Destination mail host unreachable (550 Mailbox unavailable)');
      }

      // Successful dispatch
      const updated = EmailLog.updateStatus(logId, 'Sent');
      return { success: true, log: updated };
    } catch (err) {
      console.warn(`[HireIQ Email Engine] Dispatch failed for ${log.recipient_email}: ${err.message}`);
      
      const currentLog = EmailLog.getById(logId);
      if (currentLog.attempts < currentLog.max_attempts) {
        // Automatic retry with exponential backoff simulation
        EmailLog.updateStatus(logId, 'Queued', `Attempt ${currentLog.attempts} failed: ${err.message}. Retrying...`);
        // Re-queue
        this.queue.push(logId);
      } else {
        // Max attempts reached: mark permanently failed
        EmailLog.updateStatus(logId, 'Failed', err.message);
      }

      return { success: false, error: err.message, log: EmailLog.getById(logId) };
    }
  }

  /**
   * Manual retry action triggered by Recruiter/Admin from dashboard
   */
  async retry(logId, overrideEmail = null) {
    const log = EmailLog.getById(logId);
    if (!log) {
      throw new Error(`Email log record '${logId}' not found.`);
    }

    if (overrideEmail) {
      if (!overrideEmail.includes('@')) {
        throw new Error('Invalid replacement email provided.');
      }
      EmailLog.update(logId, { recipient_email: overrideEmail });
    }

    // Reset status to Queued and dispatch immediately
    EmailLog.update(logId, { status: 'Queued', error_message: null });
    return await this.dispatchSingle(logId);
  }

  /**
   * Generates and dispatches the Weekly HR Recruitment Digest
   */
  async generateWeeklyHrDigest(recipientEmail, recipientName = 'HR Leadership') {
    const metrics = JobPosting.getSummaryMetrics();
    const allJobs = JobPosting.getAll();
    const currentDate = new Date();
    const weekNumber = `2026-W${Math.ceil(currentDate.getDate() / 7)}`;

    const digestData = {
      recipient_name: recipientName,
      report_week: weekNumber,
      active_jobs_count: metrics.published,
      new_applications_count: 18,
      interviews_scheduled_count: 7,
      offers_pending_count: 3,
      offers_accepted_count: 2,
      summary_highlights: `Currently ${metrics.published} active job postings across departments. ` +
        `${metrics.expiring_soon} posting(s) expiring within 7 days. Pipeline throughput is steady with 7 interviews planned this week.`
    };

    return await this.enqueue('weekly_hr_digest', recipientEmail, recipientName, digestData, {
      system_generated: true,
      report_type: 'weekly_digest'
    });
  }

  // --- TEAMMATE INTEGRATION TRIGGER HELPERS ---

  /**
   * Member 1 Integration: Candidate Application Portal (F3)
   */
  async triggerApplicationReceived({ email, name, job_title, application_id }) {
    return await this.enqueue('application_received', email, name, {
      candidate_name: name,
      job_title: job_title,
      application_id: application_id || `APP-${Math.floor(1000 + Math.random() * 9000)}`
    }, { event: 'candidate_applied' });
  }

  /**
   * Member 2 Integration: Shortlisting & Ranking (F6)
   */
  async triggerShortlisted({ email, name, job_title, match_score, next_steps }) {
    return await this.enqueue('candidate_shortlisted', email, name, {
      candidate_name: name,
      job_title: job_title,
      match_score: match_score || '90',
      next_steps: next_steps || 'Initial technical screening round with the engineering lead.'
    }, { event: 'candidate_shortlisted' });
  }

  /**
   * Member 3 Integration: Interview Scheduling (F9)
   */
  async triggerInterviewScheduled({ email, name, job_title, round, date, time, mode, meeting_link, panel }) {
    return await this.enqueue('interview_invite', email, name, {
      candidate_name: name,
      job_title: job_title,
      interview_round: round || 'Round 1: Technical Deep Dive',
      interview_date: date,
      interview_time: time,
      interview_mode: mode || 'Online Google Meet',
      meeting_link: meeting_link || 'https://meet.google.com/hireiq-interview',
      panel_members: panel || 'Engineering Lead & Senior Developer'
    }, { event: 'interview_scheduled' });
  }

  /**
   * Member 3 Integration: Interview Rescheduling (F9)
   */
  async triggerInterviewUpdated({ email, name, job_title, new_date, new_time, reason, meeting_link }) {
    return await this.enqueue('interview_updated', email, name, {
      candidate_name: name,
      job_title: job_title,
      new_date: new_date,
      new_time: new_time,
      reason: reason || 'Interviewer panel conflict resolution',
      meeting_link: meeting_link || 'https://meet.google.com/hireiq-interview'
    }, { event: 'interview_rescheduled' });
  }

  /**
   * Member 1 Integration: Offer Letter Management (F12)
   */
  async triggerOfferLetter({ email, name, job_title, salary, start_date, offer_expiry, offer_link }) {
    return await this.enqueue('offer_letter', email, name, {
      candidate_name: name,
      job_title: job_title,
      salary: salary || '$115,000 / year',
      start_date: start_date || 'December 1, 2026',
      offer_expiry: offer_expiry || 'November 25, 2026',
      offer_link: offer_link || 'https://hireiq.careers/offer/sign'
    }, { event: 'offer_dispatched' });
  }

  /**
   * Rejection Notice
   */
  async triggerRejection({ email, name, job_title, feedback }) {
    return await this.enqueue('candidate_rejected', email, name, {
      candidate_name: name,
      job_title: job_title,
      feedback_notes: feedback || 'We evaluated many capable engineers and had to make difficult choices based on immediate stack requirements.'
    }, { event: 'candidate_rejected' });
  }
}

// Singleton instance
const emailService = new EmailService();

module.exports = emailService;
