/**
 * F4: Resume Parsing & Data Extraction
 * Resume Parser Service (NLP / information-extraction engine)
 *
 * Turns the plain text of a resume into structured candidate data:
 *   - contact details (name, email, phone, links, location)
 *   - skills, normalized against data/skills_taxonomy.json
 *   - education history (degree, field, institution, years, CGPA)
 *   - work experience (title, company, dates, duration, description)
 *   - summary, projects, certifications, languages
 *
 * Technique: rule-based information extraction — section segmentation,
 * pattern matching (regular expressions), dictionary/gazetteer lookup for
 * skills, and keyword heuristics for entity classification. Every field
 * carries a confidence score so recruiters can review weak extractions.
 *
 * The output schema (PARSER_SCHEMA_VERSION) is the contract consumed by
 * F5 (AI Job-Match Scoring), F6 (Ranking), F7 (Blind Screening) and
 * F15 (Talent Pool Re-Matching). Change it only with the team's agreement.
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
const fs = require('fs');
const path = require('path');

const PARSER_VERSION = '1.0.0';
const PARSER_SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Dictionaries                                                        */
/* ------------------------------------------------------------------ */

const TAXONOMY_PATH = path.join(__dirname, '..', 'data', 'skills_taxonomy.json');

let taxonomyCache = null;
function loadTaxonomy() {
  if (taxonomyCache) return taxonomyCache;
  const raw = JSON.parse(fs.readFileSync(TAXONOMY_PATH, 'utf-8'));
  taxonomyCache = raw.map(skill => ({
    ...skill,
    patterns: [
      ...(skill.aliases || []).map(a => buildAliasRegex(a, false)),
      ...(skill.case_sensitive_aliases || []).map(a => buildAliasRegex(a, true))
    ]
  }));
  return taxonomyCache;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Custom word boundaries so aliases like "c++", "c#", ".net" and "ci/cd" work.
function buildAliasRegex(alias, caseSensitive) {
  const body = escapeRegex(alias).replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^A-Za-z0-9])${body}(?=$|[^A-Za-z0-9+#])`, caseSensitive ? 'g' : 'gi');
}

// Canonical section names and the headings that introduce them.
const SECTION_HEADINGS = {
  summary: ['summary', 'professional summary', 'career summary', 'profile', 'professional profile', 'about me', 'career objective', 'objective', 'personal statement'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'employment', 'work history', 'career history', 'relevant experience', 'internships', 'internship experience'],
  education: ['education', 'educational background', 'academic background', 'academic qualifications', 'educational qualifications', 'academic qualification', 'educational qualification', 'academics'],
  skills: ['skills', 'technical skills', 'core skills', 'key skills', 'skills & tools', 'skills and tools', 'core competencies', 'competencies', 'technical proficiency', 'technologies', 'tools & technologies', 'expertise'],
  projects: ['projects', 'academic projects', 'personal projects', 'key projects', 'project experience', 'selected projects'],
  certifications: ['certifications', 'certificates', 'certification', 'licenses & certifications', 'licenses and certifications', 'courses', 'trainings', 'training', 'training & certifications'],
  languages: ['languages', 'language proficiency', 'language skills'],
  awards: ['awards', 'achievements', 'honors', 'honours', 'awards & achievements', 'honors & awards', 'accomplishments'],
  activities: ['extracurricular activities', 'activities', 'leadership', 'volunteer experience', 'volunteering', 'co-curricular activities'],
  personal: ['personal information', 'personal details', 'personal info', 'personal data'],
  references: ['references', 'reference'],
  contact: ['contact', 'contact information', 'contact details'],
  interests: ['interests', 'hobbies', 'hobbies & interests']
};

const HEADING_LOOKUP = {};
for (const [section, headings] of Object.entries(SECTION_HEADINGS)) {
  for (const h of headings) HEADING_LOOKUP[h] = section;
}

const DEGREE_PATTERNS = [
  { re: /\b(ph\.?\s?d|doctor of philosophy|doctorate)\b/i, level: 'Doctorate', label: 'PhD' },
  { re: /\b(m\.?\s?sc|m\.?\s?s\b|master of science)/i, level: 'Masters', label: 'M.Sc.' },
  { re: /\b(m\.?\s?tech|master of technology)\b/i, level: 'Masters', label: 'M.Tech' },
  { re: /\b(mba|master of business administration)\b/i, level: 'Masters', label: 'MBA' },
  { re: /\b(m\.?\s?a\.?|master of arts)\b(?!\w)/, level: 'Masters', label: 'M.A.' },
  { re: /\b(mfa|master of fine arts)\b/i, level: 'Masters', label: 'MFA' },
  { re: /\bmasters?\b/i, level: 'Masters', label: 'Masters' },
  { re: /\b(mbbs)\b/i, level: 'Bachelors', label: 'MBBS' },
  { re: /\b(bfa|bachelor of fine arts)\b/i, level: 'Bachelors', label: 'BFA' },
  { re: /\b(llb|bachelor of laws)\b/i, level: 'Bachelors', label: 'LLB' },
  { re: /\b(b\.?\s?pharm|bachelor of pharmacy)\b/i, level: 'Bachelors', label: 'B.Pharm' },
  { re: /\b(b\.?\s?sc|bachelor of science)/i, level: 'Bachelors', label: 'B.Sc.' },
  { re: /\b(b\.?\s?tech|bachelor of technology)\b/i, level: 'Bachelors', label: 'B.Tech' },
  { re: /\b(b\.?\s?e\.?|bachelor of engineering)\b(?!\w)/, level: 'Bachelors', label: 'B.E.' },
  { re: /\b(bba|bachelor of business administration)\b/i, level: 'Bachelors', label: 'BBA' },
  { re: /\b(b\.?\s?a\.?|bachelor of arts)\b(?!\w)/, level: 'Bachelors', label: 'B.A.' },
  { re: /\b(b\.?\s?com|bachelor of commerce)\b/i, level: 'Bachelors', label: 'B.Com' },
  { re: /\bbachelors?\b/i, level: 'Bachelors', label: 'Bachelors' },
  { re: /\bdiploma\b/i, level: 'Diploma', label: 'Diploma' },
  { re: /\b(hsc|higher secondary certificate|higher secondary)\b/i, level: 'Higher Secondary', label: 'HSC' },
  { re: /\ba[\s-]?levels?\b/i, level: 'Higher Secondary', label: 'A Level' },
  { re: /\b(ssc|secondary school certificate)\b/i, level: 'Secondary', label: 'SSC' },
  { re: /\bo[\s-]?levels?\b/i, level: 'Secondary', label: 'O Level' }
];

const DEGREE_RANK = { Doctorate: 6, Masters: 5, Bachelors: 4, Diploma: 3, 'Higher Secondary': 2, Secondary: 1 };

const INSTITUTION_RE = /\b(university|college|institute|institution|school|academy|polytechnic|madrasa|madrasah)\b/i;

const JOB_TITLE_RE = /\b(engineer|developer|programmer|intern|internship|manager|analyst|designer|lead|director|officer|executive|assistant|consultant|specialist|architect|administrator|coordinator|head|associate|tester|scientist|researcher|teacher|lecturer|instructor|tutor|freelancer|founder|co-founder|ceo|cto|representative|trainee|technician|accountant|writer|editor|marketer|volunteer|president|secretary|member|ambassador)\b/i;

const COMPANY_RE = /\b(ltd|limited|inc|llc|llp|corp|corporation|company|co\.|technologies|technology|tech|solutions|systems|software|labs|studio|group|bank|agency|bd|bangladesh|international|global|services|digital|consulting|ventures|foundation|ngo|upwork|fiverr|freelance|self-employed|university|club)\b/i;

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};

const MONTH_NAMES = 'jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?';
const DATE_TOKEN = `(?:(?:${MONTH_NAMES})\\.?,?\\s*\\d{4}|\\d{1,2}[\\/.-]\\d{4}|\\d{4})`;
const END_TOKEN = `(?:${DATE_TOKEN}|present|current|now|ongoing|till date|to date|running)`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to|until|till)\\s*(${END_TOKEN})`, 'i');

const LOCATION_GAZETTEER = [
  'Dhaka', 'Chattogram', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet', 'Barishal', 'Barisal', 'Rangpur',
  'Mymensingh', 'Comilla', 'Cumilla', 'Gazipur', 'Narayanganj', 'Bogura', 'Bogra', 'Savar', 'Cox\'s Bazar',
  'Gulshan', 'Banani', 'Dhanmondi', 'Mirpur', 'Uttara', 'Mohakhali', 'Badda', 'Bashundhara', 'Motijheel',
  'Bangladesh', 'India', 'Pakistan', 'Nepal', 'Singapore', 'Malaysia', 'United States', 'USA',
  'United Kingdom', 'UK', 'Canada', 'Australia', 'Germany', 'Dubai', 'UAE', 'London', 'New York', 'Toronto', 'Remote'
];

// Lines that carry protected / bias-prone personal attributes. They are
// never extracted into structured fields and are removed from blind views.
const SENSITIVE_LINE_RE = /^\s*(gender|sex|date of birth|dob|birth ?date|age|marital status|religion|nationality|blood group|father'?s name|mother'?s name|spouse|national id|nid|passport)\b\s*[:\-–]/i;

/* ------------------------------------------------------------------ */
/* Text helpers                                                        */
/* ------------------------------------------------------------------ */

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/ /g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(l => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripBullet(line) {
  return line.replace(/^\s*(?:[•●▪■◦○◆♦➢➤►▶✓✔*·\-–—]|\d+[.)])\s*/, '').trim();
}

// A line that reads like a description sentence rather than a job header.
function looksLikeDescription(line) {
  return isBullet(line) || line.length > 80 || /[.;]$/.test(line) || line.split(/\s+/).length > 8;
}

function isBullet(line) {
  return /^\s*(?:[•●▪■◦○◆♦➢➤►▶✓✔*·\-–—])\s+/.test(line);
}

function titleCase(str) {
  return str.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

function round(n, digits = 2) {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/* ------------------------------------------------------------------ */
/* Section segmentation                                                */
/* ------------------------------------------------------------------ */

function detectHeading(line) {
  const cleaned = line
    .replace(/[:|_=•●▪#*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned || cleaned.length > 40) return null;
  return HEADING_LOOKUP[cleaned] || null;
}

/**
 * Splits resume lines into sections. Lines before the first recognised
 * heading are the "header" (usually name and contact details).
 */
function segmentSections(lines) {
  const sections = { header: [] };
  let current = 'header';
  for (const line of lines) {
    const heading = detectHeading(line);
    if (heading) {
      current = heading;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

/* ------------------------------------------------------------------ */
/* Contact extraction                                                  */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s,;|)]*)?/gi;

function extractEmail(text) {
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

function normalizePhone(raw) {
  const hasPlus = raw.trim().startsWith('+');
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return null;
  // Bangladesh mobile numbers: 01XXXXXXXXX or 8801XXXXXXXXX
  if (/^01[3-9]\d{8}$/.test(digits)) return `+880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return `+${digits}`;
  return hasPlus ? `+${digits}` : digits;
}

function extractPhone(text) {
  const candidates = text.match(PHONE_RE) || [];
  for (const raw of candidates) {
    // Skip things that are clearly year ranges such as "2019 - 2023"
    if (/^\s*(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\s*$/.test(raw)) continue;
    const phone = normalizePhone(raw);
    if (phone) return phone;
  }
  return null;
}

const LINK_TLD_RE = /\.(com|io|dev|me|app|net|org|co|bd|xyz|site|page|info|tech|ai|edu|gov)(?:\.[a-z]{2})?(?=\/|$)/i;

function extractLinks(text) {
  const links = { linkedin: null, github: null, portfolio: null, other: [] };
  // Remove email addresses first so "name.surname.dev@x.com" is not read as a URL
  const cleanedLines = text.replace(new RegExp(EMAIL_RE.source, 'g'), ' ').split('\n');
  const matches = [];
  cleanedLines.forEach((line, i) => {
    for (const m of line.match(URL_RE) || []) matches.push({ raw: m, inHeader: i < 15 });
  });

  for (const { raw, inHeader } of matches) {
    let url = raw.replace(/[.)]+$/, '');
    const lower = url.toLowerCase();
    const host = lower.replace(/^https?:\/\//, '').split('/')[0];
    const hasProtocolOrWww = /^(https?:\/\/|www\.)/.test(lower);
    const isProfile = /(linkedin|github)\.com\//.test(lower);
    // Accept only things that look like real web addresses. Below the
    // contact block, bare domains (e.g. "DeepLearning.AI" in a course
    // name) are ignored unless written as a full link.
    if (!hasProtocolOrWww && !LINK_TLD_RE.test(host)) continue;
    if (!inHeader && !hasProtocolOrWww && !isProfile) continue;
    if (/^(node|next|vue|react|express|asp)\.(js|net)$/i.test(host)) continue;
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    if (lower.includes('linkedin.com')) {
      links.linkedin = links.linkedin || url;
    } else if (lower.includes('github.com')) {
      links.github = links.github || url;
    } else if (!links.portfolio) {
      links.portfolio = url;
    } else if (!links.other.includes(url) && url !== links.portfolio) {
      links.other.push(url);
    }
  }
  return links;
}

function extractName(headerLines, allLines) {
  const candidates = (headerLines.length ? headerLines : allLines).slice(0, 6);
  for (const raw of candidates) {
    let line = raw.replace(/^(name|full name)\s*[:\-–]\s*/i, '').trim();
    if (!line || line.length > 50) continue;
    if (EMAIL_RE.test(line) || /\d/.test(line) || /https?:|www\.|\.com/i.test(line)) continue;
    if (/^(curriculum vitae|resume|cv|bio[- ]?data)$/i.test(line)) continue;
    if (detectHeading(line)) continue;
    if (JOB_TITLE_RE.test(line) && line.split(/\s+/).length > 2) continue;
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 5) continue;
    if (!words.every(w => /^[A-Za-z][A-Za-z.'-]*$/.test(w))) continue;
    // Names are written with capitals ("Nadia Rahman" or "NADIA RAHMAN")
    if (!words.every(w => /^[A-Z]/.test(w))) continue;
    const isAllCaps = line === line.toUpperCase();
    return {
      value: isAllCaps ? titleCase(line) : line,
      confidence: headerLines.length ? 0.9 : 0.75
    };
  }
  return { value: null, confidence: 0 };
}

function extractLocation(lines) {
  // 1) explicit label
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/^(?:address|location|present address|city)\s*[:\-–]\s*(.+)$/i);
    if (m) return m[1].trim().slice(0, 80);
  }
  // 2) gazetteer lookup in the top of the resume
  for (const line of lines.slice(0, 10)) {
    for (const place of LOCATION_GAZETTEER) {
      const re = new RegExp(`(^|[^A-Za-z])${escapeRegex(place)}(?![A-Za-z])`);
      if (re.test(line)) {
        const parts = line.split(/\s*[|•·]\s*/);
        const part = parts.find(p => re.test(p)) || line;
        if (!EMAIL_RE.test(part) && part.length <= 60) return part.trim();
        return place;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Skill extraction                                                    */
/* ------------------------------------------------------------------ */

function extractSkills(text, sections) {
  const taxonomy = loadTaxonomy();
  const skillsSectionText = (sections.skills || []).join('\n');
  const found = [];

  for (const skill of taxonomy) {
    let mentions = 0;
    for (const re of skill.patterns) {
      re.lastIndex = 0;
      const matches = text.match(re);
      if (matches) mentions += matches.length;
    }
    if (mentions === 0) continue;

    let inSkillsSection = false;
    for (const re of skill.patterns) {
      re.lastIndex = 0;
      if (re.test(skillsSectionText)) { inSkillsSection = true; break; }
    }

    // Confidence: listed in a Skills section is strong evidence; repeated
    // mentions elsewhere (projects, experience) add support.
    const confidence = Math.min(1, (inSkillsSection ? 0.7 : 0.4) + 0.1 * (mentions - 1));
    found.push({
      name: skill.name,
      category: skill.category,
      mentions,
      in_skills_section: inSkillsSection,
      confidence: round(confidence)
    });
  }

  found.sort((a, b) => b.confidence - a.confidence || b.mentions - a.mentions || a.name.localeCompare(b.name));

  // Items in the Skills section that are not in the taxonomy are kept as
  // "unrecognized" so recruiters can review them and the taxonomy can grow.
  const known = new Set();
  for (const s of found) {
    const def = taxonomy.find(t => t.name === s.name);
    known.add(s.name.toLowerCase());
    (def.aliases || []).forEach(a => known.add(a.toLowerCase()));
    (def.case_sensitive_aliases || []).forEach(a => known.add(a.toLowerCase()));
  }
  const unrecognized = [];
  for (const line of sections.skills || []) {
    const body = stripBullet(line).replace(/^[^:]{2,30}:\s*/, '');
    for (let item of body.split(/\s*[,;|•·\/]\s*/)) {
      item = item.replace(/[()]/g, '').trim();
      if (!item || item.length < 2 || item.length > 30 || /^\d+$/.test(item)) continue;
      if (!known.has(item.toLowerCase()) && !unrecognized.some(u => u.toLowerCase() === item.toLowerCase())) {
        unrecognized.push(item);
      }
    }
  }

  return { skills: found, unrecognized_skills: unrecognized.slice(0, 30) };
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

function parseDateToken(token, now) {
  if (!token) return null;
  const t = token.trim().toLowerCase().replace(/\.|,/g, ' ').replace(/\s+/g, ' ');
  if (/^(present|current|now|ongoing|till date|to date|running)$/.test(t)) {
    return { year: now.getFullYear(), month: now.getMonth(), is_present: true };
  }
  let m = t.match(/^([a-z]+)\s*(\d{4})$/);
  if (m && MONTHS[m[1]] !== undefined) return { year: +m[2], month: MONTHS[m[1]], is_present: false };
  m = t.match(/^(\d{1,2})[\/.-](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return { year: +m[2], month: +m[1] - 1, is_present: false };
  m = t.match(/^(\d{4})$/);
  if (m) return { year: +m[1], month: null, is_present: false };
  return null;
}

function formatDate(d) {
  if (!d) return null;
  if (d.is_present) return 'Present';
  if (d.month === null) return String(d.year);
  return `${d.year}-${String(d.month + 1).padStart(2, '0')}`;
}

function monthsBetween(start, end) {
  if (!start || !end) return null;
  const sm = start.month === null ? 0 : start.month;
  const em = end.month === null ? (end.is_present ? end.month : 11) : end.month;
  const months = (end.year - start.year) * 12 + (em - sm) + 1;
  return months > 0 && months < 12 * 60 ? months : null;
}

/* ------------------------------------------------------------------ */
/* Education extraction                                                */
/* ------------------------------------------------------------------ */

function detectDegree(line) {
  for (const d of DEGREE_PATTERNS) {
    if (d.re.test(line)) return d;
  }
  return null;
}

function extractField(line) {
  const m = line.match(/\b(?:in|of)\s+((?:[A-Z][A-Za-z&]*|and|&|of)(?:\s+(?:[A-Z][A-Za-z&]*|and|&|of))*)/);
  if (m) {
    const field = m[1].replace(/\s+(and|of|&)$/i, '').trim();
    if (!/^(Science|Arts|Engineering|Business Administration|Commerce|Technology|Philosophy)$/i.test(field)) return field;
    // "Bachelor of Science in Computer Science" -> look for a second "in"
    const second = line.match(/\bin\s+([A-Z][A-Za-z&]*(?:\s+(?:[A-Z][A-Za-z&]*|and|&|of))*)/);
    if (second) return second[1].replace(/\s+(and|of|&)$/i, '').trim();
  }
  const groupMatch = line.match(/\((science|commerce|arts|humanities|business studies)\)|\b(science|commerce|arts|humanities|business studies)\s+group\b/i);
  if (groupMatch) return titleCase(groupMatch[1] || groupMatch[2]);
  const shortField = line.match(/\b(?:cse|eee|ece|bba|ete|me|ce|ipe|cs)\b/i);
  if (shortField) return shortField[0].toUpperCase();
  return null;
}

function extractGrade(text) {
  let m = text.match(/\b(?:c?gpa|grade point average|result)\s*[:\-–]?\s*(\d(?:\.\d{1,2})?)\s*(?:\/|out of)\s*(\d(?:\.\d{1,2})?)/i);
  if (m) return { value: parseFloat(m[1]), scale: parseFloat(m[2]) };
  m = text.match(/\b(?:c?gpa|grade point average)\s*[:\-–]?\s*(\d(?:\.\d{1,2})?)/i);
  if (m) {
    const v = parseFloat(m[1]);
    return { value: v, scale: v > 4 ? 5 : 4 };
  }
  m = text.match(/(\d(?:\.\d{1,2})?)\s*\/\s*(4|5)(?:\.0+)?\b/);
  if (m) return { value: parseFloat(m[1]), scale: parseFloat(m[2]) };
  return null;
}

function extractEducation(sections, now) {
  const lines = sections.education && sections.education.length
    ? sections.education
    : (sections.header || []).concat(...Object.values(sections)).filter(l => detectDegree(l));
  const entries = [];
  let current = null;

  const pushCurrent = () => {
    if (current && (current.degree || current.institution)) entries.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = stripBullet(rawLine);
    if (!line) continue;
    const degree = detectDegree(line);
    const hasInstitution = INSTITUTION_RE.test(line);

    if (degree && current && current.degree) pushCurrent();
    if (hasInstitution && !degree && current && current.institution && current.degree) pushCurrent();
    if (!current) {
      current = { degree: null, level: null, field: null, institution: null, start_year: null, end_year: null, grade: null, is_current: false };
    }

    if (degree && !current.degree) {
      current.degree = degree.label;
      current.level = degree.level;
      current.field = extractField(line);
    }
    if (hasInstitution && !current.institution) {
      const segs = line.split(/\s*[,|–—]\s*|\s+-\s+/);
      const inst = segs.find(s => INSTITUTION_RE.test(s)) || line;
      current.institution = inst.replace(DATE_RANGE_RE, '').replace(/\b(19|20)\d{2}\b/g, '').replace(/[()]/g, '').trim();
    }

    const range = line.match(DATE_RANGE_RE);
    if (range) {
      const s = parseDateToken(range[1], now);
      const e = parseDateToken(range[2], now);
      current.start_year = s ? s.year : current.start_year;
      current.end_year = e ? (e.is_present ? null : e.year) : current.end_year;
      current.is_current = Boolean(e && e.is_present);
    } else {
      const years = line.match(/\b(19[5-9]\d|20[0-4]\d)\b/g);
      if (years && !current.end_year) {
        if (years.length >= 2) {
          current.start_year = +years[0];
          current.end_year = +years[years.length - 1];
        } else {
          current.end_year = +years[0];
        }
      }
      if (/\b(expected|ongoing|present|current|running)\b/i.test(line)) current.is_current = true;
    }

    const grade = extractGrade(line);
    if (grade && !current.grade) current.grade = grade;
  }
  pushCurrent();

  return entries.filter(e => e.degree || e.institution).slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Experience extraction                                               */
/* ------------------------------------------------------------------ */

const STRONG_COMPANY_RE = /\b(ltd|limited|inc|llc|llp|plc|pvt|corp|corporation|gmbh)\b\.?/i;

function segmentScores(seg) {
  const titleHits = (seg.match(new RegExp(JOB_TITLE_RE.source, 'gi')) || []).length;
  const companyHits = (seg.match(new RegExp(COMPANY_RE.source, 'gi')) || []).length;
  return {
    title: titleHits * 2,
    company: companyHits + (STRONG_COMPANY_RE.test(seg) ? 3 : 0)
  };
}

function classifyHeaderSegments(segments) {
  const scored = segments.map(seg => ({ seg, ...segmentScores(seg) }));
  const isLocation = s => LOCATION_GAZETTEER.some(p => new RegExp(`^${escapeRegex(p)}$`, 'i').test(s.trim()))
    || /^[A-Z][a-z]+,\s*[A-Z][a-z]+$/.test(s.trim()) && LOCATION_GAZETTEER.some(p => s.includes(p));

  let title = null;
  let company = null;
  const byTitle = scored.filter(x => x.title > x.company).sort((a, b) => (b.title - b.company) - (a.title - a.company));
  if (byTitle.length) title = byTitle[0].seg;
  const byCompany = scored.filter(x => x.seg !== title && x.company > x.title).sort((a, b) => (b.company - b.title) - (a.company - a.title));
  if (byCompany.length) company = byCompany[0].seg;

  const location = segments.find(s => s !== title && s !== company && isLocation(s)) || null;
  const rest = segments.filter(s => s !== title && s !== company && s !== location);
  if (!title && rest.length) title = rest.shift();
  if (!company && rest.length) company = rest.shift();
  return { title, company, location };
}

function splitHeader(text) {
  return text
    .split(/\s+(?:at|@)\s+|\s*[|–—•·]\s*|\s+-\s+|,\s+(?=[A-Z])/)
    .map(s => s.replace(/[()]/g, '').trim())
    .filter(s => s && s.length > 1);
}

function extractExperience(sections, now) {
  const lines = (sections.experience || []).filter(Boolean);
  const dateIdx = [];
  lines.forEach((l, i) => { if (DATE_RANGE_RE.test(l)) dateIdx.push(i); });
  if (!dateIdx.length) return [];

  const entries = [];
  let consumedUntil = -1;

  dateIdx.forEach((idx, n) => {
    const line = lines[idx];
    const range = line.match(DATE_RANGE_RE);
    const start = parseDateToken(range[1], now);
    const end = parseDateToken(range[2], now);

    // Header = text on the date line (minus the dates) + preceding
    // non-bullet lines that have not been claimed by the previous entry.
    const headerParts = [];
    const sameLine = line.replace(range[0], '').replace(/[()|,–—-]+\s*$/, '').trim();
    let lookback = 0;
    for (let j = idx - 1; j > consumedUntil && lookback < 2; j--) {
      if (looksLikeDescription(lines[j]) || DATE_RANGE_RE.test(lines[j])) break;
      headerParts.unshift(lines[j]);
      lookback++;
    }
    if (sameLine) headerParts.push(sameLine);

    const segments = headerParts.flatMap(splitHeader);
    const { title, company, location } = classifyHeaderSegments(segments);

    // Description = lines after the date line until the next entry's header.
    const nextIdx = n + 1 < dateIdx.length ? dateIdx[n + 1] : lines.length;
    let descEnd = nextIdx;
    if (n + 1 < dateIdx.length) {
      // leave up to 2 header lines (non-bullets) for the next entry
      let k = nextIdx - 1;
      let reserved = 0;
      while (k > idx && reserved < 2 && !looksLikeDescription(lines[k])) {
        k--; reserved++;
      }
      descEnd = k + 1;
    }
    const description = lines.slice(idx + 1, descEnd).map(stripBullet).filter(Boolean);
    consumedUntil = descEnd - 1;

    entries.push({
      title: title || null,
      company: company || null,
      location,
      start_date: formatDate(start),
      end_date: formatDate(end),
      is_current: Boolean(end && end.is_present),
      duration_months: monthsBetween(start, end),
      description: description.slice(0, 12)
    });
  });

  return entries.slice(0, 15);
}

/**
 * Total experience in years, merging overlapping periods so two parallel
 * jobs are not counted twice.
 */
function computeTotalExperienceYears(experience) {
  const intervals = [];
  for (const e of experience) {
    if (!e.start_date || !e.duration_months) continue;
    const [y, m] = e.start_date.split('-').map(Number);
    const startIndex = y * 12 + (m ? m - 1 : 0);
    intervals.push([startIndex, startIndex + e.duration_months]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let total = 0;
  let curStart = null;
  let curEnd = null;
  for (const [s, e] of intervals) {
    if (curEnd === null || s > curEnd) {
      if (curEnd !== null) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else {
      curEnd = Math.max(curEnd, e);
    }
  }
  if (curEnd !== null) total += curEnd - curStart;
  return round(total / 12, 1);
}

/* ------------------------------------------------------------------ */
/* Simple list sections                                                */
/* ------------------------------------------------------------------ */

function listSection(lines, limit = 15) {
  return (lines || []).map(stripBullet).filter(l => l && l.length > 2).slice(0, limit);
}

function extractLanguages(lines) {
  const items = [];
  for (const line of lines || []) {
    for (const part of stripBullet(line).split(/\s*[,;|•·]\s*/)) {
      const m = part.match(/^([A-Za-z]+)(?:\s*[(:\-–]\s*([A-Za-z ]+)\)?)?/);
      if (m && m[1].length > 2) items.push({ language: titleCase(m[1]), proficiency: m[2] ? m[2].trim() : null });
    }
  }
  return items.slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* Main entry point                                                    */
/* ------------------------------------------------------------------ */

/**
 * Parse resume text into the structured F4 schema.
 * @param {string} rawText
 * @param {object} [options] { now: Date } - injectable clock for tests
 */
function parseResume(rawText, options = {}) {
  const now = options.now || new Date();
  const text = normalizeText(rawText);
  const lines = text.split('\n').filter(l => l.length);
  const sections = segmentSections(lines);
  const warnings = [];

  const contactText = lines.slice(0, 25).join('\n');
  const name = extractName(sections.header || [], lines);
  const email = extractEmail(contactText) || extractEmail(text);
  const phone = extractPhone(contactText.replace(EMAIL_RE, ' ')) || extractPhone(text.replace(new RegExp(EMAIL_RE.source, 'g'), ' '));
  const links = extractLinks(text);
  const location = extractLocation(lines);

  const { skills, unrecognized_skills } = extractSkills(text, sections);
  const education = extractEducation(sections, now);
  const experience = extractExperience(sections, now);
  const totalYears = computeTotalExperienceYears(experience);

  const summaryLines = sections.summary || [];
  const summary = summaryLines.length ? summaryLines.join(' ').slice(0, 800) : null;

  const highest = education.reduce((best, e) => {
    if (!e.level) return best;
    return !best || DEGREE_RANK[e.level] > DEGREE_RANK[best.level] ? e : best;
  }, null);

  // Warnings & confidence ------------------------------------------------
  if (text.length < 200) warnings.push('Very little text was extracted. The file may be a scanned image; ask the candidate for a text-based PDF or DOCX.');
  if (!name.value) warnings.push('Candidate name could not be identified.');
  if (!email) warnings.push('No email address found.');
  if (!phone) warnings.push('No phone number found.');
  if (!skills.length) warnings.push('No recognised skills found.');
  if (!education.length) warnings.push('No education entries found.');
  if (!sections.experience) warnings.push('No experience section found (may be a fresh graduate).');
  else if (!experience.length) warnings.push('Experience section found but no dated roles could be extracted.');
  if (lines.some(l => SENSITIVE_LINE_RE.test(l))) warnings.push('Resume contains personal attributes (e.g. date of birth, religion, marital status). These were not extracted and are hidden in blind view.');

  const fieldConfidence = {
    name: name.confidence,
    email: email ? 1 : 0,
    phone: phone ? 0.9 : 0,
    skills: skills.length ? Math.min(1, 0.4 + skills.length * 0.06) : 0,
    education: education.length ? (education.some(e => e.degree && e.institution) ? 0.9 : 0.6) : 0,
    experience: experience.length
      ? (experience.every(e => e.title && e.company) ? 0.9 : 0.65)
      : (sections.experience ? 0.3 : 0.7)
  };
  const weights = { name: 0.15, email: 0.15, phone: 0.1, skills: 0.25, education: 0.15, experience: 0.2 };
  let overall = 0;
  for (const k of Object.keys(weights)) overall += weights[k] * fieldConfidence[k];
  for (const k of Object.keys(fieldConfidence)) fieldConfidence[k] = round(fieldConfidence[k]);

  const sectionsDetected = Object.keys(sections).filter(s => s !== 'header' && sections[s].length);

  return {
    schema_version: PARSER_SCHEMA_VERSION,
    parser_version: PARSER_VERSION,
    contact: {
      name: name.value,
      email,
      phone,
      location,
      linkedin: links.linkedin,
      github: links.github,
      portfolio: links.portfolio,
      other_links: links.other.slice(0, 5)
    },
    summary,
    skills,
    unrecognized_skills,
    education,
    highest_education: highest ? { degree: highest.degree, level: highest.level, field: highest.field, institution: highest.institution } : null,
    experience,
    total_experience_years: totalYears,
    projects: listSection(sections.projects),
    certifications: listSection(sections.certifications),
    awards: listSection(sections.awards, 10),
    languages: extractLanguages(sections.languages),
    sections_detected: sectionsDetected,
    confidence: {
      overall: round(overall),
      fields: fieldConfidence
    },
    warnings,
    // Ready-made inputs for F5 (TF-IDF job matching)
    match_input: {
      skill_names: skills.map(s => s.name),
      keywords_text: buildKeywordsText(text)
    },
    stats: {
      characters: text.length,
      lines: lines.length
    },
    raw_text: text
  };
}

/** Lower-cased, sensitive-line-free text for TF-IDF vectorisation (F5). */
function buildKeywordsText(text) {
  return text
    .split('\n')
    .filter(l => !SENSITIVE_LINE_RE.test(l))
    .join(' ')
    .replace(new RegExp(EMAIL_RE.source, 'g'), ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Blind-screening view (consumed by F7): removes identity and protected
 * attributes from parsed data and from the raw text.
 */
function toBlindProfile(parsed) {
  if (!parsed) return null;
  const identifiers = [parsed.contact.name, parsed.contact.email, parsed.contact.phone,
    parsed.contact.linkedin, parsed.contact.github, parsed.contact.portfolio, ...(parsed.contact.other_links || [])]
    .filter(Boolean);

  let raw = (parsed.raw_text || '')
    .split('\n')
    .filter(l => !SENSITIVE_LINE_RE.test(l))
    .join('\n');
  for (const id of identifiers) {
    const bare = id.replace(/^https?:\/\//, '');
    raw = raw.split(id).join('[REDACTED]').split(bare).join('[REDACTED]');
  }
  // Name parts (e.g. surname alone) and any remaining contact patterns
  if (parsed.contact.name) {
    for (const part of parsed.contact.name.split(/\s+/).filter(p => p.length > 2)) {
      raw = raw.replace(new RegExp(`\\b${escapeRegex(part)}\\b`, 'gi'), '[REDACTED]');
    }
  }
  raw = raw
    .replace(new RegExp(EMAIL_RE.source, 'g'), '[REDACTED]')
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, m => (/^\s*(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}\s*$/.test(m) ? m : '[REDACTED]'))
    .replace(/\b(he|she|him|her|his|hers|mr|mrs|ms|miss)\b\.?/gi, '[REDACTED]');

  return {
    ...parsed,
    contact: {
      name: 'Candidate (hidden)',
      email: null,
      phone: null,
      location: null,
      linkedin: null,
      github: null,
      portfolio: null,
      other_links: []
    },
    raw_text: raw,
    blind: true
  };
}

module.exports = {
  parseResume,
  toBlindProfile,
  loadTaxonomy,
  PARSER_VERSION,
  PARSER_SCHEMA_VERSION,
  // exported for unit tests
  _internal: {
    normalizeText,
    segmentSections,
    extractPhone,
    extractEmail,
    extractLinks,
    parseDateToken,
    computeTotalExperienceYears
  }
};
