# k6 Database Benchmark Suite

This directory contains the k6 benchmark infrastructure for testing real-time database performance. The benchmarks are designed to measure throughput, latency, and reliability under various load conditions.

## Directory Structure

```
benchmark/
├── README.md           # This file
├── options.js          # Load profile configurations (TPS stages, thresholds)
├── utils.js            # Shared utilities (generators, metrics, helpers)
├── template.js         # Template for creating new database tests (optional)
├── results/            # Test results output directory (created at runtime)
└── databases/          # Database-specific test scripts (to be added)
    ├── postgres/       # PostgreSQL tests
    ├── mysql/          # MySQL tests
    ├── redis/          # Redis tests
    └── ...
```

## Prerequisites

1. **Install k6**

   **macOS:**
   ```bash
   brew install k6
   ```

   **Linux:**
   ```bash
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

   **Docker:**
   ```bash
   docker pull grafana/k6
   ```

   **Verify installation:**
   ```bash
   k6 version
   ```

## Quick Start

### Running a Basic Test

```bash
# Run with default options (smoke test)
k6 run databases/postgres/test.js

# Run with specific load profile
k6 run --env PROFILE=tps500 databases/postgres/test.js

# Run with custom VUs and duration
k6 run --vus 100 --duration 5m databases/postgres/test.js
```

### Environment Variables

The following environment variables can be used to configure tests:

| Variable | Default | Description |
|----------|---------|-------------|
| `PROFILE` | `smoke` | Load profile to use (see Load Profiles below) |
| `DB_HOST` | `localhost` | Database host |
| `DB_PORT` | varies | Database port |
| `DB_NAME` | `test` | Database name |
| `DB_USER` | `test` | Database username |
| `DB_PASSWORD` | `test` | Database password |
| `DB_SSL` | `false` | Enable SSL connection |
| `DB_MAX_CONNECTIONS` | `10` | Max connections per VU |
| `KEY_PREFIX` | `k6-test` | Prefix for generated keys |
| `VALUE_SIZE` | `100` | Size of test values in bytes |
| `BATCH_SIZE` | `100` | Batch operation size |
| `READ_WRITE_RATIO` | `0.8` | Ratio of reads to writes (0-1) |
| `HOT_KEY_RATIO` | `0.2` | Ratio of hot key access (0-1) |
| `HOT_KEY_COUNT` | `100` | Number of hot keys |

## Load Profiles

The `options.js` file defines several pre-configured load profiles:

### TPS-Based Profiles

| Profile | Target VUs | Description |
|---------|------------|-------------|
| `tps100` | 10 | Light load - smoke tests, baseline |
| `tps200` | 20 | Low load - development testing |
| `tps500` | 50 | Medium load - production-like |
| `tps1000` | 100 | High load - high-traffic production |
| `tps2000` | 200 | Very high load - enterprise testing |
| `tps5000` | 500 | Extreme load - maximum capacity |

### Scenario-Based Profiles

| Profile | Description | Use Case |
|---------|-------------|----------|
| `smoke` | 1 VU, 10 iterations | Quick sanity check |
| `spike` | Sudden load increase | Test resilience to traffic spikes |
| `rampUp` | Gradual load increase | Find breaking point |
| `soak` | Extended duration (30m+) | Stability and memory leak detection |
| `stress` | Push beyond capacity | Maximum capacity testing |
| `mixed` | Combined read/write/delete | Realistic workload simulation |
| `burst` | Periodic traffic bursts | Test handling of traffic patterns |

### Running Different Profiles

```bash
# Smoke test (quick verification)
k6 run --env PROFILE=smoke databases/postgres/test.js

# Production-like load (500 TPS)
k6 run --env PROFILE=tps500 databases/postgres/test.js

# Stress test to find breaking point
k6 run --env PROFILE=stress databases/postgres/test.js

# Soak test for stability
k6 run --env PROFILE=soak databases/postgres/test.js
```

## Test Output and Results

### Console Output

During the test, k6 displays real-time metrics:

```
     data_received..................: 1.2 MB  40 kB/s
     data_sent......................: 450 kB  15 kB/s
     http_req_blocked...............: avg=12.3µs  min=2.1µs   med=5.4µs   max=1.2ms   p(95)=25µs   p(99)=150µs
     http_req_connecting............: avg=8.2µs   min=0s      med=0s      max=800µs   p(95)=15µs   p(99)=100µs
     http_req_duration..............: avg=45.2ms  min=12ms    med=38ms    max=250ms   p(95)=85ms   p(99)=150ms
       { expected_response:true }...: avg=45.2ms  min=12ms    med=38ms    max=250ms   p(95)=85ms   p(99)=150ms
     http_req_failed................: 0.00%   0 out of 10000
     http_req_receiving.............: avg=120µs   min=15µs    med=80µs    max=5ms     p(95)=300µs  p(99)=1.2ms
     http_req_sending...............: avg=45µs    min=8µs     med=25µs    max=2ms     p(95)=120µs  p(99)=500µs
     http_req_tls_handshaking.......: avg=0s      min=0s      med=0s      max=0s      p(95)=0s     p(99)=0s
     http_req_waiting...............: avg=45ms    min=12ms    med=38ms    max=250ms   p(95)=85ms   p(99)=150ms
     http_reqs......................: 10000   333.33/s
     iteration_duration.............: avg=145ms   min=50ms    med=120ms   max=500ms   p(95)=250ms  p(99)=400ms
     iterations.....................: 10000   333.33/s
     latency_ms.....................: avg=45.2ms  min=12ms    med=38ms    max=250ms   p(95)=85ms   p(99)=150ms
     read_latency_ms................: avg=35ms    min=10ms    med=30ms    max=200ms   p(95)=70ms   p(99)=120ms
     transaction_errors_total.......: 0       0/s
     transaction_success_rate.......: 100.00% 1 out of 1
     transaction....................: 10000   333.33/s
     vus............................: 50      min=50       max=50
     vus_max........................: 50      min=50       max=50
     write_latency_ms...............: avg=55ms    min=15ms    med=48ms    max=280ms   p(95)=95ms   p(99)=170ms
```

### Exporting Results

#### JSON Output
```bash
k6 run --out json=results/test-results.json databases/postgres/test.js
```

#### CSV Output
```bash
k6 run --out csv=results/test-results.csv databases/postgres/test.js
```

#### InfluxDB (for Grafana dashboards)
```bash
k6 run --out influxdb=http://localhost:8086/k6 databases/postgres/test.js
```

#### Prometheus Remote Write
```bash
k6 run --out experimental-prometheus-rw=http://localhost:9090/api/v1/write databases/postgres/test.js
```

#### Cloud Output (k6 Cloud)
```bash
k6 cloud databases/postgres/test.js
# or
k6 run --out cloud databases/postgres/test.js
```

### Summary Report

k6 generates an end-of-test summary with key metrics:

```
  █ THRESHOLDS
    latency_ms.......................: 45.2ms  (p(95) < 200ms)  PASS
    error_rate.......................: 0.00%   (rate < 1%)      PASS
    transaction_success_rate.........: 100.00% (rate > 99%)     PASS
```

## Interpreting Results

### Key Metrics

| Metric | Description | Good Value | Warning | Critical |
|--------|-------------|------------|---------|----------|
| `latency_ms` (avg) | Average response time | < 50ms | 50-200ms | > 200ms |
| `latency_ms` (p95) | 95th percentile latency | < 100ms | 100-500ms | > 500ms |
| `latency_ms` (p99) | 99th percentile latency | < 200ms | 200-1000ms | > 1000ms |
| `error_rate` | Percentage of failed requests | < 0.1% | 0.1-1% | > 1% |
| `http_reqs`/s | Requests per second | Matches target | -20% | -50% |
| `data_received` | Throughput | Consistent | Declining | Zero |

### Custom Metrics

The benchmark suite tracks additional database-specific metrics:

| Metric | Description |
|--------|-------------|
| `read_latency_ms` | Latency for read operations |
| `write_latency_ms` | Latency for write operations |
| `delete_latency_ms` | Latency for delete operations |
| `batch_latency_ms` | Latency for batch operations |
| `bytes_read_total` | Total bytes read |
| `bytes_written_total` | Total bytes written |
| `records_read_total` | Total records read |
| `records_written_total` | Total records written |
| `timeout_errors_total` | Count of timeout errors |
| `connection_errors_total` | Count of connection errors |
| `validation_errors_total` | Count of validation errors |

### Thresholds

Tests fail if thresholds are not met. Default thresholds:

- **Error rate**: Must be < 1%
- **P95 latency**: Must be < 500ms
- **P99 latency**: Must be < 1000ms
- **Success rate**: Must be > 99%

## Creating New Database Tests

To add a new database test:

1. Create a new directory under `databases/`:
   ```bash
   mkdir -p databases/mydatabase
   ```

2. Create a test script:
   ```javascript
   // databases/mydatabase/test.js
   import { getLoadProfile } from '../../options.js';
   import { generateKey, generateUser, recordSuccess, recordError } from '../../utils.js';

   // Get load profile from environment
   const profileName = __ENV.PROFILE || 'smoke';
   export const options = getLoadProfile(profileName);

   // Initialize database connection
   const db = new MyDatabase({
       host: __ENV.DB_HOST || 'localhost',
       port: parseInt(__ENV.DB_PORT || '3306'),
       // ... other config
   });

   export default function () {
       const key = generateKey('mydb');
       const user = generateUser();

       const start = Date.now();
       try {
           db.write(key, JSON.stringify(user));
           recordSuccess('write', Date.now() - start);
       } catch (e) {
           recordError('connection', 'write');
       }
   }
   ```

3. Run the test:
   ```bash
   k6 run --env PROFILE=tps500 databases/mydatabase/test.js
   ```

## Utilities Reference

### Random Data Generators

```javascript
import {
    randomString,        // Generate random string
    randomAlphanumeric,  // Generate alphanumeric string
    randomNumeric,       // Generate numeric string
    randomUUID,          // Generate UUID-like string
    randomInt,           // Generate random integer
    randomFloat,         // Generate random float
    randomBool,          // Generate random boolean
    randomChoice,        // Pick random from array
    randomTimestamp,     // Generate random ISO timestamp
    randomEmail,         // Generate random email
    randomJSON,          // Generate random JSON object
} from './utils.js';

// Usage examples
const key = randomAlphanumeric(16);
const age = randomInt(18, 80);
const price = randomFloat(10, 100, 2);
const user = generateUser();        // Generate complete user object
const reading = generateSensorReading();
const event = generateEvent();
```

### Metrics Collection

```javascript
import { recordSuccess, recordError, createTimer } from './utils.js';

// Simple recording
recordSuccess('read', duration, bytesRead, recordsRead);
recordError('timeout', 'read');

// Using timer
const timer = createTimer();
try {
    const result = db.read(key);
    timer.stop('read', result.length, 1);
} catch (e) {
    timer.stopWithError('connection', 'read');
}
```

### Configuration Helpers

```javascript
import { getConnectionConfig, getTestConfig } from './utils.js';

const conn = getConnectionConfig();
// Returns: { host, port, database, username, password, ssl, maxConnections, connectionTimeout }

const test = getTestConfig();
// Returns: { keyPrefix, valueSize, batchSize, readWriteRatio, hotKeyRatio, hotKeyCount, ... }
```

## Best Practices

1. **Start Small**: Always run a smoke test first to verify connectivity
2. **Ramp Gradually**: Use ramp-up tests before high-load tests
3. **Monitor Resources**: Watch database CPU, memory, and I/O during tests
4. **Clean State**: Ensure database is in known state before each test run
5. **Isolate Tests**: Run tests in isolated databases/schemas
6. **Document Results**: Save results with timestamps for comparison
7. **Check Thresholds**: Review threshold violations in output

## Troubleshooting

### High Error Rates
- Check database connection limits
- Verify network connectivity
- Review database logs for errors
- Increase connection timeouts

### High Latency
- Check database resource utilization
- Review query execution plans
- Consider indexing strategies
- Monitor lock contention

### Connection Errors
- Verify host/port configuration
- Check firewall rules
- Ensure database is accepting connections
- Review max_connections setting

### Memory Issues
- Reduce VU count
- Enable `discardResponseBodies`
- Use shorter test durations
- Monitor k6 memory usage

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 JavaScript API](https://k6.io/docs/javascript-api/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
- [k6 Scenarios](https://k6.io/docs/using-k6/scenarios/)
