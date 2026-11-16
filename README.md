# HireIQ

### AI-Powered Recruitment & Applicant Tracking System (ATS)

**CSE470 – Software Engineering Project**  
**Group 10**

---

## Group Members

| Student ID | Name | Role / Focus | GitHub Profile |
| :---: | :---: | :---: | :---: |
| 24241101 | Rashed Satter | Member 4  | [@itsrashedsatter](https://github.com/itsrashedsatter) |
| 24301191 | Saad Bin Shadi Srabon | Member 1 | [@NeatChain9-coder](https://github.com/NeatChain9-coder) |
| 22301510 | Mehrab Arefin | Member 3 | [@Mehrab-Arefin](https://github.com/Mehrab-Arefin) |
| 23101118 | M M Tariqul Islam Siam | Member 2 | [@siamknowsnothing](https://github.com/siamknowsnothing) |

---

## Project Overview

**HireIQ** is an enterprise-grade, web-based recruitment and applicant tracking system designed to modernize end-to-end talent acquisition. Built strictly under the **Model-View-Controller (MVC)** architectural paradigm, HireIQ enables organizations to transition away from unstructured spreadsheets and disjointed email threads into an intelligent, data-driven hiring workflow.

The platform bridges hiring managers, recruiters, interview panels, and candidates:
- Hiring managers raise vacancy requests that flow through an approval workflow.
- Recruiters manage job postings with **weighted competency requirements**, source attribution, and automated deadline tracking.
- Candidates browse open positions and submit applications.
- An AI service parses uploaded resumes, extracts entities, and executes TF-IDF cosine similarity job-matching with skill gap analysis.
- Structured scorecards, Kanban pipeline stages, interview conflict detection, and tamper-resistant audit logs maintain institutional transparency.

---

## 20 Core Features

| # | Feature | Description | Module |
|---|---|---|---|
| 1 | **Job Requisition & Approval Workflow** | Hiring managers submit vacancy requests with headcount, justification, and budget; HR approves or rejects. | HR / Planning |
| 2 | **Job Posting Management** *(Sprint 1 - Rashed)* | Recruiters create, edit, publish, pause, and close postings with weighted required skills, salary range, source tags, and automatic deadline closure. | Recruitment |
| 3 | **Candidate Application Portal** | Candidates browse and filter open roles, submit resumes/cover letters, and track real-time application status. | Portal |
| 4 | **Resume Parsing & Data Extraction** | AI microservice extracts contact details, skills, education, and experience from resumes using NLP. | AI / Engine |
| 5 | **AI Job-Match Scoring & Skill Gap Analysis** | Vectorized TF-IDF cosine similarity and custom weighted formula produce a 0–100 match score with skill tags. | AI / Matching |
| 6 | **Candidate Ranking & Auto-Shortlisting** | Applicants ranked by match score; threshold auto-shortlists qualified candidates with bulk actions. | Screening |
| 7 | **Blind Screening Mode** | Hides candidate name, photo, gender, and contact info until shortlisting to eliminate bias. | Compliance |
| 8 | **Applicant Pipeline (Kanban) Management** | Interactive drag-and-drop board enforcing stage transitions (Applied → Screening → Interview → Offer → Hired). | Pipeline |
| 9 | **Interview Scheduling & Conflict Detection** | Calendar scheduling using interviewer availability, preventing double-booking of candidates or staff. | Interviews |
| 10 | **Interview Panel Scorecards & Feedback** | Multi-evaluator structured scorecards with weighted scoring; blind submission prevents peer bias. | Evaluation |
| 11 | **Candidate Comparison & Decision Support** | Side-by-side matrix of 2–4 candidates comparing scores, skill gaps, experience, and interviewer ratings. | Decision |
| 12 | **Offer Letter Generation & Response Tracking** | Automated PDF offer letter generation with secure signing/response link for candidates. | Offers |
| 13 | **Automated Email Notification Engine** *(Sprint 1 - Mehrab)* | Asynchronous queue-based notification dispatcher with customizable templates, variable interpolation, delivery audit trail, 1-click retry, and weekly HR digest. | Automation |
| 14 | **Candidate Profile, Search & History** | Unified candidate profiles tracking all historical applications, timeline events, and notes. | Talent CRM |
| 15 | **Talent Pool & Past-Candidate Re-Matching** | Archived talent pool matching previous applicants against newly published job requisitions. | Sourcing |
| 16 | **Hiring Team Collaboration & Internal Notes** | Team comments, private notes, and @mentions on candidate files visible only to hiring stakeholders. | Collaboration |
| 17 | **Recruiter Dashboard & Action Alerts** | KPI metrics, active pipeline summaries, today's interviews, and overdue action items. | Dashboard |
| 18 | **Recruitment Analytics & Reports** | Time-to-hire, funnel conversion rates, department breakdowns, and CSV export. | Analytics |
| 19 | **Source Effectiveness & Cost-per-Hire Tracking** | Attribution tracking per source channel (LinkedIn, BDJobs, Referral) against recruitment budget. | Finance |
| 20 | **Hiring Audit Trail & Activity Log** | Tamper-resistant log capturing stage movements, status alterations, and user actions. | Security |

---

## Individual Sprint Allocation (Group 10)

### Member 4 – Rashed Satter (ID: 24241101)
- **Sprint 1**: **F2: Job Posting Management** *(Current)*
- **Sprint 2**: **F1: Job Requisition & Approval Workflow**, **F5: AI Job-Match Scoring & Skill Gap Analysis**
- **Sprint 3**: **F19: Source Effectiveness & Cost-per-Hire Tracking**, **F18: Recruitment Analytics & Reports**

### Member 1 – Mehrab Arefin (ID: 22301510)
- **Sprint 1**: F3: Candidate Application Portal
- **Sprint 2**: F20: Hiring Audit Trail & Activity Log, F7: Blind Screening Mode
- **Sprint 3**: F12: Offer Letter Generation & Response Tracking, F17: Recruiter Dashboard & Alerts

### Member 2 – M M Tariqul Islam Siam (ID: 23101118)
- **Sprint 1**: F4: Resume Parsing & Data Extraction
- **Sprint 2**: F14: Candidate Profile, Search & History, F16: Team Collaboration & Internal Notes
- **Sprint 3**: F6: Candidate Ranking & Auto-Shortlisting, F15: Talent Pool & Past-Candidate Re-Matching

### Member 3 – Saad Bin Shadi Srabon (ID: 24301191)
- **Sprint 1**: F13: Automated Email Notification Engine
- **Sprint 2**: F8: Applicant Pipeline (Kanban) Management, F9: Interview Scheduling & Conflict Detection
- **Sprint 3**: F10: Interview Panel Scorecards, F11: Candidate Comparison & Decision Support

---

## Architecture & MVC Design

HireIQ strictly adheres to **Model-View-Controller (MVC)** principles:

```
hireiq/
├── server.js                     # Express server & static asset serving
├── config/
│   └── database.js               # JSON-based data persistence engine
├── data/
│   ├── requisitions.json         # Vacancy requisition records
│   ├── job_postings.json         # Job postings records
│   └── job_skills.json           # Weighted required skills records
├── models/
│   ├── JobPosting.js             # Model: CRUD, filtering, search, auto-deadline closing
│   ├── JobSkill.js               # Model: Weighted required skills (weights 1 to 5)
│   └── Requisition.js            # Model: Approved requisitions linking
├── controllers/
│   ├── jobPostingController.js   # Controller: Business logic, validation, status transitions
│   └── requisitionController.js  # Controller: Requisition lookup & link
├── routes/
│   ├── jobPostingRoutes.js       # Routes: /api/job-postings
│   └── requisitionRoutes.js      # Routes: /api/requisitions
├── public/
│   ├── index.html                # View: Recruiter Job Posting Management & Candidate Portal View
│   ├── css/
│   │   └── styles.css            # View: Responsive styling and UI components
│   └── js/
│       ├── api.js                # View/Helper: Frontend API service
│       └── app.js                # View/Helper: Reactive UI, modals, dynamic skills builder
└── test/
    └── test_f2.js                # Automated verification suite for F2
```

- **Models (`models/`)**: Encapsulate data access, schema validation, and lifecycle operations. Includes automatic checking and updating of postings that have reached their deadline date.
- **Views (`public/`)**: Clean HTML5/CSS3/Vanilla JS presentation views. Zero embedded server logic.
- **Controllers (`controllers/`)**: Handle HTTP requests, enforce business validation rules (required title/department/deadline, valid weight values, permissible status transitions), and return structured JSON responses.
- **Routes (`routes/`)**: Explicit endpoint mappings delegating directly to controller methods.

---

## Feature 2 (Sprint 1) Highlights: Job Posting Management

1. **Requisition-Linked or Standalone Creation**:
   - Recruiters can select an approved vacancy requisition (e.g., `REQ-101`) to automatically populate title, department, and budget.
   - Alternatively, recruiters can author standalone postings directly.
2. **Dynamic Weighted Required Skills Builder**:
   - Recruiters can add any number of required skills and assign each an importance weight from **1 to 5** (1: Basic / Nice-to-have, 2: Familiar, 3: Competent, 4: Advanced, 5: Critical / Must-have).
   - These skill weights directly feed into Sprint 2's AI Match Scoring algorithm (F5).
3. **Application Deadline & Auto-Close Logic**:
   - Every posting carries an application deadline date.
   - When the deadline passes, the system **automatically flags and transitions the posting to `Closed` status**, preventing overdue applications while displaying an audit badge.
4. **Lifecycle Status Management**:
   - Easy status transitions between `Published` (Active), `Paused` (Temporarily on hold), and `Closed` (Ended).
5. **Real-time Search & Multi-facet Filtering**:
   - Instant search across job title, department, skills, and source channels.
   - Filter by status, department, experience level, and source tag.
6. **Candidate Career View Toggle**:
   - Preview mode showing how active openings appear to public applicants.

---

## Feature 13 (Sprint 1) Highlights: Automated Email Notification Engine

**Assigned Member:** Mehrab Arefin (ID: 22301510) • Member 3

1. **8 Core Recruitment Event Templates**:
   - `application_received`: Auto-acknowledgment with application ID and tracking link.
   - `candidate_shortlisted`: Positive notification with AI match score and next-step briefings.
   - `interview_invite`: Structured invitation with date, time, mode, panel members, and meeting link.
   - `interview_updated`: Rescheduling notice with modified timings and conflict notes.
   - `candidate_rejected`: Respectful rejection notice with talent pool retention option.
   - `offer_letter`: Formal offer notice with compensation, deadline, and secure signing URL.
   - `candidate_hired`: Onboarding welcome notice with reporting manager attribution.
   - `weekly_hr_digest`: High-level operational digest summarizing metrics for HR leadership.
2. **Template Customizer & Live Variable Preview Engine**:
   - Admins can customize email subjects and HTML bodies directly from the UI.
   - Clickable variable pills (`{{candidate_name}}`, `{{job_title}}`, etc.) enable easy variable insertion.
   - Live rendered preview pane renders substitutions in real time.
3. **Asynchronous Non-Blocking Queue Processor**:
   - Integrated in `services/emailService.js`.
   - Incoming email requests are instantly logged as `Queued` and processed in the background without freezing caller threads.
4. **Resilient Failure Handling & Automatic Retries**:
   - Handles network and mailer exceptions gracefully.
   - Re-attempts delivery up to `max_attempts = 3` before marking permanent failure.
5. **Delivery Audit Trail & 1-Click Manual Retry**:
   - Full transactional tracking in `email_logs.json` with delivery timestamps and error stack traces.
   - 1-Click "Retry" button on the UI allows instant re-dispatch with optional destination correction.
6. **Scheduled Weekly HR Digest**:
   - Compiles live data from `JobPosting` metrics and dispatches an executive overview to HR managers.
7. **Cross-Member Service Integration Layer**:
   - Teammates trigger notifications via single-line helper methods (`emailService.triggerApplicationReceived({...})`).

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x, v20.x, or v24.x)
- npm (v9.x or higher)

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/itsrashedsatter/hireiq.git
cd hireiq

# Install dependencies
npm install

# Start the application server
npm start
```

Open your browser and navigate to:
- Recruiter Job Posting Portal: `http://localhost:8000`
- Email Engine & Audit Dashboard: `http://localhost:8000/email-manager.html`

### Running Automated Verification Tests
```bash
# Run both Sprint 1 feature verification test suites
npm test

# Run Feature 2 (Job Posting Management) verification
node test/test_f2.js

# Run Feature 13 (Automated Email Notification Engine) verification
node test/test_f13.js
```

---

## Git Workflow & Branching Strategy

- `main` branch maintains clean, production-ready releases.
- Individual member feature branches are integrated via Pull Requests.
- Commit conventions follow standard Semantic Commit guidelines:
  - `feat: add job posting management and weighted skills (F2)`
  - `fix: resolve deadline auto-close comparison edge case`
  - `docs: update SRS mapping and README documentation`

---

## License & Course Compliance
Developed for BRAC University CSE470 (Software Engineering). All rights reserved by Group 10.
