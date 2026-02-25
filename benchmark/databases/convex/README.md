# Convex Database k6 Benchmark

This directory contains k6 load testing scripts for benchmarking Convex database HTTP Actions.

## Overview

These benchmarks test Convex's HTTP API performance using three scenarios:

1. **Counter Increments** - Write-heavy workload testing simple atomic increments
2. **Message Creation** - Write operations with larger payloads (500-5000 bytes)
3. **Mixed Read/Write** - Realistic workload combining queries and mutations

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) installed
- Convex running locally or accessible via HTTP

## Quick Start

### 1. Start Convex Locally

```bash
# In your Convex project directory
npx convex dev
```

Convex will start on:
- HTTP Actions: http://localhost:3210
- Admin Dashboard: http://localhost:3211

### 2. Run the Benchmark

```bash
# From the benchmark directory
cd /Users/prasad/realtime-db-bench/benchmark/databases/convex

# Run with default settings (tps500 profile)
k6 run test.js

# Run with custom load profile
k6 run -e LOAD_PROFILE=tps1000 test.js

# Run against remote Convex deployment
k6 run -e CONVEX_HOST=your-deployment.convex.site -e CONVEX_ADMIN_KEY=your-key test.js
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CONVEX_HOST` | `localhost` | Convex server hostname |
| `CONVEX_PORT` | `3210` | Convex HTTP port |
| `CONVEX_ADMIN_PORT` | `3211` | Convex admin/dashboard port |
| `CONVEX_ADMIN_KEY` | `test-admin-key` | Admin key for authentication |
| `CONVEX_SITE_URL` | - | Site URL for CORS headers |
| `LOAD_PROFILE` | `tps500` | Load profile (see below) |
| `READ_WRITE_RATIO` | `0.7` | Ratio of reads to writes in mixed scenario |
| `CONVEX_MAX_RETRIES` | `3` | Max retries for failed requests |
| `CONVEX_TIMEOUT` | `30s` | Request timeout |

### Action Path Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `CONVEX_ACTION_INCREMENT` | `counter/increment` | Path for counter increment action |
| `CONVEX_ACTION_GET_COUNTER` | `counter/get` | Path for counter get action |
| `CONVEX_ACTION_CREATE_MESSAGE` | `messages/create` | Path for message creation action |
| `CONVEX_ACTION_GET_MESSAGES` | `messages/list` | Path for message list action |
| `CONVEX_ACTION_MIXED` | `benchmark/mixed` | Path for mixed operations action |

### Load Profiles

Available profiles from `../../options.js`:

| Profile | Target VUs | Duration | Use Case |
|---------|-----------|----------|----------|
| `smoke` | 1 | 10 iterations | Quick verification |
| `tps100` | 10 | 5m+ | Light load testing |
| `tps500` | 50 | 5m+ | Medium load (default) |
| `tps1000` | 100 | 5m+ | High load testing |
| `tps2000` | 200 | 10m+ | Very high load |
| `tps5000` | 500 | 10m+ | Extreme load |
| `spike` | 10-200 | ~4m | Spike testing |
| `soak` | 50 | 30m+ | Stability testing |
| `stress` | 100-1000 | ~35m | Breaking point analysis |

## Example Commands

### Basic Load Test
```bash
k6 run -e LOAD_PROFILE=tps500 test.js
```

### Smoke Test (Quick Verification)
```bash
k6 run -e LOAD_PROFILE=smoke test.js
```

### High Load Test
```bash
k6 run -e LOAD_PROFILE=tps1000 -e CONVEX_MAX_RETRIES=5 test.js
```

### Custom Read/Write Ratio
```bash
# 80% reads, 20% writes
k6 run -e READ_WRITE_RATIO=0.8 -e LOAD_PROFILE=tps500 test.js
```

### Stress Test with Extended Timeout
```bash
k6 run -e LOAD_PROFILE=stress -e CONVEX_TIMEOUT=60s test.js
```

### Remote Deployment
```bash
k6 run \
  -e CONVEX_HOST=your-app.convex.site \
  -e CONVEX_PORT=443 \
  -e CONVEX_ADMIN_KEY=sk_prod_... \
  -e LOAD_PROFILE=tps500 \
  test.js
```

## Required Convex Actions

To run these benchmarks, your Convex project needs the following HTTP actions defined:

### 1. Counter Increment Action

```typescript
// convex/counter.ts
import { httpAction } from "./_generated/server";

export const increment = httpAction(async (ctx, request) => {
  const { name, amount = 1, initialize = false } = await request.json();

  // Your counter logic here
  // Example: Update a counter document in the database

  return new Response(JSON.stringify({
    success: true,
    name,
    value: newValue,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 2. Message Creation Action

```typescript
// convex/messages.ts
import { httpAction } from "./_generated/server";

export const create = httpAction(async (ctx, request) => {
  const { message } = await request.json();

  // Store the message in the database
  // Example: await ctx.db.insert("messages", message);

  return new Response(JSON.stringify({
    success: true,
    id: message.id,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});

export const list = httpAction(async (ctx, request) => {
  const { limit = 10, offset = 0 } = await request.json();

  // Query messages from the database
  // Example: const messages = await ctx.db.query("messages").take(limit);

  return new Response(JSON.stringify({
    messages: [],
    total: 0,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

### 3. Mixed Operations Action

```typescript
// convex/benchmark.ts
import { httpAction } from "./_generated/server";

export const mixed = httpAction(async (ctx, request) => {
  const { operation, id, data, updates } = await request.json();

  switch (operation) {
    case "read":
      // Handle read
      break;
    case "create":
      // Handle create
      break;
    case "update":
      // Handle update
      break;
    case "delete":
      // Handle delete
      break;
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
```

## Metrics

The benchmark collects the following metrics:

### Scenario-Specific Metrics

| Metric | Description |
|--------|-------------|
| `convex_counter_increments_total` | Total counter increment operations |
| `convex_counter_increment_latency_ms` | Latency distribution for increments |
| `convex_messages_created_total` | Total messages created |
| `convex_message_creation_latency_ms` | Latency distribution for message creation |
| `convex_message_size_bytes` | Distribution of message payload sizes |
| `convex_mixed_operations_total` | Total mixed operations |
| `convex_mixed_operation_latency_ms` | Latency distribution for mixed ops |

### Operation Type Metrics

| Metric | Description |
|--------|-------------|
| `convex_read_operations_total` | Total read operations |
| `convex_write_operations_total` | Total write (create) operations |
| `convex_update_operations_total` | Total update operations |
| `convex_delete_operations_total` | Total delete operations |

### General Convex Metrics

| Metric | Description |
|--------|-------------|
| `convex_http_errors_total` | Total HTTP errors |
| `convex_auth_errors_total` | Authentication errors |
| `convex_rate_limit_hits_total` | Rate limit hits |
| `convex_mutation_success_rate` | Mutation success rate |
| `convex_query_success_rate` | Query success rate |

### Standard k6 Metrics

- `http_req_duration` - HTTP request duration
- `http_reqs` - Total HTTP requests
- `http_req_failed` - Failed HTTP requests
- `vus` - Virtual users
- `iterations` - Total iterations

## Output

The benchmark produces a JSON summary at the end:

```json
{
  "metadata": {
    "database": "Convex",
    "target": "http://localhost:3210",
    "timestamp": "2024-01-15T10:30:00Z",
    "loadProfile": "tps500"
  },
  "scenarios": {
    "counterIncrements": {
      "total": 15000,
      "errors": 0,
      "avgLatency": 45.2,
      "p95Latency": 89.5
    },
    "messageCreations": {
      "total": 5000,
      "errors": 2,
      "avgLatency": 156.3,
      "p95Latency": 298.1
    },
    "mixedOperations": {
      "total": 10000,
      "reads": 7000,
      "writes": 2000,
      "updates": 800,
      "deletes": 200
    }
  }
}
```

## Troubleshooting

### Connection Refused

Ensure Convex is running:
```bash
curl http://localhost:3210/health
```

### 404 Errors

Verify your action paths match the Convex project configuration. Check the `CONVEX_ACTION_*` environment variables.

### Authentication Errors

If using a production Convex deployment, ensure the `CONVEX_ADMIN_KEY` is set correctly.

### High Error Rates

- Increase `CONVEX_TIMEOUT` for slower operations
- Increase `CONVEX_MAX_RETRIES` for transient failures
- Reduce load profile (e.g., use `tps200` instead of `tps1000`)
- Check Convex server logs for errors

## File Structure

```
benchmark/databases/convex/
├── convex-api.js    # Helper functions for Convex HTTP API
├── test.js          # Main k6 test script
└── README.md        # This file
```

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [Convex HTTP Actions](https://docs.convex.dev/functions/http-actions)
- [Convex Documentation](https://docs.convex.dev/)
