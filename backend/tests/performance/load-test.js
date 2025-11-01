/**
 * K6 Load Testing Script for IBN Blockchain Platform
 * 
 * Tests API performance under various load conditions
 * 
 * Install: https://k6.io/docs/getting-started/installation/
 * Run: k6 run load-test.js
 * 
 * Scenarios:
 * - Smoke test: Minimal load
 * - Load test: Normal traffic
 * - Stress test: Peak traffic
 * - Spike test: Sudden traffic increase
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const chaincodeUploadDuration = new Trend('chaincode_upload_duration');
const queryDuration = new Trend('query_duration');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const TEST_USER = {
    username: __ENV.TEST_USER || 'load_test_user',
    password: __ENV.TEST_PASSWORD || 'LoadTest@12345',
    email: __ENV.TEST_EMAIL || 'loadtest@example.com',
};

// Test scenarios
export const options = {
    scenarios: {
        // Smoke test - Minimal load
        smoke: {
            executor: 'constant-vus',
            vus: 1,
            duration: '30s',
            tags: { test_type: 'smoke' },
            exec: 'smokeTest',
        },
        
        // Load test - Normal traffic
        load: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 10 },  // Ramp up
                { duration: '3m', target: 10 },  // Stay at 10 VUs
                { duration: '1m', target: 20 },  // Ramp to 20
                { duration: '3m', target: 20 },  // Stay at 20
                { duration: '1m', target: 0 },   // Ramp down
            ],
            startTime: '31s',
            tags: { test_type: 'load' },
            exec: 'loadTest',
        },
        
        // Stress test - Peak traffic
        stress: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '1m', target: 20 },
                { duration: '2m', target: 50 },
                { duration: '2m', target: 50 },
                { duration: '1m', target: 100 },
                { duration: '2m', target: 100 },
                { duration: '1m', target: 0 },
            ],
            startTime: '10m',
            tags: { test_type: 'stress' },
            exec: 'stressTest',
        },
        
        // Spike test - Sudden traffic increase
        spike: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '10s', target: 50 },  // Sudden spike
                { duration: '1m', target: 50 },   // Sustain
                { duration: '10s', target: 0 },   // Drop
            ],
            startTime: '20m',
            tags: { test_type: 'spike' },
            exec: 'spikeTest',
        },
    },
    
    thresholds: {
        // HTTP errors should be less than 1%
        'errors': ['rate<0.01'],
        // 95% of requests should be below 500ms
        'http_req_duration': ['p(95)<500'],
        // 99% of requests should be below 1000ms
        'http_req_duration': ['p(99)<1000'],
        // Successful requests should be > 95%
        'checks': ['rate>0.95'],
    },
};

// Helper: Get authentication token
function getAuthToken() {
    const loginPayload = JSON.stringify({
        username: TEST_USER.username,
        password: TEST_USER.password,
    });

    const params = {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    };

    // Try login
    let response = http.post(
        `${BASE_URL}/api/v1/auth/login`,
        `username=${TEST_USER.username}&password=${TEST_USER.password}`,
        params
    );

    // If login fails, try to register
    if (response.status !== 200) {
        const registerPayload = JSON.stringify(TEST_USER);
        const registerParams = {
            headers: { 'Content-Type': 'application/json' },
        };
        
        http.post(
            `${BASE_URL}/api/v1/auth/register`,
            registerPayload,
            registerParams
        );
        
        // Login again
        response = http.post(
            `${BASE_URL}/api/v1/auth/login`,
            `username=${TEST_USER.username}&password=${TEST_USER.password}`,
            params
        );
    }

    if (response.status === 200) {
        const body = JSON.parse(response.body);
        return body.access_token;
    }

    return null;
}

// Helper: Get request headers with auth
function getHeaders(token) {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
    };
}

// Smoke Test - Basic functionality
export function smokeTest() {
    group('Health Checks', () => {
        const healthRes = http.get(`${BASE_URL}/health`);
        check(healthRes, {
            'health check status is 200': (r) => r.status === 200,
            'health check returns healthy': (r) => {
                const body = JSON.parse(r.body);
                return body.status === 'healthy';
            },
        });
    });

    group('Authentication', () => {
        const token = getAuthToken();
        check(token, {
            'authentication successful': (t) => t !== null,
        });
    });

    sleep(1);
}

// Load Test - Normal operations
export function loadTest() {
    const token = getAuthToken();
    if (!token) {
        errorRate.add(1);
        failedRequests.add(1);
        return;
    }

    const headers = getHeaders(token);

    group('List Operations', () => {
        // List chaincodes
        const listRes = http.get(`${BASE_URL}/api/v1/chaincode?skip=0&limit=10`, {
            headers,
        });
        
        const listCheck = check(listRes, {
            'list chaincodes status is 200': (r) => r.status === 200,
            'list response has data': (r) => {
                const body = JSON.parse(r.body);
                return body.chaincodes !== undefined;
            },
        });

        if (listCheck) {
            successfulRequests.add(1);
            queryDuration.add(listRes.timings.duration);
        } else {
            errorRate.add(1);
            failedRequests.add(1);
        }
    });

    group('Project Operations', () => {
        // List projects
        const projRes = http.get(`${BASE_URL}/api/v1/projects?skip=0&limit=10`, {
            headers,
        });
        
        check(projRes, {
            'list projects status is 200': (r) => r.status === 200,
        });
    });

    group('Channel Operations', () => {
        // List channels
        const chanRes = http.get(`${BASE_URL}/api/v1/channels?skip=0&limit=10`, {
            headers,
        });
        
        check(chanRes, {
            'list channels status is 200': (r) => r.status === 200,
        });
    });

    sleep(Math.random() * 2 + 1); // Random sleep 1-3s
}

// Stress Test - Heavy load
export function stressTest() {
    const token = getAuthToken();
    if (!token) {
        errorRate.add(1);
        failedRequests.add(1);
        return;
    }

    const headers = getHeaders(token);

    group('Concurrent Reads', () => {
        const responses = http.batch([
            ['GET', `${BASE_URL}/api/v1/chaincode?skip=0&limit=10`, null, { headers }],
            ['GET', `${BASE_URL}/api/v1/projects?skip=0&limit=10`, null, { headers }],
            ['GET', `${BASE_URL}/api/v1/channels?skip=0&limit=10`, null, { headers }],
            ['GET', `${BASE_URL}/api/v1/channels/stats`, null, { headers }],
        ]);

        const allSuccess = responses.every(r => r.status === 200);
        
        if (allSuccess) {
            successfulRequests.add(responses.length);
        } else {
            errorRate.add(1);
            failedRequests.add(responses.length - responses.filter(r => r.status === 200).length);
        }

        check(responses[0], {
            'concurrent requests successful': () => allSuccess,
        });
    });

    sleep(0.5);
}

// Spike Test - Sudden load
export function spikeTest() {
    const token = getAuthToken();
    if (!token) {
        errorRate.add(1);
        return;
    }

    const headers = getHeaders(token);

    // Rapid fire requests
    const res = http.get(`${BASE_URL}/api/v1/chaincode?skip=0&limit=5`, {
        headers,
    });

    check(res, {
        'spike request successful': (r) => r.status === 200 || r.status === 429, // 429 = rate limited
    });

    if (res.status === 200) {
        successfulRequests.add(1);
    } else if (res.status === 429) {
        // Rate limited - expected under spike
        console.log('Rate limited (expected under spike)');
    } else {
        errorRate.add(1);
        failedRequests.add(1);
    }

    // No sleep - maximum throughput
}

// Summary handler
export function handleSummary(data) {
    return {
        'stdout': textSummary(data, { indent: ' ', enableColors: true }),
        'summary.json': JSON.stringify(data),
        'summary.html': htmlReport(data),
    };
}

// Text summary helper
function textSummary(data, options) {
    const indent = options.indent || '';
    const enableColors = options.enableColors || false;
    
    let output = '\n';
    output += `${indent}█▀▀█ █▀▀ █▀▀█ █▀▀ █▀▀█ █▀▀█ █▀▄▀█ █▀▀█ █▀▀▄ █▀▀ █▀▀\n`;
    output += `${indent}█──█ █▀▀ █▄▄▀ █▀▀ █──█ █▄▄▀ █─▀─█ █▄▄█ █──█ █── █▀▀\n`;
    output += `${indent}█▀▀▀ ▀▀▀ ▀─▀▀ ▀── ▀▀▀▀ ▀─▀▀ ▀───▀ ▀──▀ ▀──▀ ▀▀▀ ▀▀▀\n\n`;
    
    // Metrics
    output += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    output += `${indent}PERFORMANCE SUMMARY\n`;
    output += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // HTTP metrics
    if (data.metrics.http_reqs) {
        output += `${indent}Total Requests: ${data.metrics.http_reqs.values.count}\n`;
        output += `${indent}Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n\n`;
    }
    
    // Duration metrics
    if (data.metrics.http_req_duration) {
        const duration = data.metrics.http_req_duration.values;
        output += `${indent}Response Times:\n`;
        output += `${indent}  avg: ${duration.avg.toFixed(2)}ms\n`;
        output += `${indent}  min: ${duration.min.toFixed(2)}ms\n`;
        output += `${indent}  med: ${duration.med.toFixed(2)}ms\n`;
        output += `${indent}  max: ${duration.max.toFixed(2)}ms\n`;
        output += `${indent}  p(90): ${duration['p(90)'].toFixed(2)}ms\n`;
        output += `${indent}  p(95): ${duration['p(95)'].toFixed(2)}ms\n`;
        output += `${indent}  p(99): ${duration['p(99)'].toFixed(2)}ms\n\n`;
    }
    
    // Error rate
    if (data.metrics.errors) {
        const errorPct = (data.metrics.errors.values.rate * 100).toFixed(2);
        output += `${indent}Error Rate: ${errorPct}%\n\n`;
    }
    
    // Checks
    if (data.metrics.checks) {
        const checkPct = (data.metrics.checks.values.rate * 100).toFixed(2);
        output += `${indent}Checks Passed: ${checkPct}%\n`;
        output += `${indent}  ✓ ${data.metrics.checks.values.passes}\n`;
        output += `${indent}  ✗ ${data.metrics.checks.values.fails}\n\n`;
    }
    
    output += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    return output;
}

// HTML report helper
function htmlReport(data) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>k6 Performance Test Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            max-width: 1200px;
            margin: 40px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #333;
        }
        .metric-unit {
            font-size: 16px;
            color: #999;
        }
        .status-good { color: #10b981; }
        .status-warning { color: #f59e0b; }
        .status-error { color: #ef4444; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Performance Test Report</h1>
        <p>IBN Blockchain Platform - k6 Load Testing</p>
    </div>
    
    <div class="metric-grid">
        <div class="metric-card">
            <div class="metric-label">Total Requests</div>
            <div class="metric-value">${data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 'N/A'}</div>
        </div>
        
        <div class="metric-card">
            <div class="metric-label">Request Rate</div>
            <div class="metric-value">
                ${data.metrics.http_reqs ? data.metrics.http_reqs.values.rate.toFixed(2) : 'N/A'}
                <span class="metric-unit">/s</span>
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-label">Avg Response Time</div>
            <div class="metric-value">
                ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 'N/A'}
                <span class="metric-unit">ms</span>
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-label">p95 Response Time</div>
            <div class="metric-value">
                ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 'N/A'}
                <span class="metric-unit">ms</span>
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-label">Error Rate</div>
            <div class="metric-value ${data.metrics.errors && data.metrics.errors.values.rate > 0.01 ? 'status-error' : 'status-good'}">
                ${data.metrics.errors ? (data.metrics.errors.values.rate * 100).toFixed(2) : '0.00'}
                <span class="metric-unit">%</span>
            </div>
        </div>
        
        <div class="metric-card">
            <div class="metric-label">Checks Passed</div>
            <div class="metric-value ${data.metrics.checks && data.metrics.checks.values.rate < 0.95 ? 'status-warning' : 'status-good'}">
                ${data.metrics.checks ? (data.metrics.checks.values.rate * 100).toFixed(2) : '100.00'}
                <span class="metric-unit">%</span>
            </div>
        </div>
    </div>
    
    <div class="metric-card">
        <h2>Response Time Distribution</h2>
        <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">Minimum</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.min.toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">Average</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.avg.toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">Median</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.med.toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">p(90)</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(90)'].toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">p(95)</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(95)'].toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px;">p(99)</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values['p(99)'].toFixed(2) : 'N/A'} ms
                </td>
            </tr>
            <tr>
                <td style="padding: 10px;">Maximum</td>
                <td style="padding: 10px; text-align: right; font-weight: bold;">
                    ${data.metrics.http_req_duration ? data.metrics.http_req_duration.values.max.toFixed(2) : 'N/A'} ms
                </td>
            </tr>
        </table>
    </div>
</body>
</html>
    `;
}

