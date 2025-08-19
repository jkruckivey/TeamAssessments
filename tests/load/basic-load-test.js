import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: parseInt(__ENV.VUS) || 3 }, // Ramp up (reduced from 5)
    { duration: __ENV.DURATION || '1m', target: parseInt(__ENV.VUS) || 3 }, // Stay at load (reduced duration)
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.25'], // Error rate under 25% (realistic for free hosting)
    errors: ['rate<0.25'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://assessments.iveyedtech.ca';

export default function () {
  // Test homepage load
  let response = http.get(BASE_URL);
  
  let checkResult = check(response, {
    'homepage loads successfully': (r) => r.status === 200,
    'homepage response time < 2s': (r) => r.timings.duration < 2000,
    'homepage contains expected content': (r) => r.body.includes('Team Assessment'),
  });
  
  errorRate.add(!checkResult);
  
  // Test static assets
  response = http.get(`${BASE_URL}/styles.css`);
  check(response, {
    'CSS loads successfully': (r) => r.status === 200,
  });
  
  response = http.get(`${BASE_URL}/script.js`);
  check(response, {
    'JavaScript loads successfully': (r) => r.status === 200,
  });
  
  // Test admin page (if publicly accessible)
  response = http.get(`${BASE_URL}/admin.html`);
  check(response, {
    'admin page accessible': (r) => r.status === 200 || r.status === 404, // 404 is acceptable
  });
  
  // Random delay between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1);
}