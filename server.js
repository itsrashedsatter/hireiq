const express = require('express');
const cors = require('cors');
const path = require('path');
const jobPostingRoutes = require('./routes/jobPostingRoutes');
const requisitionRoutes = require('./routes/requisitionRoutes');
const emailRoutes = require('./routes/emailRoutes');
const JobPosting = require('./models/JobPosting');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend views
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/job-postings', jobPostingRoutes);
app.use('/api/requisitions', requisitionRoutes);
app.use('/api/email', emailRoutes);

// System Health & Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    project: 'HireIQ - AI-Powered Recruitment & ATS',
    sprint: 'Sprint 1',
    features: [
      { id: 'F2', name: 'Job Posting Management', author: 'Rashed Satter (24241101)' },
      { id: 'F13', name: 'Automated Email Notification Engine', author: 'Mehrab Arefin (22301510)' }
    ]
  });
});

// Periodic background check to auto-close postings past their deadline (every 60s)
setInterval(() => {
  try {
    JobPosting.checkAndCloseExpired();
  } catch (err) {
    console.error('Error during automatic deadline check:', err);
  }
}, 60 * 1000);

// Initial check on startup
JobPosting.checkAndCloseExpired();

// Serve Email Management UI explicitly
app.get('/email-manager', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'email-manager.html'));
});

// Fallback to frontend index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` HireIQ Recruitment Platform Server is running!    `);
    console.log(` Course: CSE470 Software Engineering (BRACU)        `);
    console.log(` Sprint 1 Features:                                 `);
    console.log(`  - F2: Job Posting Management (Rashed Satter)      `);
    console.log(`  - F13: Automated Email Engine (Mehrab Arefin)     `);
    console.log(` Local URL: http://localhost:${PORT}                 `);
    console.log(` Email Engine UI: http://localhost:${PORT}/email-manager.html`);
    console.log(`====================================================`);
  });
}

module.exports = app;
