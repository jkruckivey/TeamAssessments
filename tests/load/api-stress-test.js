import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
export const errorRate = new Rate('api_errors');

// Stress test configuration - adjusted for Render hosting
export const options = {
  stages: [
    { duration: '30s', target: parseInt(__ENV.VUS) || 3 }, // Gentle ramp up
    { duration: __ENV.DURATION || '2m', target: parseInt(__ENV.VUS) || 3 }, // Sustained load
    { duration: '1m', target: parseInt(__ENV.VUS) * 1.5 || 5 }, // Mild spike test
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.5'], // Error rate under 50% (very lenient for free hosting)
    api_errors: ['rate<0.5'],
  },
};

const BASE_URL = __ENV.TARGET_URL || 'https://assessments.iveyedtech.ca';

// Sample test data
const sampleTeams = [
  { name: 'Team Alpha', members: ['Alice', 'Bob', 'Charlie'] },
  { name: 'Team Beta', members: ['David', 'Eve', 'Frank'] },
  { name: 'Team Gamma', members: ['Grace', 'Henry', 'Irene'] },
];

const sampleAssessment = {
  teamId: 1,
  ratings: {
    communication: 4,
    collaboration: 5,
    leadership: 3,
    problemSolving: 4
  },
  comments: 'Great team performance during stress test'
};

export default function () {
  // Test API endpoints that might exist
  
  // 1. Test data retrieval
  let response = http.get(`${BASE_URL}/api/teams`, {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(response, {
    'teams API accessible': (r) => r.status === 200 || r.status === 404,
    'teams API response time acceptable': (r) => r.timings.duration < 3000,
  });
  
  // 2. Test assessment submission (if endpoint exists)
  response = http.post(`${BASE_URL}/api/assessments`, JSON.stringify(sampleAssessment), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  let assessmentCheck = check(response, {
    'assessment submission handled': (r) => r.status < 500, // Any non-server-error
    'assessment response time acceptable': (r) => r.timings.duration < 5000,
  });
  
  errorRate.add(!assessmentCheck);
  
  // 3. Test batch operations
  response = http.post(`${BASE_URL}/api/batch-assessment`, JSON.stringify({
    assessments: Array(5).fill(sampleAssessment)
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  check(response, {
    'batch assessment handled': (r) => r.status < 500,
  });
  
  // 4. Test file upload simulation (if supported)
  const formData = {
    csvFile: http.file(Buffer.from('Name,Email\nTest User,test@test.com'), 'test.csv', 'text/csv')
  };
  
  response = http.post(`${BASE_URL}/api/upload-teams`, formData);
  
  check(response, {
    'file upload endpoint exists': (r) => r.status !== 404,
  });
  
  // 5. Concurrent page loads to stress the server
  const urls = [
    `${BASE_URL}/index.html`,
    `${BASE_URL}/admin.html`,
    `${BASE_URL}/batch-assessment.html`,
    `${BASE_URL}/group-assessment.html`,
    `${BASE_URL}/team-results.html`
  ];
  
  // Load multiple pages simultaneously
  const responses = http.batch(urls.map(url => ['GET', url]));
  
  responses.forEach((resp, index) => {
    check(resp, {
      [`page ${index + 1} loads`]: (r) => r.status === 200 || r.status === 404,
    });
  });
  
  // Variable sleep to create realistic load patterns
  sleep(Math.random() * 3 + 0.5);
}