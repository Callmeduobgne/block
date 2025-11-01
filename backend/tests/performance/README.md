# Performance Testing

Comprehensive performance, load, and stress testing for the IBN Blockchain Platform using k6.

## 📋 Overview

Performance testing suite covering:
- **Smoke tests**: Basic functionality with minimal load (1 VU)
- **Load tests**: Normal traffic patterns (10-20 VUs)
- **Stress tests**: Peak load conditions (up to 100 VUs)
- **Spike tests**: Sudden traffic increases (0 → 50 VUs in 10s)

## 🚀 Quick Start

### Install k6

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Linux
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Or download from: https://k6.io/docs/getting-started/installation/
```

### Run Tests

```bash
# Run all scenarios
k6 run load-test.js

# Run with custom VUs
k6 run --vus 20 --duration 30s load-test.js

# Generate JSON output
k6 run --out json=results.json load-test.js

# With HTML report
k6 run load-test.js

# Custom backend URL
BASE_URL=http://localhost:8000 k6 run load-test.js
```

## 📊 Test Scenarios

### 1. Smoke Test (30s)
**Purpose**: Verify basic functionality under minimal load

- **VUs**: 1
- **Duration**: 30 seconds
- **Tests**:
  - Health check endpoint
  - Authentication flow
  - Basic API responsiveness

**Success Criteria**:
- 0% error rate
- All health checks pass

### 2. Load Test (9 minutes)
**Purpose**: Test normal production load

- **Stages**:
  - 0 → 10 VUs over 1m (ramp up)
  - 10 VUs for 3m (sustain)
  - 10 → 20 VUs over 1m (increase)
  - 20 VUs for 3m (sustain)
  - 20 → 0 VUs over 1m (ramp down)

- **Tests**:
  - List chaincodes (with pagination)
  - List projects
  - List channels
  - Channel statistics

**Success Criteria**:
- < 1% error rate
- p95 response time < 500ms
- p99 response time < 1000ms

### 3. Stress Test (9 minutes)
**Purpose**: Find system breaking points

- **Stages**:
  - 0 → 20 VUs over 1m
  - 20 → 50 VUs over 2m
  - 50 VUs for 2m
  - 50 → 100 VUs over 1m
  - 100 VUs for 2m
  - 100 → 0 VUs over 1m

- **Tests**:
  - Concurrent batch requests
  - Multiple endpoints simultaneously
  - Database query stress

**Success Criteria**:
- < 5% error rate
- System remains responsive
- No crashes or timeouts

### 4. Spike Test (1.33 minutes)
**Purpose**: Test sudden traffic surges

- **Stages**:
  - 0 → 50 VUs over 10s (sudden spike)
  - 50 VUs for 1m (sustain)
  - 50 → 0 VUs over 10s (drop)

- **Tests**:
  - Rapid API calls
  - Rate limiting behavior
  - Auto-scaling response

**Success Criteria**:
- Rate limiting activates properly
- No system crashes
- Graceful degradation

## 📈 Metrics & Thresholds

### Custom Metrics

```javascript
// Response time trends
loginDuration           // Login endpoint duration
chaincodeUploadDuration // Chaincode upload duration
queryDuration           // Query operations duration

// Success/Failure counters
successfulRequests      // Successful requests count
failedRequests          // Failed requests count
errorRate              // Overall error rate
```

### Thresholds

```javascript
{
    'errors': ['rate<0.01'],                    // < 1% errors
    'http_req_duration': ['p(95)<500'],         // 95% < 500ms
    'http_req_duration': ['p(99)<1000'],        // 99% < 1000ms
    'checks': ['rate>0.95'],                    // > 95% checks pass
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Backend URL
export BASE_URL=http://localhost:8000

# Test user credentials
export TEST_USER=load_test_user
export TEST_PASSWORD=LoadTest@12345
export TEST_EMAIL=loadtest@example.com
```

### Test Configuration

Edit `load-test.js` to modify:

```javascript
export const options = {
    scenarios: {
        // Customize scenarios here
    },
    thresholds: {
        // Customize thresholds here
    },
};
```

## 📊 Reading Results

### Console Output

```
     ✓ health check status is 200
     ✓ list chaincodes status is 200
     ✓ concurrent requests successful

     checks.........................: 98.50% ✓ 1970    ✗ 30
     data_received..................: 2.1 MB 35 kB/s
     data_sent......................: 98 kB  1.6 kB/s
     http_req_duration..............: avg=142.23ms min=45.12ms med=128.34ms max=892.45ms p(90)=234.56ms p(95)=345.67ms p(99)=678.90ms
     http_reqs......................: 2000   33.33/s
     iteration_duration.............: avg=1.2s min=1.05s med=1.18s max=1.95s p(90)=1.34s p(95)=1.45s
     iterations.....................: 2000   33.33/s
     vus............................: 1      min=1     max=100
     vus_max........................: 100    min=100   max=100
```

### Key Metrics

- **http_req_duration**: Response time distribution
  - `avg`: Average response time
  - `p(95)`: 95th percentile (95% faster than this)
  - `p(99)`: 99th percentile
  - `max`: Maximum response time

- **http_reqs**: Total HTTP requests and rate/second

- **checks**: Percentage of passed assertions

- **errors**: Error rate

- **vus**: Virtual users (current/min/max)

### HTML Report

Open `summary.html` in browser for detailed visual report:
- Response time charts
- Error rates
- Throughput graphs
- Success/failure breakdown

## 🎯 Performance Targets

### Acceptable Performance

| Metric | Target | Maximum |
|--------|--------|---------|
| Avg Response Time | < 200ms | < 500ms |
| p95 Response Time | < 300ms | < 500ms |
| p99 Response Time | < 500ms | < 1000ms |
| Error Rate | < 0.1% | < 1% |
| Throughput | > 50 req/s | - |
| Success Rate | > 99% | > 95% |

### Load Capacity

- **Light Load**: 1-10 VUs - < 100ms avg
- **Normal Load**: 10-30 VUs - < 200ms avg
- **Heavy Load**: 30-50 VUs - < 500ms avg
- **Peak Load**: 50-100 VUs - < 1000ms avg

## 🔍 Analyzing Results

### Good Performance Indicators

✅ Consistent response times across VU levels
✅ Linear throughput increase with VUs
✅ < 1% error rate
✅ Flat memory/CPU usage
✅ No timeouts or connection errors

### Warning Signs

⚠️ Response time increases exponentially
⚠️ Throughput plateaus or decreases
⚠️ Error rate > 1%
⚠️ Memory/CPU spikes
⚠️ Database connection pool exhaustion

### Critical Issues

🚨 System crashes or becomes unresponsive
🚨 Error rate > 5%
🚨 Timeouts on critical endpoints
🚨 Data corruption
🚨 Resource exhaustion (OOM, disk full)

## 🛠️ Optimization Tips

### If Response Times Are High

1. **Enable caching**
   - Redis for frequently accessed data
   - In-memory cache for static content

2. **Optimize database queries**
   - Add indexes
   - Use connection pooling
   - Implement query optimization

3. **Use CDN**
   - Serve static assets from CDN
   - Enable compression

4. **Horizontal scaling**
   - Add more application instances
   - Load balancer distribution

### If Error Rate Is High

1. **Check logs** for specific errors
2. **Review rate limiting** configuration
3. **Verify database connections** aren't exhausted
4. **Check network** timeouts
5. **Review authentication** token expiration

### If Throughput Is Low

1. **Increase workers** (uvicorn/gunicorn)
2. **Optimize blocking operations**
3. **Use async/await** properly
4. **Review database** connection pool size
5. **Check for bottlenecks** in critical paths

## 📚 Advanced Usage

### Custom Scenarios

```javascript
// Endpoint-specific test
export const options = {
    scenarios: {
        chaincode_upload: {
            executor: 'constant-arrival-rate',
            rate: 10, // 10 iterations/s
            timeUnit: '1s',
            duration: '5m',
            preAllocatedVUs: 50,
            exec: 'uploadChaincode',
        },
    },
};
```

### Cloud Testing

```bash
# k6 Cloud (requires account)
k6 cloud load-test.js

# Or use k6 with InfluxDB + Grafana
k6 run --out influxdb=http://localhost:8086/k6 load-test.js
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Run Performance Tests
  run: |
    k6 run --quiet --no-color load-test.js
```

## 📖 References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/test-types/)
- [Performance Testing Guide](https://www.simplethread.com/load-testing-with-k6/)
- [k6 Examples](https://github.com/grafana/k6-learn)

## 🆘 Troubleshooting

### k6 command not found
```bash
# Verify installation
k6 version

# Reinstall if needed
brew reinstall k6
```

### Connection refused errors
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check correct URL
BASE_URL=http://localhost:8000 k6 run load-test.js
```

### High error rates
```bash
# Run with single VU first
k6 run --vus 1 --duration 30s load-test.js

# Check backend logs
tail -f backend/logs/app.log
```

### Out of memory
```bash
# Reduce VUs or duration
k6 run --vus 10 --duration 1m load-test.js

# Or increase system resources
```

## 💡 Tips

1. **Start small**: Begin with smoke tests, then gradually increase load
2. **Monitor system**: Watch CPU, memory, disk I/O during tests
3. **Test in isolation**: Don't run other intensive tasks during tests
4. **Use realistic data**: Test with production-like data volumes
5. **Test regularly**: Include in CI/CD pipeline for regression detection
6. **Document baselines**: Record baseline metrics for comparison
7. **Test incrementally**: Increase load gradually to find breaking points

