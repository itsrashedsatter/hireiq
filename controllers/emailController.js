const EmailTemplate = require('../models/EmailTemplate');
const EmailLog = require('../models/EmailLog');
const emailService = require('../services/emailService');

class EmailController {
  // GET /api/email/templates
  static getTemplates(req, res) {
    try {
      const templates = EmailTemplate.getAll();
      return res.json({
        success: true,
        count: templates.length,
        data: templates
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/email/templates/:key
  static getTemplateByKey(req, res) {
    try {
      const template = EmailTemplate.getByKey(req.params.key);
      if (!template) {
        return res.status(404).json({ success: false, error: 'Email template not found.' });
      }
      return res.json({ success: true, data: template });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // PUT /api/email/templates/:key
  static updateTemplate(req, res) {
    try {
      const { subject, body_html } = req.body;
      const updated = EmailTemplate.update(req.params.key, { subject, body_html });
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Email template not found.' });
      }
      return res.json({
        success: true,
        message: 'Template updated successfully.',
        data: updated
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /api/email/templates/:key/preview
  static previewTemplate(req, res) {
    try {
      const sampleData = req.body.sample_data || {
        candidate_name: 'Alex Mercer',
        job_title: 'Senior Software Engineer',
        company_name: 'HireIQ Tech',
        application_id: 'APP-7821',
        match_score: '88',
        next_steps: '30-minute culture interview on Zoom',
        interview_round: 'Technical Architecture Round',
        interview_date: 'November 25, 2026',
        interview_time: '2:30 PM - 3:30 PM (BST)',
        interview_mode: 'Google Meet',
        meeting_link: 'https://meet.google.com/xyz-demo-ats',
        panel_members: 'Dr. Jane Foster & Eng. Tariqul Islam',
        salary: '$120,000 / year',
        start_date: 'December 15, 2026',
        offer_expiry: 'December 1, 2026',
        offer_link: 'https://hireiq.careers/offer/sign',
        manager_name: 'Sadia Rahman',
        report_week: '2026-W47',
        active_jobs_count: 5,
        new_applications_count: 24,
        interviews_scheduled_count: 8,
        offers_pending_count: 4,
        offers_accepted_count: 3,
        summary_highlights: 'Healthy candidate throughput in Technical roles. All critical requisitions published on schedule.'
      };

      const rendered = EmailTemplate.render(req.params.key, sampleData);
      return res.json({ success: true, data: rendered });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // GET /api/email/logs
  static getLogs(req, res) {
    try {
      const { status, template_key, search } = req.query;
      const logs = EmailLog.getAll({ status, template_key, search });
      return res.json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/email/logs/:id
  static getLogById(req, res) {
    try {
      const log = EmailLog.getById(req.params.id);
      if (!log) {
        return res.status(404).json({ success: false, error: 'Email log not found.' });
      }
      return res.json({ success: true, data: log });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/email/logs/:id/retry
  static async retryEmail(req, res) {
    try {
      const { override_email } = req.body;
      const result = await emailService.retry(req.params.id, override_email);
      return res.json({
        success: true,
        message: 'Email retry attempt executed.',
        data: result
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /api/email/send-test
  static async sendTest(req, res) {
    try {
      const { template_key, recipient_email, recipient_name, template_data } = req.body;
      if (!template_key || !recipient_email) {
        return res.status(400).json({ success: false, error: 'Template key and recipient email are required.' });
      }

      const log = await emailService.enqueue(
        template_key,
        recipient_email,
        recipient_name || 'Test Recipient',
        template_data || {},
        { is_test_dispatch: true }
      );

      return res.status(201).json({
        success: true,
        message: 'Test email queued for delivery.',
        data: log
      });
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  // POST /api/email/weekly-digest
  static async triggerWeeklyDigest(req, res) {
    try {
      const { recipient_email, recipient_name } = req.body;
      const email = recipient_email || 'hr-team@hireiq.org';
      const name = recipient_name || 'HR Operations Team';

      const log = await emailService.generateWeeklyHrDigest(email, name);
      return res.json({
        success: true,
        message: 'Weekly HR Recruitment Digest generated and dispatched.',
        data: log
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/email/metrics
  static getMetrics(req, res) {
    try {
      const metrics = EmailLog.getMetrics();
      return res.json({ success: true, data: metrics });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = EmailController;
