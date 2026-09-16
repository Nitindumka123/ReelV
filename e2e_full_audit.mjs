import http from 'http';

const BASE_URL = 'http://127.0.0.1:3000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 45000,
    };

    const req = http.request(url, reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => { chunks.push(chunk); });
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        let json = null;
        try { json = JSON.parse(text); } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: buffer,
          text,
          json
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('REQUEST_TIMEOUT'));
    });

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('       REELVAULT PHASE 8 COMPREHENSIVE AUDIT        ');
  console.log('====================================================\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name} - ${details}`);
      failed++;
    }
  }

  // 1. Health Probe
  try {
    const res = await request('/health');
    assert('GET /health returns 200 OK with uptime', res.status === 200 && res.json?.status === 'ok');
    assert('GET /health has X-Robots-Tag noindex header', res.headers['x-robots-tag']?.includes('noindex'));
  } catch (e) {
    assert('GET /health reachable', false, e.message);
  }

  // 2. Readiness Probe
  try {
    const res = await request('/ready');
    assert('GET /ready returns 200 with active provider', res.status === 200 && (res.json?.status === 'ready'));
    console.log(`   [Info] Provider active: ${res.json?.provider}`);
  } catch (e) {
    assert('GET /ready probe', false, e.message);
  }

  // 3. SSRF & Malicious URL Tests
  console.log('\n--- Testing Security & SSRF Protections ---');
  const maliciousUrls = [
    'http://127.0.0.1:8000/secret',
    'https://169.254.169.254/latest/meta-data',
    'https://instagram.com.evil.com/reel/12345',
    'https://instagram.com:8080/reel/12345',
    'https://user:pass@instagram.com/reel/12345',
    'ftp://instagram.com/reel/12345',
    'javascript:alert(1)',
    'https://[::1]/reel/12345'
  ];

  for (const badUrl of maliciousUrls) {
    try {
      const res = await request('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { url: badUrl }
      });
      assert(`Reject malicious target: ${badUrl.slice(0, 35)}...`, res.status === 400 && res.json?.success === false);
    } catch (e) {
      assert(`Reject malicious target ${badUrl}`, false, e.message);
    }
  }

  // 4. Invalid Instagram URL Structure
  console.log('\n--- Testing URL Format & Unsupported Media ---');
  try {
    const res = await request('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { url: 'https://www.instagram.com/invalid_route/xyz' }
    });
    assert('Reject unsupported Instagram route', res.status === 400 && res.json?.errorCode === 'UNSUPPORTED_URL');
  } catch (e) {
    assert('Reject unsupported route', false, e.message);
  }

  // 5. Non-existent Media Handling
  console.log('\n--- Testing Non-Existent Media ---');
  try {
    const res = await request('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { url: 'https://www.instagram.com/reel/NONEXISTENT_ABC999/' }
    });
    assert('Proper error on non-existent post', res.status !== 200 && res.json?.success === false);
    console.log(`   [Info] Error code returned: ${res.json?.errorCode} - ${res.json?.message}`);
  } catch (e) {
    assert('Non-existent post handling', false, e.message);
  }

  // 6. Valid Reel Resolution & Token Flow
  console.log('\n--- Testing Valid Public Reel Extraction ---');
  const validReelUrl = 'https://www.instagram.com/reel/DdTu5r8NK9I/?utm_source=ig_web_copy_link&stkn=NTc4MTIwNjQ2YQ==';
  let downloadUrl = null;

  try {
    const startTime = Date.now();
    const res = await request('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { url: validReelUrl }
    });
    const duration = Date.now() - startTime;
    console.log(`   [Info] Resolution latency: ${duration}ms`);

    assert('Resolve valid reel returns 200', res.status === 200 && res.json?.success === true);
    assert('Resolved metadata has title', !!res.json?.media?.title);
    assert('Resolved metadata has thumbnail', !!res.json?.media?.thumbnail);
    assert('Resolved metadata has mp4 extension', res.json?.media?.extension === 'mp4');
    assert('Download URL does not expose upstream raw CDN', res.json?.media?.url?.startsWith('/api/download?token='));

    downloadUrl = res.json?.media?.url;
  } catch (e) {
    assert('Resolve valid reel', false, e.message);
  }

  // 7. Download Token Verification & Streaming
  console.log('\n--- Testing Download Endpoint & Stream Security ---');
  if (downloadUrl) {
    try {
      // Test invalid token
      const invalidTokenRes = await request('/api/download?token=0000000000000000000000000000000000000000000000000000000000000000');
      assert('Reject invalid token with 403', invalidTokenRes.status === 403);

      // Test missing token
      const missingTokenRes = await request('/api/download');
      assert('Reject missing token with 400', missingTokenRes.status === 400);

      // Test valid token stream
      const streamRes = await request(downloadUrl, { method: 'GET' });
      assert('Valid token returns 200 OK stream', streamRes.status === 200);
      assert('Streaming has Content-Disposition attachment', streamRes.headers['content-disposition']?.includes('attachment'));
      assert('Streaming has Content-Type video/mp4', streamRes.headers['content-type']?.includes('video/mp4'));
      assert('Streaming has nosniff header', streamRes.headers['x-content-type-options'] === 'nosniff');
      assert('Streaming has no-cache / no-store', streamRes.headers['cache-control']?.includes('no-store'));
      assert('Streaming has X-Robots-Tag noindex', streamRes.headers['x-robots-tag']?.includes('noindex'));
      assert('Media stream transmitted real bytes', streamRes.body.length > 1000);
      console.log(`   [Info] Transferred bytes: ${streamRes.body.length}`);
    } catch (e) {
      assert('Download endpoint verification', false, e.message);
    }
  }

  console.log('\n====================================================');
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
