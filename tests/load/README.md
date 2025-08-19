# Load Testing for Team Assessments

This directory contains k6 load testing scripts for the Team Assessments application.

## Test Files

- `basic-load-test.js` - Standard load testing with realistic user patterns
- `api-stress-test.js` - Aggressive stress testing focusing on API endpoints

## Running Tests Locally

1. Install k6: https://k6.io/docs/getting-started/installation/

2. Run basic load test:
   ```bash
   k6 run tests/load/basic-load-test.js \
     --env TARGET_URL=http://localhost:3000 \
     --env DURATION=30s \
     --env VUS=5
   ```

3. Run stress test:
   ```bash
   k6 run tests/load/api-stress-test.js \
     --env TARGET_URL=http://localhost:3000 \
     --env DURATION=1m \
     --env VUS=10
   ```

## GitHub Actions Integration

The load tests run automatically:
- **Manual**: Use "Actions" tab → "Load Testing" → "Run workflow"
- **Scheduled**: Every Monday at 9 AM UTC
- **On Push**: When server.js or package.json changes

## Test Parameters

- `TARGET_URL`: URL to test (default: https://assessments.iveyedtech.ca)
- `DURATION`: How long to sustain load (e.g., 30s, 2m, 5m)
- `VUS`: Number of virtual users (concurrent connections)

## Success Criteria

### Basic Load Test
- 95% of requests complete under 3 seconds
- Error rate below 25% (realistic for free hosting)
- All static assets load successfully

### Stress Test
- 95% of requests complete under 3 seconds
- Error rate below 25% (realistic for free hosting)
- Server handles concurrent requests without crashing

## Interpreting Results

Key metrics to monitor:
- `http_req_duration`: Response time percentiles
- `http_req_failed`: Percentage of failed requests
- `http_reqs`: Total requests per second
- `vus`: Virtual users active
- `data_received/sent`: Network throughput

## Customization

Modify the test scripts to:
- Add authentication if needed
- Test specific user journeys
- Adjust thresholds based on your requirements
- Add custom metrics for business-specific KPIs