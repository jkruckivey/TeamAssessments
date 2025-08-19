import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: parseInt(__ENV.VUS) || 5 }, // Ramp up
    { duration: __ENV.DURATION || '2m', target: parseInt(__ENV.VUS) || 5 }, // Stay at load
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    http_req_failed: ['rate<0.1'], // Error rate under 10%
    errors: ['rate<0.1'],
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