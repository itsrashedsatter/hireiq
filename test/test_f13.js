const app = require('../server');
const http = require('http');
const emailService = require('../services/emailService');

let server;
const PORT = 3567;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=================================================================');
  console.log('--- Starting HireIQ Feature 13 (F13) Automated Verification ---');
  console.log('    Assigned Member: Mehrab Arefin (ID: 22301510)               ');
  console.log('    Feature: Automated Email Notification Engine (Sprint 1)     ');
  console.log('=================================================================\n');

  server = app.listen(PORT);

  try {
    // 1. Health check verification
    console.log('[Test 1] Verifying System Health & Feature Attribution...');
    const health = await request('GET', '/api/health');
    console.log('  ✓ System Health status:', health.status);
    const f13 = health.body.features.find(f => f.id === 'F13');
    if (!f13 || !f13.author.includes('Mehrab Arefin')) {
      throw new Error('F13 attribution missing from health check endpoint!');
    }
    console.log(`  ✓ Feature F13 registered to: ${f13.author}`);

    // 2. Metrics endpoint
    console.log('\n[Test 2] Checking Email Engine Deliverability Metrics...');
    const metrics = await request('GET', '/api/email/metrics');
    console.log('  ✓ Metrics retrieved:', metrics.body.data);
    if (metrics.body.data.total === undefined) {
      throw new Error('Metrics payload invalid.');
    }

    // 3. Fetch all 8 templates
    console.log('\n[Test 3] Fetching System Notification Templates...');
    const templates = await request('GET', '/api/email/templates');
    console.log(`  ✓ Total templates retrieved: ${templates.body.count}`);
    if (templates.body.count < 8) {
      throw new Error(`Expected at least 8 event templates, found ${templates.body.count}`);
    }
    const requiredKeys = [
      'application_received',
      'candidate_shortlisted',
      'interview_invite',
      'interview_updated',
      'candidate_rejected',
      'offer_letter',
      'candidate_hired',
      'weekly_hr_digest'
    ];
    for (const key of requiredKeys) {
      const exists = templates.body.data.some(t => t.key === key);
      if (!exists) throw new Error(`Missing mandatory template: ${key}`);
    }
    console.log('  ✓ All 8 core recruitment lifecycle triggers verified.');

    // 4. Live placeholder rendering test
    console.log('\n[Test 4] Testing Variable Interpolation & Preview Engine...');
    const previewPayload = {
      sample_data: {
        candidate_name: 'Mehrab Arefin',
        job_title: 'Lead Software Architect',
        company_name: 'BRACU Tech',
        match_score: '96',
        next_steps: 'Technical viva with faculty examination board.'
      }
    };
    const previewRes = await request('POST', '/api/email/templates/candidate_shortlisted/preview', previewPayload);
    console.log('  ✓ Preview rendered subject:', previewRes.body.data.subject);
    if (!previewRes.body.data.subject.includes('Lead Software Architect') || 
        !previewRes.body.data.body_html.includes('Mehrab Arefin') ||
        !previewRes.body.data.body_html.includes('96%')) {
      throw new Error('Dynamic placeholder replacement failed!');
    }
    console.log('  ✓ Placeholders successfully interpolated into HTML body.');

    // 5. Update template content
    console.log('\n[Test 5] Testing Admin Template Customization (PUT)...');
    const updateRes = await request('PUT', '/api/email/templates/interview_invite', {
      subject: 'Interview Scheduled: {{job_title}} at {{company_name}} [CONFIRMED]',
      body_html: '<p>Updated interview body for {{candidate_name}}.</p>'
    });
    console.log('  ✓ Template updated:', updateRes.body.message);
    if (!updateRes.body.data.subject.includes('[CONFIRMED]')) {
      throw new Error('Template subject update failed.');
    }

    // 6. Test Enqueue and successful dispatch
    console.log('\n[Test 6] Enqueuing Notification for Asynchronous Dispatch...');
    const sendTestRes = await request('POST', '/api/email/send-test', {
      template_key: 'application_received',
      recipient_email: 'candidate.student@bracu.ac.bd',
      recipient_name: 'Sadia Sultana'
    });
    console.log('  ✓ Test email queued:', sendTestRes.body.data.id, 'for', sendTestRes.body.data.recipient_email);
    if (sendTestRes.status !== 201) {
      throw new Error('Failed to enqueue test email.');
    }

    // Wait a brief tick for async setImmediate queue processor
    await new Promise(r => setTimeout(r, 150));

    const checkLog = await request('GET', `/api/email/logs/${sendTestRes.body.data.id}`);
    console.log(`  ✓ Log status after queue worker execution: ${checkLog.body.data.status} (Attempts: ${checkLog.body.data.attempts})`);
    if (checkLog.body.data.status !== 'Sent') {
      throw new Error('Queue processor did not transition log status to Sent.');
    }

    // 7. Test Failure Handling and Error Logging
    console.log('\n[Test 7] Testing Delivery Failure Handling & Error Logging...');
    const failTestRes = await request('POST', '/api/email/send-test', {
      template_key: 'interview_invite',
      recipient_email: 'applicant@unreachable-domain.com',
      recipient_name: 'Failed Delivery Test'
    });
    const failedLogId = failTestRes.body.data.id;

    // Allow worker to attempt and record failure
    await new Promise(r => setTimeout(r, 150));

    const failedLog = await request('GET', `/api/email/logs/${failedLogId}`);
    console.log(`  ✓ Failed log captured: Status=${failedLog.body.data.status}`);
    console.log(`  ✓ Error message recorded: "${failedLog.body.data.error_message}"`);
    if (!failedLog.body.data.error_message) {
      throw new Error('Expected error message to be recorded in audit log!');
    }

    // 8. Test 1-Click Manual Retry
    console.log('\n[Test 8] Executing 1-Click Retry with Resolved Destination...');
    const retryRes = await request('POST', `/api/email/logs/${failedLogId}/retry`, {
      override_email: 'corrected-applicant@bracu.ac.bd'
    });
    console.log('  ✓ Retry API response:', retryRes.body.message);
    const retriedLog = await request('GET', `/api/email/logs/${failedLogId}`);
    console.log(`  ✓ Status after retry: ${retriedLog.body.data.status} (Total Attempts: ${retriedLog.body.data.attempts})`);
    if (retriedLog.body.data.status !== 'Sent') {
      throw new Error('Manual retry did not resolve delivery status to Sent!');
    }

    // 9. Test Weekly HR Digest Dispatch
    console.log('\n[Test 9] Testing Weekly HR Recruitment Digest Dispatch...');
    const digestRes = await request('POST', '/api/email/weekly-digest', {
      recipient_email: 'hr-head@bracu.ac.bd',
      recipient_name: 'Director of HR'
    });
    console.log('  ✓ Weekly HR Digest generated & queued:', digestRes.body.data.id);
    if (!digestRes.body.success) {
      throw new Error('Weekly HR Digest generation failed.');
    }

    // 10. Test Teammate Helper Methods (Service Integration Layer)
    console.log('\n[Test 10] Testing Teammate Integration Helper Layer (emailService)...');
    const helperLog = await emailService.triggerShortlisted({
      email: 'siam@bracu.ac.bd',
      name: 'Tariqul Islam Siam',
      job_title: 'AI Research Engineer',
      match_score: '94'
    });
    console.log(`  ✓ Service helper created log: ${helperLog.id} for ${helperLog.recipient_name}`);
    if (!helperLog.id) {
      throw new Error('Service helper method failed to create queue record.');
    }

    console.log('\n=================================================================');
    console.log('>>> ALL 10 TESTS PASSED! FEATURE 13 (F13) IS 100% OPERATIONAL! <<<');
    console.log('=================================================================\n');
  } catch (err) {
    console.error('\n❌ F13 Test Suite Error:', err);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
}

runTests();
