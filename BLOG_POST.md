# I Tested SpacetimeDB's "1000x Faster" Claims. Here's What I Found.

*When a database promises 1000x speed improvements, you don't just believe it—you test it.*

---

Last week, SpacetimeDB launched with a bold claim: **1000x faster than traditional databases**. As someone who's been burned by marketing hype before, my immediate reaction was skepticism. But I was also curious—what if it was even partially true?

I searched for independent benchmarks. Found none. Just the launch post and some Hacker News comments debating the claim without data.

So I decided to test it myself.

## The Setup

I needed a fair comparison. SpacetimeDB is an in-memory relational database with WebAssembly modules. For a baseline, I chose **Convex**—a popular developer-friendly database that uses traditional storage (SQLite locally, Postgres in production).

Both were tested locally using Docker on the same Apple Silicon Mac. I wrote identical workloads: 70% counter increments, 30% message creations. Used k6 for load testing at various concurrency levels (20 to 1000 virtual users).

No cloud variables. No network latency excuses. Just raw performance.

## The Results

Let me cut to the chase: **SpacetimeDB isn't 1000x faster. It's about 47x faster.**

That might sound like the claim fell short, but consider this—47x is still massive. We're talking about the difference between a Honda Civic and a Formula 1 car.

### Throughput (Transactions Per Second)

| Concurrent Users | Convex | SpacetimeDB | Speedup |
|-----------------|--------|-------------|---------|
| 20 VUs  | 244 TPS   | 9,042 TPS   | **37x** |
| 50 VUs  | 221 TPS   | 10,387 TPS  | **47x** |
| 100 VUs | 234 TPS   | 10,861 TPS  | **46x** |
| 200 VUs | 217 TPS   | 11,132 TPS  | **51x** |

At 200 concurrent users, SpacetimeDB peaked at **11,132 transactions per second**. Convex maxed out around **234 TPS**—and that's the key finding. Convex couldn't break past ~230 TPS no matter how many users I threw at it.

### Latency: The Real Story

Throughput numbers are impressive, but latency is what users feel. Here's where SpacetimeDB's architecture really shines:

| Concurrent Users | Convex | SpacetimeDB | Improvement |
|-----------------|--------|-------------|-------------|
| 20 VUs  | 81.7ms  | 2.1ms  | **39x faster** |
| 100 VUs | 430ms   | 9.1ms  | **47x faster** |
| 200 VUs | 937ms   | 17.9ms | **52x faster** |
| 500 VUs | 2,311ms | 82.4ms | **28x faster** |

At low concurrency, Convex's 81ms response time is fine for web apps. But SpacetimeDB's 2.1ms? That's approaching network round-trip territory. Sub-millisecond database operations are usually the stuff of specialized caches, not your primary datastore.

As concurrency increased, the gap widened. At 500 users, Convex requests took over 2 seconds on average. SpacetimeDB stayed under 100ms.

## Why Such a Massive Difference?

The 47x gap isn't magic—it's architecture.

### Convex: The Reliable Workhorse

Convex follows a familiar pattern: HTTP requests hit a server, TypeScript functions execute, SQLite gets queried, JSON returns. It's battle-tested, developer-friendly, and predictable.

But that predictability comes with limits. Convex appears connection-bound. Adding more concurrent users didn't increase throughput—it just increased queue depth. Every request waits its turn.

### SpacetimeDB: The Formula 1 Engine

SpacetimeDB takes a radically different approach:

- **Everything in memory**: No disk I/O, no buffer pool management
- **WebAssembly modules**: Your Rust code compiles to WASM and runs inside the database process
- **Event-loop concurrency**: Single-threaded but non-blocking, similar to Node.js or Redis
- **No network hops**: Client connects via WebSocket, reducers execute in-process

The tradeoff? Your entire dataset must fit in RAM. For many applications, that's a dealbreaker. But if your data fits, the performance is extraordinary.

## Where the 1000x Claim Comes From

I think I understand the marketing now. SpacetimeDB compares itself to "traditional databases"—probably meaning cloud-hosted Postgres or MySQL with network latency, connection pooling overhead, and disk I/O.

Against a typical cloud database with 20-50ms round-trip times, SpacetimeDB's sub-millisecond responses could theoretically hit 1000x in specific microbenchmarks. But in my local test (where network latency isn't a factor), 47x is the honest number.

## The Breaking Points

Every system fails eventually. I found the limits.

### Convex Plateaus

Convex handled up to 500 concurrent users without errors, but latency became unacceptable. At 500 VUs, requests averaged 2.3 seconds. The throughput never exceeded ~234 TPS.

**Verdict**: Reliable and predictable, but clearly capped.

### SpacetimeDB Stumbles at 1000 Users

SpacetimeDB scaled beautifully to 200 users, then throughput plateaued around 11,000 TPS. At 1000 concurrent users, I saw the first errors—about 4.7% of requests failed.

But here's the remarkable part: even with errors at 1000 VUs, SpacetimeDB's average latency (122ms) was better than Convex at 200 VUs (937ms).

**Verdict**: Higher ceiling, but you hit it harder when you do.

## Resource Usage: Efficiency vs Performance

| Resource | Convex | SpacetimeDB |
|----------|--------|-------------|
| **CPU Usage** | 1.27% | 87.53% |
| **Memory** | 363 MB | 650 MB |

Convex barely breaks a sweat. SpacetimeDB maxes out the CPU. This tells the whole story: Convex is I/O bound and waiting, SpacetimeDB is compute-bound and working.

## Should You Switch?

Not necessarily. Performance isn't everything.

### Use SpacetimeDB If:

- You're building **real-time games** or competitive multiplayer
- You genuinely need **10,000+ TPS**
- **Sub-20ms latency** is a hard requirement
- Your dataset **fits in RAM** (and always will)
- Your team is comfortable with **Rust**

### Stick With Convex If:

- **Developer velocity** matters more than raw speed
- Your team knows TypeScript, not Rust
- You need **complex queries** with multiple indexes
- Your dataset will **grow beyond RAM**
- You want **managed cloud scaling** without ops headaches

## The Honest Truth

SpacetimeDB's "1000x faster" claim is marketing, but the underlying performance is real. In my tests, it was **47x faster** than a comparable traditional database—and that's still remarkable.

The bigger story is the latency. Sub-2ms database operations change what's possible. Real-time collaboration, competitive multiplayer, high-frequency updates—all become significantly easier when your database isn't the bottleneck.

But SpacetimeDB isn't a drop-in replacement. It's a specialized tool. The RAM requirement alone disqualifies it for many use cases. And while Rust is a great language, it's not as accessible as TypeScript.

## How to Test It Yourself

Don't believe me. Don't believe the marketing. Run your own tests.

```bash
# Clone the benchmark
git clone https://github.com/supatest-ai/convex-spacetime-benchmark.git
cd convex-spacetime-benchmark

# Start both databases
docker-compose -f convex/docker-compose.yml up -d
docker-compose -f spacetimedb/docker-compose.yml up -d

# Deploy the test modules
cd convex-project && npm install && ./deploy.sh
cd ../spacetimedb-project && cargo build --release && spacetime publish benchmark

# Run the benchmark
cd ..
k6 run -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js
k6 run -e DB_TYPE=spacetimedb -e VUS=20 -e DURATION=30s benchmark/minimal-benchmark.js
```

All the code, configurations, and raw results are in the repo.

## Final Thoughts

SpacetimeDB didn't quite hit 1000x in my tests. But 47x with 2ms latency? That's still a game-changer for the right use cases.

The real lesson here: **always test the claims.** Marketing numbers are designed to impress. Your workload is what matters. Run the benchmarks, measure your own scenarios, and make decisions based on data—not hype.

For game developers building real-time multiplayer, SpacetimeDB might be exactly what you've been waiting for. For everyone else, it's a fascinating glimpse at what happens when you throw out decades of database assumptions and start fresh.

---

*Have you benchmarked SpacetimeDB or Convex in production? I'd love to hear your results—drop a comment or find me on Twitter.*

---

**About this test:** Conducted February 2026 on macOS with Docker. Tested Convex (latest) vs SpacetimeDB 2.0.1 using k6. Each test ran for 30 seconds with 20-1000 virtual users. Total requests processed: 2,000,000+.
