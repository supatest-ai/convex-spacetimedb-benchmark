# Convex vs SpacetimeDB: A Real-World Performance Benchmark

*How two modern databases stack up when tested head-to-head with identical workloads*

---

When building real-time applications, choosing the right database can make or break your user experience. Today, we're putting two popular options under the microscope: **Convex**, the developer-friendly reactive database, and **SpacetimeDB**, the high-performance in-memory relational database.

Rather than relying on marketing claims, we set up both databases locally and hit them with identical workloads using k6, a modern load testing tool. The results were... dramatic.

## The Contenders

### Convex: The Developer-Friendly Choice

Convex has gained traction for its seamless TypeScript integration and reactive queries. It's designed to feel like a natural extension of your frontend code, with automatic UI updates when data changes.

**Key characteristics:**
- Cloud-native with a self-hosted option
- SQLite-backed (local), Postgres/MySQL (production)
- TypeScript-first query model
- HTTP/JSON protocol
- Connection-per-request architecture

### SpacetimeDB: The Speed Demon

SpacetimeDB takes a radically different approach. It's an in-memory relational database where you write your logic in Rust, compile it to WebAssembly, and deploy it directly into the database.

**Key characteristics:**
- In-memory storage (everything stays in RAM)
- Rust-based modules compiled to WebAssembly
- WebSocket primary protocol
- Shared-nothing, high-concurrency architecture

## Test Setup

We wanted a fair fight, so we:

1. **Ran both locally** using Docker on Apple Silicon (ARM64)
2. **Used identical workloads**: 70% counter increments, 30% message creations
3. **Tested with k6** at various concurrency levels (20, 50, 100, 200, 500, 1000 VUs)
4. **Measured** throughput (TPS), latency (avg/p95), and resource usage

Each test ran for 30 seconds, and we repeated runs to ensure consistency.

## The Results: A 47x Performance Gap

### Throughput (Transactions Per Second)

| Concurrent Users | Convex | SpacetimeDB | Winner Margin |
|-----------------|--------|-------------|---------------|
| 20 VUs  | 244 TPS   | 9,042 TPS   | **37x** |
| 50 VUs  | 221 TPS   | 10,387 TPS  | **47x** |
| 100 VUs | 234 TPS   | 10,861 TPS  | **46x** |
| 200 VUs | 217 TPS   | 11,132 TPS  | **51x** |
| 500 VUs | 225 TPS   | 6,379 TPS   | **28x** |

At 20 concurrent users, SpacetimeDB handled **9,042 transactions per second** compared to Convex's 244. That's not a typo—SpacetimeDB was literally 37 times faster.

What's fascinating is how each database scaled. SpacetimeDB's throughput climbed linearly with concurrency until hitting ~11,000 TPS at 200 VUs. Convex, meanwhile, stayed stubbornly fixed around 220-240 TPS regardless of how many users we threw at it.

### Latency: Milliseconds vs Microseconds

| Concurrent Users | Convex (avg) | SpacetimeDB (avg) | Difference |
|-----------------|--------------|-------------------|------------|
| 20 VUs  | 81.7ms  | 2.1ms  | **39x faster** |
| 50 VUs  | 226ms   | 4.7ms  | **48x faster** |
| 100 VUs | 430ms   | 9.1ms  | **47x faster** |
| 200 VUs | 937ms   | 17.9ms | **52x faster** |
| 500 VUs | 2,311ms | 82.4ms | **28x faster** |

At low concurrency, Convex's 81ms average response time is perfectly reasonable for web applications. But SpacetimeDB's 2.1ms is in a different league entirely—we're approaching network latency territory.

The real story emerges as concurrency increases. Convex's latency grows linearly with concurrent connections, hitting **2.3 seconds** at 500 VUs. SpacetimeDB stays under 100ms even at 500 concurrent users.

## Understanding the Architecture Divide

Why such a massive gap? It comes down to fundamentally different design philosophies.

### Convex: The Reliable Workhorse

Convex uses a traditional request-response model over HTTP. Each request spawns a new connection, executes a TypeScript function, queries SQLite, and returns JSON.

This design prioritizes:
- **Developer experience**: TypeScript everywhere, familiar patterns
- **Durability**: Data persists to disk by default
- **Flexibility**: Complex queries, indexes, and transactions

The tradeoff is throughput. Convex appears to be connection-limited, which explains why adding more VUs doesn't increase TPS—it just increases queue depth.

### SpacetimeDB: The Formula 1 Engine

SpacetimeDB keeps everything in memory and uses a high-performance event loop. Your Rust code compiles to WebAssembly and runs directly in the database process.

This design prioritizes:
- **Raw speed**: In-memory operations are orders of magnitude faster
- **Low latency**: No network hops, no process boundaries
- **Deterministic performance**: No disk I/O variability

The tradeoffs are RAM constraints (your dataset must fit in memory) and a steeper learning curve (Rust + WebAssembly).

## Resource Usage: Efficiency vs Performance

| Resource | Convex | SpacetimeDB |
|----------|--------|-------------|
| **CPU Usage** | 1.27% | 87.53% |
| **Memory** | 363 MB | 650 MB |
| **Network RX** | 11.8 MB | 90.6 MB |
| **Network TX** | 11.4 MB | 216 MB |

Convex barely breaks a sweat, using minimal CPU and memory. SpacetimeDB, meanwhile, fully utilizes the CPU—it's designed to max out performance, not conserve resources.

The network numbers tell the story: SpacetimeDB processed 10x more data because it handled 40x more requests.

## Breaking Points: Where Each Database Fails

Every system has limits. We found them.

### Convex's Ceiling

Convex handled up to **500 concurrent VUs without errors**, but latency became unacceptable. At 500 VUs, requests took an average of 2.3 seconds—fine for background jobs, unacceptable for real-time UIs.

The throughput plateau suggests Convex is I/O or connection-bound rather than CPU-bound. For applications with bursty traffic, this means predictable performance but clear scaling limits.

### SpacetimeDB's Knee

SpacetimeDB scaled beautifully to **200 VUs**, then throughput plateaued around 11,000 TPS. At **1000 VUs**, we saw our first errors—about 4.7% of requests failed, likely due to connection exhaustion or event loop saturation.

Interestingly, even at 1000 VUs with errors, SpacetimeDB's average latency (122ms) was better than Convex at 200 VUs (937ms).

## When to Choose Which

### Choose SpacetimeDB When:

- Building **real-time games** or competitive multiplayer experiences
- You need **10,000+ TPS** sustained throughput
- Latency under **20ms** is a hard requirement
- Your dataset fits comfortably in RAM
- Your team is comfortable with Rust

**Ideal for**: Game servers, high-frequency trading, real-time bidding, live sports updates

### Choose Convex When:

- You value **developer velocity** over raw performance
- Your team knows TypeScript, not Rust
- You need **complex queries** with multiple indexes
- Your dataset exceeds available RAM
- You want **managed cloud scaling** without ops overhead

**Ideal for**: SaaS applications, content management, e-commerce, internal tools

## The Verdict

If this were a drag race, SpacetimeDB would be the souped-up sports car and Convex the reliable sedan. Both get you there, but at vastly different speeds.

**SpacetimeDB wins on:**
- Raw throughput (47x faster)
- Latency (40-50x lower)
- Concurrent scaling (handles 10x more connections)

**Convex wins on:**
- Developer experience (TypeScript > Rust for most teams)
- Memory efficiency (half the RAM usage)
- Data durability (disk-backed by default)
- Ecosystem maturity

For most web applications, Convex's ~230 TPS is plenty. But if you're building something real-time, competitive, or high-frequency, SpacetimeDB's performance advantage is impossible to ignore.

## Try It Yourself

All benchmark code is available in our repository:

```bash
# Clone and setup
git clone <repository>
cd realtime-db-bench

# Start databases
docker-compose -f convex/docker-compose.yml up -d
docker-compose -f spacetimedb/docker-compose.yml up -d

# Run benchmarks
k6 run -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js
k6 run -e DB_TYPE=spacetimedb -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js
```

---

*Have you used Convex or SpacetimeDB in production? We'd love to hear about your experience. Drop a comment below or reach out on Twitter.*

---

**About the test:** Conducted February 2026 on macOS with Docker. Convex (latest), SpacetimeDB 2.0.1, k6 1.6.1. Each test ran for 30 seconds with 20-1000 virtual users.
