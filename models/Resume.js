/**
 * F4: Resume Parsing & Data Extraction
 * Model: Resume
 *
 * Stores uploaded resumes and their parsed (structured) data in
 * data/resumes.json, and keeps the original files in uploads/resumes/.
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
const fs = require('fs');
const path = require('path');
const { readCollection, writeCollection } = require('../config/database');
const { extractText, getFileType } = require('../services/textExtractor');
const { parseResume, toBlindProfile, loadTaxonomy, PARSER_VERSION } = require('../services/resumeParser');

const COLLECTION = 'resumes';
const ROOT_DIR = path.join(__dirname, '..');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads', 'resumes');
const REVIEW_THRESHOLD = 0.6;
const VALID_STATUSES = ['Parsed', 'Needs Review', 'Verified'];

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function statusFromConfidence(parsed) {
  return parsed.confidence.overall >= REVIEW_THRESHOLD ? 'Parsed' : 'Needs Review';
}

/** List view: everything except the large raw text. */
function toSummary(record) {
  const p = record.parsed || {};
  return {
    id: record.id,
    candidate_name: p.contact ? p.contact.name : null,
    email: p.contact ? p.contact.email : null,
    original_filename: record.original_filename,
    file_type: record.file_type,
    job_posting_id: record.job_posting_id,
    status: record.status,
    confidence: p.confidence ? p.confidence.overall : 0,
    top_skills: (p.skills || []).slice(0, 6).map(s => s.name),
    skills_count: (p.skills || []).length,
    highest_education: p.highest_education || null,
    total_experience_years: p.total_experience_years || 0,
    warnings_count: (p.warnings || []).length,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

class Resume {
  static getAll() {
    return readCollection(COLLECTION);
  }

  static nextId(records) {
    const max = records.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace('RES-', ''), 10) || 1000), 1000);
    return `RES-${max + 1}`;
  }

  static findWithFilters({ search, skill, status, job_posting_id, min_experience } = {}) {
    let results = this.getAll();

    if (status && status !== 'All') {
      results = results.filter(r => r.status.toLowerCase() === status.toLowerCase());
    }
    if (job_posting_id && job_posting_id !== 'All') {
      results = results.filter(r => r.job_posting_id === job_posting_id);
    }
    if (skill && skill.trim() !== '') {
      const q = skill.trim().toLowerCase();
      results = results.filter(r => (r.parsed.skills || []).some(s => s.name.toLowerCase().includes(q)));
    }
    if (min_experience !== undefined && min_experience !== '' && !isNaN(parseFloat(min_experience))) {
      const min = parseFloat(min_experience);
      results = results.filter(r => (r.parsed.total_experience_years || 0) >= min);
    }
    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      results = results.filter(r => {
        const c = r.parsed.contact || {};
        const haystack = [
          c.name, c.email, c.location, r.original_filename,
          ...(r.parsed.skills || []).map(s => s.name),
          ...(r.parsed.education || []).map(e => `${e.degree} ${e.field} ${e.institution}`),
          ...(r.parsed.experience || []).map(e => `${e.title} ${e.company}`)
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
      });
    }

    results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return results.map(toSummary);
  }

  /**
   * @param {string} id
   * @param {{ blind?: boolean, includeRawText?: boolean }} options
   */
  static findById(id, { blind = false, includeRawText = true } = {}) {
    const record = this.getAll().find(r => r.id === id);
    if (!record) return null;
    let parsed = blind ? toBlindProfile(record.parsed) : record.parsed;
    if (!includeRawText) {
      parsed = { ...parsed };
      delete parsed.raw_text;
    }
    const result = { ...record, parsed };
    delete result.stored_path;
    if (blind) result.original_filename = 'hidden';
    result.has_original_file = Boolean(record.stored_path);
    return result;
  }

  static async createFromUpload({ buffer, originalname, size, job_posting_id }) {
    const { text, file_type, pages } = await extractText(buffer, originalname);
    const parsed = parseResume(text);

    const records = this.getAll();
    const id = this.nextId(records);
    ensureUploadDir();
    const storedName = `${id}${path.extname(originalname).toLowerCase()}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);

    return this.saveNew(records, {
      id,
      original_filename: originalname,
      file_type,
      file_size: size || buffer.length,
      pages,
      stored_path: path.posix.join('uploads', 'resumes', storedName),
      source: 'upload',
      job_posting_id,
      parsed
    });
  }

  static createFromText({ text, filename, job_posting_id }) {
    const parsed = parseResume(text);
    const records = this.getAll();
    return this.saveNew(records, {
      id: this.nextId(records),
      original_filename: filename || 'pasted-resume.txt',
      file_type: 'text',
      file_size: Buffer.byteLength(text, 'utf-8'),
      pages: null,
      stored_path: null,
      source: 'pasted_text',
      job_posting_id,
      parsed
    });
  }

  static saveNew(records, data) {
    const timestamp = new Date().toISOString();
    const record = {
      id: data.id,
      original_filename: data.original_filename,
      file_type: data.file_type,
      file_size: data.file_size,
      pages: data.pages,
      stored_path: data.stored_path,
      source: data.source,
      job_posting_id: data.job_posting_id || null,
      status: statusFromConfidence(data.parsed),
      manually_corrected: false,
      parser_version: PARSER_VERSION,
      parsed: data.parsed,
      created_at: timestamp,
      updated_at: timestamp
    };
    records.push(record);
    writeCollection(COLLECTION, records);
    return this.findById(record.id);
  }

  /** Re-run the parser on the stored original (e.g. after a parser upgrade). */
  static async reparse(id) {
    const records = this.getAll();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    const record = records[index];

    let text;
    if (record.stored_path) {
      const filePath = path.join(ROOT_DIR, record.stored_path);
      if (!fs.existsSync(filePath)) throw new Error('Original file is missing on the server; cannot re-parse.');
      ({ text } = await extractText(fs.readFileSync(filePath), filePath));
    } else {
      text = record.parsed.raw_text || '';
    }

    record.parsed = parseResume(text);
    record.status = statusFromConfidence(record.parsed);
    record.manually_corrected = false;
    record.parser_version = PARSER_VERSION;
    record.updated_at = new Date().toISOString();
    records[index] = record;
    writeCollection(COLLECTION, records);
    return this.findById(id);
  }

  /**
   * Recruiter corrections. Only the listed fields can be changed; the raw
   * text and parser metadata stay untouched. Saving marks it Verified
   * unless another status is given.
   */
  static updateParsed(id, changes) {
    const records = this.getAll();
    const index = records.findIndex(r => r.id === id);
    if (index === -1) return null;
    const record = records[index];
    const parsed = record.parsed;

    if (changes.contact && typeof changes.contact === 'object') {
      const allowed = ['name', 'email', 'phone', 'location', 'linkedin', 'github', 'portfolio'];
      for (const key of allowed) {
        if (changes.contact[key] !== undefined) {
          const v = changes.contact[key];
          parsed.contact[key] = v === '' || v === null ? null : String(v).trim();
        }
      }
    }
    if (changes.summary !== undefined) parsed.summary = changes.summary ? String(changes.summary) : null;

    if (Array.isArray(changes.skills)) {
      const taxonomy = loadTaxonomy();
      const existing = new Map((parsed.skills || []).map(s => [s.name.toLowerCase(), s]));
      const seen = new Set();
      parsed.skills = changes.skills
        .map(s => (typeof s === 'string' ? s : s && s.name) || '')
        .map(s => s.trim())
        .filter(s => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
        .map(name => {
          if (existing.has(name.toLowerCase())) return existing.get(name.toLowerCase());
          const def = taxonomy.find(t => t.name.toLowerCase() === name.toLowerCase()
            || (t.aliases || []).includes(name.toLowerCase()));
          return {
            name: def ? def.name : name,
            category: def ? def.category : 'Other',
            mentions: 0,
            in_skills_section: false,
            confidence: 1,
            added_by_recruiter: true
          };
        });
      parsed.match_input.skill_names = parsed.skills.map(s => s.name);
    }

    if (Array.isArray(changes.education)) parsed.education = changes.education;
    if (Array.isArray(changes.experience)) parsed.experience = changes.experience;
    if (changes.total_experience_years !== undefined && !isNaN(parseFloat(changes.total_experience_years))) {
      parsed.total_experience_years = parseFloat(changes.total_experience_years);
    }
    if (changes.job_posting_id !== undefined) record.job_posting_id = changes.job_posting_id || null;

    if (changes.status !== undefined) {
      if (!VALID_STATUSES.includes(changes.status)) {
        throw new Error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`);
      }
      record.status = changes.status;
    } else {
      record.status = 'Verified';
    }

    record.manually_corrected = true;
    record.updated_at = new Date().toISOString();
    records[index] = record;
    writeCollection(COLLECTION, records);
    return this.findById(id);
  }

  static getOriginalFilePath(id) {
    const record = this.getAll().find(r => r.id === id);
    if (!record || !record.stored_path) return null;
    const filePath = path.join(ROOT_DIR, record.stored_path);
    return fs.existsSync(filePath) ? { filePath, filename: record.original_filename } : null;
  }

  static delete(id) {
    const records = this.getAll();
    const record = records.find(r => r.id === id);
    if (!record) return false;

    // Only delete files we stored ourselves (never the seed fixtures)
    if (record.stored_path && record.stored_path.startsWith('uploads/')) {
      const filePath = path.join(ROOT_DIR, record.stored_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    writeCollection(COLLECTION, records.filter(r => r.id !== id));
    return true;
  }

  static getSummaryMetrics() {
    const records = this.getAll();
    const metrics = {
      total: records.length,
      parsed: 0,
      needs_review: 0,
      verified: 0,
      average_confidence: 0,
      top_skills: []
    };
    const skillCounts = {};
    let confSum = 0;
    for (const r of records) {
      if (r.status === 'Parsed') metrics.parsed++;
      else if (r.status === 'Needs Review') metrics.needs_review++;
      else if (r.status === 'Verified') metrics.verified++;
      confSum += r.parsed.confidence ? r.parsed.confidence.overall : 0;
      for (const s of r.parsed.skills || []) skillCounts[s.name] = (skillCounts[s.name] || 0) + 1;
    }
    metrics.average_confidence = records.length ? Math.round((confSum / records.length) * 100) / 100 : 0;
    metrics.top_skills = Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    return metrics;
  }

  static getSkillTaxonomy() {
    return loadTaxonomy().map(({ name, category }) => ({ name, category }));
  }
}

Resume.UPLOAD_DIR = UPLOAD_DIR;
Resume.VALID_STATUSES = VALID_STATUSES;
Resume.isSupportedFile = filename => Boolean(getFileType(filename));

module.exports = Resume;
