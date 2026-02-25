# Convex vs SpacetimeDB Benchmark

A comprehensive performance benchmark comparing [Convex](https://convex.dev) and [SpacetimeDB](https://spacetimedb.com) databases using identical workloads.

## Overview

This repository contains a head-to-head performance comparison of two modern databases:
- **Convex**: A developer-friendly reactive database with TypeScript integration
- **SpacetimeDB**: A high-performance in-memory relational database with WebAssembly modules

## Key Results

| Metric | Convex | SpacetimeDB | Winner |
|--------|--------|-------------|--------|
| **Peak Throughput** | ~234 TPS | ~11,132 TPS | SpacetimeDB (47x) |
| **Latency (20 VUs)** | 81.7ms avg | 2.1ms avg | SpacetimeDB (39x faster) |
| **Latency (200 VUs)** | 937ms avg | 17.9ms avg | SpacetimeDB (52x faster) |
| **Memory Usage** | ~363 MB | ~650 MB | Convex |
| **CPU Usage** | ~1.3% | ~87.5% | Different architectures |

Read the full [benchmark report](./BENCHMARK_REPORT.md) or the [blog post](./BLOG_POST.md).

## Quick Start

### Prerequisites

- Docker and Docker Compose
- [k6](https://k6.io/docs/get-started/installation/) for load testing
- Node.js 18+ (for Convex project)
- Rust (for SpacetimeDB project)
- [SpacetimeDB CLI](https://spacetimedb.com/docs/getting-started)

### Start the Databases

```bash
# Start Convex
docker-compose -f convex/docker-compose.yml up -d

# Start SpacetimeDB
docker-compose -f spacetimedb/docker-compose.yml up -d
```

### Deploy the Benchmark Modules

**Convex:**
```bash
cd convex-project
npm install
./deploy.sh
```

**SpacetimeDB:**
```bash
cd spacetimedb-project
# Install SpacetimeDB CLI if not already installed
curl -sSf https://install.spacetimedb.com | sh
# Build and deploy
cargo build --release --target wasm32-unknown-unknown
spacetime publish benchmark
```

### Run Benchmarks

```bash
# Test Convex (default)
k6 run -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js

# Test SpacetimeDB
k6 run -e DB_TYPE=spacetimedb -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js

# Scale up testing
k6 run -e VUS=100 -e DURATION=60s benchmark/minimal-benchmark.js
```

## Repository Structure

```
.
├── benchmark/                  # k6 benchmark scripts
│   ├── minimal-benchmark.js   # Main benchmark script
│   ├── simple-benchmark.js    # Alternative benchmark
│   ├── utils.js               # Shared utilities
│   ├── options.js             # Load profiles
│   └── databases/             # Database-specific tests
│       ├── convex/
│       └── spacetimedb/
├── convex/                     # Convex Docker setup
│   ├── docker-compose.yml
│   └── schema.ts
├── convex-project/             # Convex application code
│   ├── convex/
│   │   ├── actions.ts         # HTTP actions
│   │   ├── http.ts            # HTTP router
│   │   ├── schema.ts          # Database schema
│   │   ├── queries.ts         # Query functions
│   │   └── mutations.ts       # Mutation functions
│   ├── deploy.sh
│   └── package.json
├── spacetimedb/                # SpacetimeDB Docker setup
│   ├── docker-compose.yml
│   └── server/                # Server module (TypeScript)
├── spacetimedb-project/        # SpacetimeDB Rust module
│   ├── src/
│   │   └── lib.rs             # Rust module code
│   ├── Cargo.toml
│   ├── spacetime.toml
│   └── deploy.sh
├── BENCHMARK_REPORT.md         # Detailed benchmark results
└── BLOG_POST.md               # Blog post version
```

## API Endpoints

### Convex

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/increment` | POST | Increment a counter |
| `/api/message` | POST | Create a message |
| `/api/counter?name={name}` | GET | Get counter value |
| `/api/messages` | GET | List messages |

### SpacetimeDB

| Reducer | Description |
|---------|-------------|
| `increment_counter` | Increment a counter |
| `create_message` | Create a message |
| `create_event` | Create an event |

## Test Methodology

- **Workload**: 70% counter increments, 30% message creations
- **Duration**: 30 seconds per test
- **Metrics**: Throughput (TPS), latency (avg/p95), error rate
- **Concurrency**: Tested at 20, 50, 100, 200, 500, and 1000 VUs

## Results Summary

### Throughput at Different Concurrency Levels

| VUs | Convex (TPS) | SpacetimeDB (TPS) |
|-----|--------------|-------------------|
| 20  | 244          | 9,042             |
| 50  | 221          | 10,387            |
| 100 | 234          | 10,861            |
| 200 | 217          | 11,132            |
| 500 | 225          | 6,379             |

### Latency Comparison

| VUs | Convex (avg) | SpacetimeDB (avg) |
|-----|--------------|-------------------|
| 20  | 81.7ms       | 2.1ms             |
| 100 | 430ms        | 9.1ms             |
| 200 | 937ms        | 17.9ms            |
| 500 | 2,311ms      | 82.4ms            |

## Architecture Differences

### Convex
- **Storage**: SQLite (local), Postgres/MySQL (production)
- **Query Model**: TypeScript functions
- **Protocol**: HTTP/JSON
- **Concurrency**: Connection-per-request

### SpacetimeDB
- **Storage**: In-memory (all data in RAM)
- **Query Model**: Rust compiled to WebAssembly
- **Protocol**: WebSocket (primary), HTTP for reducer calls
- **Concurrency**: High-performance event loop

## When to Use Which

### Choose SpacetimeDB when:
- Building real-time games or competitive multiplayer
- You need 10,000+ TPS sustained throughput
- Latency under 20ms is critical
- Your dataset fits in RAM
- Your team is comfortable with Rust

### Choose Convex when:
- Developer velocity is a priority
- Your team knows TypeScript
- You need complex queries with indexes
- Your dataset exceeds available RAM
- You want managed cloud scaling

## Contributing

Feel free to open issues or PRs if you find ways to improve the benchmark fairness or accuracy.

## License

MIT

## Acknowledgments

- [Convex](https://convex.dev) for the excellent developer experience
- [SpacetimeDB](https://spacetimedb.com) for pushing performance boundaries
- [k6](https://k6.io) for the modern load testing framework
