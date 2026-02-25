# SpacetimeDB k6 Benchmark

This directory contains k6 benchmark tests for [SpacetimeDB](https://spacetimedb.com), a real-time database with WebSocket-based subscriptions and reducer-based transactions.

## Overview

The benchmark tests three primary scenarios:

1. **Counter Increments** - Simple reducer calls with minimal payload (tests basic transaction throughput)
2. **Message Creation** - Write operations with larger payloads (tests write performance)
3. **Mixed Read/Write** - Combined operations simulating real-world usage patterns

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed (v0.45.0 or later)
- SpacetimeDB instance running locally or remotely
- SpacetimeDB module deployed with the required reducers and tables

## Quick Start

### 1. Start SpacetimeDB Locally

```bash
# Using SpacetimeDB CLI
spacetime start

# Or with Docker
docker run -p 3000:3000 clockworklabs/spacetimedb:latest
```

Default local endpoints:
- WebSocket: `ws://localhost:3000`
- HTTP API: `http://localhost:3000`

### 2. Deploy the Benchmark Module

Ensure your SpacetimeDB module includes these reducers:

```rust
// Required reducers
#[reducer]
pub fn increment(ctx: &ReducerContext, counter_id: String, amount: i64) {
    // Increment counter logic
}

#[reducer]
pub fn create_message(
    ctx: &ReducerContext,
    message_id: String,
    sender: String,
    content: String,
    timestamp: String,
) {
    // Create message logic
}

#[reducer]
pub fn create_user(
    ctx: &ReducerContext,
    id: String,
    username: String,
    email: String,
    name: String,
    age: i32,
    created_at: String,
    active: bool,
) {
    // Create user logic
}
```

And these tables:

```rust
#[table(name = counters, public)]
pub struct Counter {
    #[primary_key]
    pub id: String,
    pub value: i64,
    pub updated_at: String,
}

#[table(name = messages, public)]
pub struct Message {
    #[primary_key]
    pub id: String,
    pub sender: String,
    pub content: String,
    pub timestamp: String,
}

#[table(name = users, public)]
pub struct User {
    #[primary_key]
    pub id: String,
    pub username: String,
    pub email: String,
    pub name: String,
    pub age: i32,
    pub created_at: String,
    pub active: bool,
}
```

### 3. Run the Benchmark

```bash
# Basic run with defaults (WebSocket protocol, 500 TPS target)
k6 run test.js

# Run with specific load profile
k6 run -e LOAD_PROFILE=tps1000 test.js

# Run using HTTP API instead of WebSocket
k6 run -e USE_WEBSOCKET=false test.js

# Run against remote SpacetimeDB instance
k6 run -e SPACETIME_HOST=spacetime.example.com -e SPACETIME_PORT=443 -e SPACETIME_SSL=true test.js
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPACETIME_HOST` | `localhost` | SpacetimeDB server hostname |
| `SPACETIME_PORT` | `3000` | SpacetimeDB server port |
| `SPACETIME_DATABASE` | `benchmark` | Database name |
| `SPACETIME_IDENTITY` | (empty) | Identity token for authentication |
| `SPACETIME_TOKEN` | (empty) | Bearer token for authentication |
| `SPACETIME_SSL` | `false` | Use SSL/WSS connections |
| `USE_WEBSOCKET` | `true` | Use WebSocket (true) or HTTP (false) |
| `LOAD_PROFILE` | `tps500` | Load profile (see below) |
| `READ_WRITE_RATIO` | `0.7` | Ratio of reads to writes in mixed scenario |
| `MESSAGE_SIZE` | `1000` | Size of message content in bytes |
| `BATCH_SIZE` | `10` | Number of operations per batch |
| `COUNTER_WEIGHT` | `0.4` | Weight for counter scenario |
| `MESSAGE_WEIGHT` | `0.3` | Weight for message scenario |
| `MIXED_WEIGHT` | `0.3` | Weight for mixed scenario |

### Load Profiles

Available load profiles from `../../options.js`:

| Profile | Target VUs | Description |
|---------|------------|-------------|
| `smoke` | 1 | Quick smoke test |
| `tps100` | 10 | Light load (100 TPS) |
| `tps200` | 20 | Low load (200 TPS) |
| `tps500` | 50 | Medium load (500 TPS) |
| `tps1000` | 100 | High load (1000 TPS) |
| `tps2000` | 200 | Very high load (2000 TPS) |
| `tps5000` | 500 | Extreme load (5000 TPS) |
| `spike` | 10-200 | Sudden traffic spikes |
| `rampUp` | 50-500 | Gradual load increase |
| `soak` | 50 | Extended duration test |
| `stress` | 100-1000 | Breaking point test |
| `burst` | 20-200 | Periodic traffic bursts |
| `mixed` | 60 | Combined read/write/delete |

### Timeouts and Retries

| Variable | Default | Description |
|----------|---------|-------------|
| `SPACETIME_CONN_TIMEOUT` | `10000` | Connection timeout (ms) |
| `SPACETIME_REQ_TIMEOUT` | `30000` | Request timeout (ms) |
| `SPACETIME_PING_INTERVAL` | `30000` | WebSocket ping interval (ms) |
| `SPACETIME_MAX_RETRIES` | `3` | Maximum retry attempts |
| `SPACETIME_RETRY_DELAY` | `1000` | Delay between retries (ms) |

## Running Specific Scenarios

### Individual Scenarios

```bash
# Run only counter scenario
k6 run -e SCENARIO=counter test.js

# Run only message scenario
k6 run -e SCENARIO=message test.js

# Run batch operations test
k6 run -e SCENARIO=batch test.js

# Run WebSocket stress test
k6 run -e SCENARIO=websocketStress test.js
```

### Using k6 Scenarios Feature

Create a custom test configuration:

```javascript
// custom-test.js
import { counterScenario, messageScenario, mixedScenario } from './test.js';

export const options = {
  scenarios: {
    counters: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
      exec: 'counterScenario',
    },
    messages: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'messageScenario',
    },
  },
};

export { counterScenario, messageScenario, mixedScenario };
```

Run with:
```bash
k6 run custom-test.js
```

## Output and Metrics

### Standard Metrics

The benchmark collects standard k6 metrics:

- `http_req_duration` - HTTP request duration
- `http_reqs` - Total HTTP requests
- `vus` - Virtual users
- `iterations` - Total iterations

### Custom Metrics

SpacetimeDB-specific metrics:

| Metric | Type | Description |
|--------|------|-------------|
| `spacetime_ws_connections_total` | Counter | WebSocket connections established |
| `spacetime_ws_connection_errors_total` | Counter | WebSocket connection failures |
| `spacetime_ws_messages_sent_total` | Counter | Messages sent via WebSocket |
| `spacetime_ws_messages_received_total` | Counter | Messages received via WebSocket |
| `spacetime_ws_latency_ms` | Trend | WebSocket operation latency |
| `spacetime_reducer_calls_total` | Counter | Reducer calls executed |
| `spacetime_reducer_errors_total` | Counter | Reducer call failures |
| `spacetime_reducer_latency_ms` | Trend | Reducer call latency |
| `spacetime_table_inserts_total` | Counter | Table insert operations |
| `spacetime_table_updates_total` | Counter | Table update operations |
| `spacetime_table_deletes_total` | Counter | Table delete operations |
| `spacetime_subscription_latency_ms` | Trend | Subscription setup latency |
| `spacetime_subscription_errors_total` | Counter | Subscription errors |
| `spacetime_connection_drops_total` | Counter | Connection drops |
| `spacetime_reconnect_attempts_total` | Counter | Reconnection attempts |

### Transaction Metrics (from utils.js)

| Metric | Type | Description |
|--------|------|-------------|
| `transactions_total` | Counter | Total transactions |
| `transaction_errors_total` | Counter | Transaction errors |
| `transaction_success_rate` | Rate | Transaction success rate |
| `latency_ms` | Trend | Overall latency |
| `read_latency_ms` | Trend | Read operation latency |
| `write_latency_ms` | Trend | Write operation latency |
| `delete_latency_ms` | Trend | Delete operation latency |
| `batch_latency_ms` | Trend | Batch operation latency |
| `bytes_read_total` | Counter | Total bytes read |
| `bytes_written_total` | Counter | Total bytes written |
| `records_read_total` | Counter | Records read |
| `records_written_total` | Counter | Records written |
| `error_rate` | Rate | Overall error rate |
| `timeout_errors_total` | Counter | Timeout errors |
| `connection_errors_total` | Counter | Connection errors |
| `validation_errors_total` | Counter | Validation errors |

## Example Output

```
     █ SpacetimeDB Benchmark

       ✓ Counter increment successful
       ✓ Message creation successful
       ✓ Read operation successful
       ✓ Write operation successful

     █ Metrics

       http_req_duration..............: avg=45.23ms  min=12.1ms   med=38.5ms   max=234.5ms  p(95)=89.2ms  p(99)=156.3ms
       spacetime_reducer_latency_ms...: avg=52.1ms   min=15.2ms   med=44.3ms   max=267.8ms  p(95)=98.5ms  p(99)=178.2ms
       spacetime_ws_latency_ms........: avg=23.4ms   min=8.1ms    med=19.2ms   max=145.6ms  p(95)=45.3ms  p(99)=89.7ms
       transactions_total.............: 15432
       transaction_success_rate.......: 99.23%
       error_rate.....................: 0.77%

     █ SpacetimeDB Specific

       spacetime_ws_connections_total.......: 50
       spacetime_reducer_calls_total........: 8754
       spacetime_reducer_errors_total.......: 23
       spacetime_table_inserts_total........: 4521
       spacetime_table_updates_total........: 4233
```

## Advanced Usage

### Custom Load Profile

```bash
# Create custom profile with 75 VUs and extended duration
k6 run -e LOAD_PROFILE=tps500 \
       -e STEADY_STATE_DURATION=10m \
       test.js
```

### Authentication

```bash
# With identity and token
k6 run -e SPACETIME_IDENTITY=<identity> \
       -e SPACETIME_TOKEN=<token> \
       test.js
```

### Batch Size Testing

```bash
# Test with larger batch sizes
k6 run -e BATCH_SIZE=50 \
       -e SCENARIO=batch \
       test.js
```

### WebSocket vs HTTP Comparison

```bash
# Test WebSocket performance
echo "WebSocket Results:" > results.txt
k6 run -e USE_WEBSOCKET=true test.js >> results.txt

# Test HTTP performance
echo "HTTP Results:" >> results.txt
k6 run -e USE_WEBSOCKET=false test.js >> results.txt
```

### Output to InfluxDB/Grafana

```bash
# Send metrics to InfluxDB for Grafana visualization
k6 run --out influxdb=http://localhost:8086/k6 test.js
```

### JSON Output for Analysis

```bash
# Export detailed metrics as JSON
k6 run --out json=results.json test.js
```

## Troubleshooting

### Connection Refused

```
ERRO[0000] Failed to connect to SpacetimeDB
```

- Verify SpacetimeDB is running: `spacetime status`
- Check host and port configuration
- Ensure firewall rules allow connections

### WebSocket Upgrade Failed

```
ERRO[0000] WebSocket connection failed: unexpected response status: 404
```

- Verify database name is correct
- Check that the module is deployed
- Ensure WebSocket endpoint is accessible

### High Error Rate

- Check SpacetimeDB server logs
- Verify reducers are correctly implemented
- Adjust timeout settings if server is slow
- Reduce load if server is overwhelmed

### Memory Issues

```bash
# Reduce memory usage by discarding response bodies
k6 run -e DISCARD_RESPONSE_BODIES=true test.js
```

## File Structure

```
spacetimedb/
├── README.md           # This file
├── spacetime-api.js    # WebSocket and HTTP API helpers
└── test.js            # Main k6 test script
```

## References

- [SpacetimeDB Documentation](https://spacetimedb.com/docs)
- [k6 Documentation](https://k6.io/docs/)
- [WebSocket API](https://spacetimedb.com/docs/ws)
- [HTTP API](https://spacetimedb.com/docs/http)

## License

This benchmark script is provided as-is for testing SpacetimeDB performance.
