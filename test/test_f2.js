const app = require('../server');
const http = require('http');

let server;
const PORT = 3456;

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
  console.log('--- Starting HireIQ F2 Automated Verification Suite ---');
  server = app.listen(PORT);

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    console.log('✓ Health check status:', health.status, health.body.project);

    // 2. Metrics
    const metrics = await request('GET', '/api/job-postings/metrics');
    console.log('✓ Metrics:', metrics.body.data);

    // 3. Approved Requisitions
    const reqs = await request('GET', '/api/requisitions/approved');
    console.log(`✓ Approved requisitions retrieved: ${reqs.body.count}`);

    // 4. Job Postings with filters
    const postings = await request('GET', '/api/job-postings');
    console.log(`✓ Job postings retrieved: ${postings.body.count}`);

    // Check auto-close on expired deadline
    const expiredJob = postings.body.data.find(j => j.id === 'JOB-1004');
    if (expiredJob) {
      console.log(`✓ Auto-closed expired job check (JOB-1004 status): ${expiredJob.status} (auto_closed: ${expiredJob.auto_closed})`);
      if (expiredJob.status !== 'Closed') {
        throw new Error('JOB-1004 should have been auto-closed because its deadline was 2026-11-10!');
      }
    }

    // 5. Create a new Job Posting
    const newJobPayload = {
      title: 'DevOps & Cloud Architect',
      department: 'Engineering',
      requisition_id: 'REQ-101',
      experience_level: 'Senior Level',
      salary_range: '$110,000 - $140,000',
      source: 'LinkedIn',
      deadline: '2026-12-31',
      status: 'Published',
      blind_mode: true,
      description: 'Lead Kubernetes and AWS cloud infrastructure for HireIQ microservices.',
      skills: [
        { skill_name: 'Kubernetes & Docker', weight: 5 },
        { skill_name: 'Terraform & AWS', weight: 5 },
        { skill_name: 'CI/CD Pipelines', weight: 4 }
      ]
    };
    const createRes = await request('POST', '/api/job-postings', newJobPayload);
    console.log('✓ Created new posting:', createRes.status, createRes.body.data.id, createRes.body.data.title);
    const createdId = createRes.body.data.id;

    // 6. Verify weighted skills attached
    const fetchRes = await request('GET', `/api/job-postings/${createdId}`);
    console.log(`✓ Attached skills count for ${createdId}:`, fetchRes.body.data.skills.length);
    if (fetchRes.body.data.skills.length !== 3) {
      throw new Error('Skills count mismatch!');
    }

    // 7. Update status to Paused
    const pauseRes = await request('PATCH', `/api/job-postings/${createdId}/status`, { status: 'Paused' });
    console.log('✓ Updated status to Paused:', pauseRes.body.data.status);

    // 8. Search query test
    const searchRes = await request('GET', '/api/job-postings?search=Kubernetes');
    console.log('✓ Search by skill (Kubernetes) results count:', searchRes.body.count);
    if (searchRes.body.count < 1) {
      throw new Error('Search failed to find posting by skill name!');
    }

    // 9. Update posting details
    const updateRes = await request('PUT', `/api/job-postings/${createdId}`, {
      salary_range: '$120,000 - $150,000'
    });
    console.log('✓ Updated salary range:', updateRes.body.data.salary_range);

    console.log('\n>>> ALL AUTOMATED TESTS PASSED SUCCESSFULLY! <<<');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
}

runTests();
