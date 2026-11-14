const express = require('express');
const cors = require('cors');
const path = require('path');
const jobPostingRoutes = require('./routes/jobPostingRoutes');
const requisitionRoutes = require('./routes/requisitionRoutes');
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

// System Health & Info
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    project: 'HireIQ',
    feature: 'F2: Job Posting Management',
    sprint: 'Sprint 1',
    author: 'Rashed Satter (24241101)'
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

// Fallback to frontend index
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` HireIQ Recruitment Platform Server is running!    `);
    console.log(` Course: CSE470 Software Engineering                `);
    console.log(` Feature F2: Job Posting Management (Sprint 1)      `);
    console.log(` Assigned To: Rashed Satter (ID: 24241101)          `);
    console.log(` Local URL: http://localhost:${PORT}                 `);
    console.log(`====================================================`);
  });
}

module.exports = app;
