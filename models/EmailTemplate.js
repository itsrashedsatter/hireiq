const { readCollection, writeCollection } = require('../config/database');

class EmailTemplate {
  static getAll() {
    return readCollection('email_templates');
  }

  static getByKey(key) {
    const templates = this.getAll();
    return templates.find(t => t.key === key) || null;
  }

  static getById(id) {
    const templates = this.getAll();
    return templates.find(t => t.id === id) || null;
  }

  static update(key, data) {
    const templates = this.getAll();
    const index = templates.findIndex(t => t.key === key);
    if (index === -1) return null;

    if (data.subject !== undefined) {
      if (!data.subject || data.subject.trim() === '') {
        throw new Error('Email subject is required and cannot be empty.');
      }
      templates[index].subject = data.subject.trim();
    }

    if (data.body_html !== undefined) {
      if (!data.body_html || data.body_html.trim() === '') {
        throw new Error('Email body content is required and cannot be empty.');
      }
      templates[index].body_html = data.body_html;
    }

    templates[index].updated_at = new Date().toISOString();
    writeCollection('email_templates', templates);
    return templates[index];
  }

  /**
   * Replaces placeholders like {{candidate_name}} with provided data
   */
  static render(key, data = {}) {
    const template = this.getByKey(key);
    if (!template) {
      throw new Error(`Email template with key '${key}' not found.`);
    }

    let renderedSubject = template.subject;
    let renderedBody = template.body_html;

    // Default system fallbacks
    const mergedData = {
      company_name: 'HireIQ Systems',
      portal_url: 'https://hireiq.careers/status',
      ...data
    };

    // Replace all {{placeholder}} patterns
    for (const [k, val] of Object.entries(mergedData)) {
      const regex = new RegExp(`{{\\s*${k}\\s*}}`, 'g');
      const replacement = val !== undefined && val !== null ? String(val) : '';
      renderedSubject = renderedSubject.replace(regex, replacement);
      renderedBody = renderedBody.replace(regex, replacement);
    }

    return {
      template_id: template.id,
      template_key: template.key,
      name: template.name,
      category: template.category,
      subject: renderedSubject,
      body_html: renderedBody,
      placeholders: template.placeholders
    };
  }
}

module.exports = EmailTemplate;
