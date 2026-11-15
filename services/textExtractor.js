/**
 * F4: Resume Parsing & Data Extraction
 * Text Extractor Service
 *
 * Converts an uploaded resume file (PDF, DOCX or TXT) into plain text
 * so the parser can work on one uniform input.
 *
 * Author: M M Tariqul Islam Siam (23101118)
 */
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');

const SUPPORTED_TYPES = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.txt': 'txt'
};

function getFileType(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return SUPPORTED_TYPES[ext] || null;
}

function htmlToText(html) {
  return html
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Extract raw text from a file buffer.
 * @param {Buffer} buffer   file contents
 * @param {string} filename original filename (used to detect type)
 * @returns {Promise<{ text: string, file_type: string, pages: number|null }>}
 */
async function extractText(buffer, filename) {
  const fileType = getFileType(filename);

  if (!fileType) {
    const ext = path.extname(filename || '').toLowerCase() || 'unknown';
    if (ext === '.doc') {
      throw new Error('Legacy .doc files are not supported. Please save the resume as .docx or .pdf.');
    }
    throw new Error(`Unsupported file type (${ext}). Allowed: PDF, DOCX, TXT.`);
  }

  if (fileType === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      // Remove the "-- 1 of 2 --" page markers the library inserts
      const text = (result.text || '').replace(/^\s*--\s*\d+\s+of\s+\d+\s*--\s*$/gm, '');
      return { text, file_type: 'pdf', pages: result.total || null };
    } catch (err) {
      throw new Error('Could not read the PDF. It may be corrupted or password protected.');
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  if (fileType === 'docx') {
    let result;
    try {
      // Convert to HTML (not raw text) so list items keep their bullet
      // markers, which the parser uses to tell headers from descriptions.
      result = await mammoth.convertToHtml({ buffer });
    } catch (err) {
      throw new Error('Could not read the DOCX file. It may be corrupted.');
    }
    return { text: htmlToText(result.value || ''), file_type: 'docx', pages: null };
  }

  return { text: buffer.toString('utf-8'), file_type: 'txt', pages: null };
}

module.exports = {
  extractText,
  getFileType,
  SUPPORTED_EXTENSIONS: Object.keys(SUPPORTED_TYPES)
};
