/**
 * HireIQ — F4 Resume Parsing & Data Extraction
 * Automated verification suite
 *
 * Run: node test/test_f4.js
 * The suite backs up data/resumes.json and data/job_postings.json and
 * restores them at the end, and
 * removes every file it uploads, so it leaves the repository unchanged.
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
process.env.NODE_ENV = 'test';
const fs = require('fs');
const path = require('path');
const http = require('http');

// Starting the server auto-closes expired postings (F2), which rewrites
// data/job_postings.json, so it is backed up before the server is loaded.
const POSTINGS_FILE = path.join(__dirname, '..', 'data', 'job_postings.json');
const postingsBackup = fs.readFileSync(POSTINGS_FILE);

const app = require('../server');
const { parseResume, toBlindProfile } = require('../services/resumeParser');

const PORT = 3457;
const FIXTURES = path.join(__dirname, 'fixtures');
const RESUMES_FILE = path.join(__dirname, '..', 'data', 'resumes.json');
const NOW = new Date('2026-11-15T00:00:00Z');

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function request(method, urlPath, { json, multipart } = {}) {
  return new Promise((resolve, reject) => {
    let body = null;
    const headers = {};
    if (json !== undefined) {
      body = Buffer.from(JSON.stringify(json));
      headers['Content-Type'] = 'application/json';
    } else if (multipart) {
      const boundary = `----hireiqF4${Date.now()}`;
      const parts = [];
      for (const [key, value] of Object.entries(multipart.fields || {})) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
      }
      if (multipart.file) {
        parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${multipart.file.field || 'resume'}"; filename="${multipart.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
        parts.push(multipart.file.buffer);
        parts.push(Buffer.from('\r\n'));
      }
      parts.push(Buffer.from(`--${boundary}--\r\n`));
      body = Buffer.concat(parts);
      headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    }
    if (body) headers['Content-Length'] = body.length;

    const req = http.request({ hostname: 'localhost', port: PORT, path: urlPath, method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let parsed = null;
        try { parsed = JSON.parse(raw.toString()); } catch (e) { /* binary download */ }
        resolve({ status: res.statusCode, body: parsed, raw, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const fixture = name => fs.readFileSync(path.join(FIXTURES, name));

/* ------------------------------------------------------------------ */
/* 1. Parser unit tests                                                */
/* ------------------------------------------------------------------ */
function parserUnitTests() {
  console.log('\n[1] Parser engine (unit tests)');
  const text = fixture('resume_software_engineer.txt').toString('utf-8');
  const r = parseResume(text, { now: NOW });

  // Contact
  check('Name extracted and title-cased from ALL CAPS', r.contact.name === 'Nadia Rahman', r.contact.name);
  check('Email extracted', r.contact.email === 'nadia.rahman.dev@example.com', r.contact.email);
  check('Bangladeshi phone normalised to +880 format', r.contact.phone === '+8801712345678', r.contact.phone);
  check('LinkedIn URL detected', r.contact.linkedin === 'https://linkedin.com/in/nadia-rahman-dev', r.contact.linkedin);
  check('GitHub URL detected', r.contact.github === 'https://github.com/nadiarahman', r.contact.github);
  check('Portfolio detected (and email domain not mistaken for a URL)', r.contact.portfolio === 'https://nadiarahman.vercel.app', r.contact.portfolio);
  check('Location detected', /Dhaka/.test(r.contact.location || ''), r.contact.location);

  // Skills
  const names = r.skills.map(s => s.name);
  check('Aliases normalised to canonical skills (Node.js, Express.js)', names.includes('Node.js') && names.includes('Express.js'));
  check('Skills found outside the Skills section (PostgreSQL in experience)', r.skills.some(s => s.name === 'PostgreSQL' && !s.in_skills_section));
  check('Skills listed in Skills section get higher confidence', r.skills.find(s => s.name === 'TypeScript').confidence > r.skills.find(s => s.name === 'MongoDB').confidence);
  check('Unknown skill kept for review (Postman)', r.unrecognized_skills.includes('Postman'));
  check('match_input.skill_names mirrors skills for F5', r.match_input.skill_names.length === r.skills.length);

  // Education
  const bsc = r.education.find(e => e.degree === 'B.Sc.');
  check('Degree + field extracted', bsc && bsc.field === 'Computer Science and Engineering', JSON.stringify(bsc));
  check('Institution extracted', bsc && bsc.institution === 'BRAC University');
  check('CGPA and scale extracted', bsc && bsc.grade && bsc.grade.value === 3.62 && bsc.grade.scale === 4);
  check('HSC entry extracted with GPA 5.00 scale', r.education.some(e => e.degree === 'HSC' && e.grade && e.grade.scale === 5));
  check('Highest education is the Bachelors degree', r.highest_education && r.highest_education.level === 'Bachelors');

  // Experience
  check('Three roles extracted', r.experience.length === 3, String(r.experience.length));
  const first = r.experience[0];
  check('Title vs company classified correctly ("Title | Company | dates")', first.title === 'Software Engineer' && first.company === 'Brain Station 23 Ltd', `${first.title} / ${first.company}`);
  check('"Present" end date handled', first.is_current && first.end_date === 'Present');
  check('Role duration computed in months', r.experience[1].duration_months === 19, String(r.experience[1].duration_months));
  check('Bullet descriptions attached to the right role', first.description.length === 3);
  check('Total experience computed (years)', r.total_experience_years === 6.8, String(r.total_experience_years));

  // Overlapping periods are not double counted
  const overlap = parseResume([
    'Test Person', 'test@example.com', '', 'EXPERIENCE',
    'Developer | Alpha Ltd | Jan 2020 - Dec 2020',
    'Part-time Tutor | Beta Academy | Jun 2020 - Jun 2021'
  ].join('\n'), { now: NOW });
  check('Overlapping jobs merged when totalling experience', overlap.total_experience_years === 1.5, String(overlap.total_experience_years));

  // Sections
  check('Sections detected', ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'].every(s => r.sections_detected.includes(s)));
  check('Certifications listed', r.certifications.length === 2);
  check('Languages with proficiency', r.languages.some(l => l.language === 'English' && l.proficiency === 'Fluent'));

  // Privacy / bias
  const serialised = JSON.stringify({ ...r, raw_text: '', match_input: { ...r.match_input } });
  check('Protected attributes not extracted into fields', !/Islam|Single|1998/.test(serialised.replace(/"raw_text":"[^"]*"/, '')));
  check('Protected attributes removed from F5 keyword text', !/religion|marital|father/i.test(r.match_input.keywords_text));
  check('Warning raised about personal attributes', r.warnings.some(w => /personal attributes/.test(w)));

  const blind = toBlindProfile(r);
  check('Blind profile hides contact details', blind.contact.name === 'Candidate (hidden)' && !blind.contact.email && !blind.contact.phone);
  check('Blind raw text redacts name, email, phone and surname', !/Nadia|Rahman|example\.com|1712/.test(blind.raw_text));
  check('Blind raw text drops date of birth / religion lines', !/Date of Birth|Religion/.test(blind.raw_text));
  check('Blind profile keeps skills and experience', blind.skills.length === r.skills.length && blind.experience.length === 3);

  // Low quality input
  const weak = parseResume('just some words without structure', { now: NOW });
  check('Low-quality text gets low confidence', weak.confidence.overall < 0.6, String(weak.confidence.overall));
  check('Low-quality text produces warnings', weak.warnings.length >= 4);
}

/* ------------------------------------------------------------------ */
/* 2. API / integration tests                                          */
/* ------------------------------------------------------------------ */
async function apiTests() {
  console.log('\n[2] REST API /api/resumes (integration tests)');
  const created = [];

  const health = await request('GET', '/api/health');
  check('Health endpoint lists F4', health.body.features.some(f => f.startsWith('F4')));

  const taxonomy = await request('GET', '/api/resumes/skills/taxonomy');
  check('Skill taxonomy endpoint', taxonomy.status === 200 && taxonomy.body.count > 50);

  // Upload all three formats
  const uploads = [
    ['resume_software_engineer.txt', 'Nadia Rahman', 'JOB-1001'],
    ['resume_ui_designer.docx', 'Farhan Hossain Chowdhury', 'JOB-1002'],
    ['resume_ml_engineer.pdf', 'Imran Kabir', 'JOB-1003']
  ];
  for (const [file, expectedName, job] of uploads) {
    const res = await request('POST', '/api/resumes/upload', {
      multipart: { fields: { job_posting_id: job }, file: { name: file, buffer: fixture(file) } }
    });
    const ok = res.status === 201 && res.body.data.parsed.contact.name === expectedName;
    check(`Upload + parse ${path.extname(file).toUpperCase().slice(1)} (${file})`, ok, res.body && (res.body.message || JSON.stringify(res.body.data && res.body.data.parsed.contact)));
    if (res.body && res.body.data) created.push(res.body.data.id);
  }
  const [txtId, docxId, pdfId] = created;

  const docx = (await request('GET', `/api/resumes/${docxId}`)).body.data;
  check('DOCX: bullets kept so both role descriptions are complete', docx.parsed.experience[0].description.length === 2);
  check('DOCX: "MM/YYYY to MM/YYYY" date format parsed', docx.parsed.experience[1].start_date === '2020-02');
  const pdf = (await request('GET', `/api/resumes/${pdfId}`)).body.data;
  check('PDF: international phone kept with country code', pdf.parsed.contact.phone === '+14155550199', pdf.parsed.contact.phone);
  check('PDF: Masters is highest education', pdf.parsed.highest_education.level === 'Masters');
  check('Stored record never exposes server file path', docx.stored_path === undefined && docx.has_original_file === true);

  // Validation
  const badType = await request('POST', '/api/resumes/upload', { multipart: { file: { name: 'photo.png', buffer: Buffer.from('x') } } });
  check('Rejects unsupported file type (400)', badType.status === 400);
  const legacyDoc = await request('POST', '/api/resumes/upload', { multipart: { file: { name: 'old.doc', buffer: Buffer.from('x') } } });
  check('Rejects legacy .doc with a clear message', legacyDoc.status === 400);
  const noFile = await request('POST', '/api/resumes/upload', { multipart: { fields: { job_posting_id: 'JOB-1001' } } });
  check('Rejects request without a file (400)', noFile.status === 400);
  const tooBig = await request('POST', '/api/resumes/upload', { multipart: { file: { name: 'big.txt', buffer: Buffer.alloc(5 * 1024 * 1024 + 10, 'a') } } });
  check('Rejects files over 5 MB (400)', tooBig.status === 400, tooBig.body && tooBig.body.message);
  const corrupt = await request('POST', '/api/resumes/upload', { multipart: { file: { name: 'broken.pdf', buffer: Buffer.from('not really a pdf') } } });
  check('Corrupt PDF returns 422 with message', corrupt.status === 422);
  const badJob = await request('POST', '/api/resumes/parse-text', { json: { text: fixture('resume_software_engineer.txt').toString(), job_posting_id: 'JOB-9999' } });
  check('Rejects unknown job posting id (400)', badJob.status === 400);
  const shortText = await request('POST', '/api/resumes/parse-text', { json: { text: 'too short' } });
  check('Rejects too-short pasted text (400)', shortText.status === 400);

  // Paste text → low confidence → Needs Review
  const weak = await request('POST', '/api/resumes/parse-text', {
    json: { text: 'I am looking for a job in your company. I can work hard and learn new things quickly. Thank you for reading.' }
  });
  check('Weak resume is flagged "Needs Review"', weak.status === 201 && weak.body.data.status === 'Needs Review');
  if (weak.body && weak.body.data) created.push(weak.body.data.id);

  // Filters
  const bySkill = await request('GET', '/api/resumes?skill=pytorch');
  check('Filter by skill', bySkill.body.data.some(r => r.id === pdfId) && !bySkill.body.data.some(r => r.id === docxId));
  const byStatus = await request('GET', '/api/resumes?status=Needs%20Review');
  check('Filter by status', byStatus.body.data.every(r => r.status === 'Needs Review'));
  const byJob = await request('GET', '/api/resumes?job_posting_id=JOB-1002');
  check('Filter by job posting', byJob.body.data.every(r => r.job_posting_id === 'JOB-1002'));
  const byExp = await request('GET', '/api/resumes?min_experience=7');
  check('Filter by minimum experience', byExp.body.data.every(r => r.total_experience_years >= 7));
  const search = await request('GET', '/api/resumes?search=brac');
  check('Search across education/experience', search.body.data.some(r => r.id === txtId));
  check('List view omits raw text', search.body.data.every(r => r.parsed === undefined));

  // Blind view (F7 integration point)
  const blind = await request('GET', `/api/resumes/${txtId}?view=blind`);
  check('Blind view hides identity', blind.body.data.parsed.contact.email === null && blind.body.data.original_filename === 'hidden');

  // Recruiter corrections
  const update = await request('PUT', `/api/resumes/${txtId}`, {
    json: { contact: { phone: '+8801700000000' }, skills: ['Node.js', 'kubernetes', 'Postman'] }
  });
  const upd = update.body.data;
  check('Corrections saved and marked Verified', update.status === 200 && upd.status === 'Verified' && upd.manually_corrected);
  check('Corrected phone stored', upd.parsed.contact.phone === '+8801700000000');
  check('Added skill alias normalised (kubernetes → Kubernetes)', upd.parsed.skills.some(s => s.name === 'Kubernetes' && s.category === 'DevOps & Cloud'));
  check('Unknown added skill kept as "Other"', upd.parsed.skills.some(s => s.name === 'Postman' && s.category === 'Other'));
  check('match_input updated after correction', upd.parsed.match_input.skill_names.join(',') === 'Node.js,Kubernetes,Postman');
  const badEmail = await request('PUT', `/api/resumes/${txtId}`, { json: { contact: { email: 'not-an-email' } } });
  check('Rejects invalid email correction (400)', badEmail.status === 400);
  const badStatus = await request('PUT', `/api/resumes/${txtId}`, { json: { status: 'Hired' } });
  check('Rejects invalid status (400)', badStatus.status === 400);

  // Re-parse restores parser output
  const reparse = await request('POST', `/api/resumes/${txtId}/reparse`);
  check('Re-parse restores original extraction', reparse.status === 200 && reparse.body.data.parsed.contact.phone === '+8801712345678' && !reparse.body.data.manually_corrected);

  // Original file download
  const download = await request('GET', `/api/resumes/${pdfId}/file`);
  check('Original file downloadable', download.status === 200 && download.raw.slice(0, 4).toString() === '%PDF');

  // Metrics
  const metrics = await request('GET', '/api/resumes/metrics');
  check('Metrics include totals and top skills', metrics.status === 200 && metrics.body.data.total >= 4 && metrics.body.data.top_skills.length > 0);

  // Delete
  for (const id of created) {
    const stored = JSON.parse(fs.readFileSync(RESUMES_FILE, 'utf-8')).find(r => r.id === id);
    const res = await request('DELETE', `/api/resumes/${id}`);
    const fileGone = !stored.stored_path || !fs.existsSync(path.join(__dirname, '..', stored.stored_path));
    check(`Delete ${id} removes record and uploaded file`, res.status === 200 && fileGone);
  }
  const gone = await request('GET', `/api/resumes/${txtId}`);
  check('Deleted resume returns 404', gone.status === 404);
  const unknownApi = await request('GET', '/api/does-not-exist');
  check('Unknown API route returns JSON 404', unknownApi.status === 404 && unknownApi.body && unknownApi.body.success === false);
}

/* ------------------------------------------------------------------ */
async function run() {
  console.log('--- HireIQ F4: Resume Parsing & Data Extraction — Verification Suite ---');
  const backup = fs.existsSync(RESUMES_FILE) ? fs.readFileSync(RESUMES_FILE) : null;
  const server = app.listen(PORT);

  try {
    parserUnitTests();
    await apiTests();
  } catch (err) {
    failed++;
    console.error('\n✗ Suite crashed:', err);
  } finally {
    server.close();
    if (backup) fs.writeFileSync(RESUMES_FILE, backup);
    fs.writeFileSync(POSTINGS_FILE, postingsBackup);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();
