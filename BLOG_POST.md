# Trying Out SpacetimeDB: Testing 1000x Speed Claims with Real Benchmarks

*A hands-on look at the new database promising massive performance gains*

---

SpacetimeDB recently launched with a pretty incredible claim: **1000x faster than traditional databases**. As someone always on the lookout for better tools, I was immediately intrigued. Could this be the real deal?

Rather than just reading the docs, I decided to fire it up locally and see for myself. I also wanted a solid baseline for comparison, so I set up Convex—a database I've used and enjoyed—to run the exact same workloads.

Here's what I discovered after running 2+ million requests through both systems.

## Setting Up the Test

I wanted this to be as fair as possible:

- **Both databases running locally** via Docker (no cloud variables)
- **Identical workloads**: 70% counter increments, 30% message creations
- **Same hardware**: Apple Silicon Mac
- **k6 for load testing** at various concurrency levels (20 to 1000 virtual users)

No network latency excuses, no cherry-picked scenarios. Just raw performance head-to-head.

## The Results: Really Impressive

SpacetimeDB delivered **47x the throughput** of a traditional database in my tests. While that's short of the 1000x marketing claim, it's still a massive leap—and the latency numbers are where things get really interesting.

### Throughput (Transactions Per Second)

| Concurrent Users | Convex | SpacetimeDB | Speedup |
|-----------------|--------|-------------|---------|
| 20 VUs  | 244 TPS   | 9,042 TPS   | **37x** |
| 50 VUs  | 221 TPS   | 10,387 TPS  | **47x** |
| 100 VUs | 234 TPS   | 10,861 TPS  | **46x** |
| 200 VUs | 217 TPS   | 11,132 TPS  | **51x** |

At 200 concurrent users, SpacetimeDB hit **11,132 transactions per second**. Convex topped out around **234 TPS**—and notably, couldn't push past ~230 TPS regardless of how many users I added.

### Latency: The Game-Changer

Throughput is nice, but latency is what users actually feel:

| Concurrent Users | Convex | SpacetimeDB | Improvement |
|-----------------|--------|-------------|-------------|
| 20 VUs  | 81.7ms  | 2.1ms  | **39x faster** |
| 100 VUs | 430ms   | 9.1ms  | **47x faster** |
| 200 VUs | 937ms   | 17.9ms | **52x faster** |
| 500 VUs | 2,311ms | 82.4ms | **28x faster** |

That **2.1ms average response time** at low concurrency? That's not just fast—that's "your database is no longer the bottleneck" fast. We're talking about the kind of performance that makes real-time collaboration, competitive multiplayer games, and high-frequency updates feel effortless.

## Why It's So Much Faster

The performance gap comes down to a fundamentally different architecture:

### How Convex Works

Convex follows a familiar, battle-tested pattern: HTTP requests → TypeScript functions → SQLite queries → JSON responses. It's predictable, developer-friendly, and works great for most web applications.

The tradeoff is that it appears connection-bound—adding more concurrent users just increases queue depth rather than throughput.

### How SpacetimeDB Works

SpacetimeDB takes a radically different approach:

- **Everything in memory**: No disk I/O, no buffer pool management
- **WebAssembly modules**: Your Rust code compiles to WASM and runs inside the database process
- **Event-loop concurrency**: Similar to Node.js or Redis—single-threaded but non-blocking
- **No network hops**: WebSocket connection, reducers execute in-process

The catch? Your entire dataset must fit in RAM. For many applications, that's a dealbreaker. But if your data fits, the performance is genuinely extraordinary.

## Where Each Database Shines

### SpacetimeDB Excels At:

- **Real-time games** and competitive multiplayer
- **High-throughput applications** (10,000+ TPS)
- **Low-latency requirements** (sub-20ms)
- **Data that fits in memory**
- **Teams comfortable with Rust**

### Convex Excels At:

- **Rapid development** with TypeScript
- **Complex queries** with multiple indexes
- **Large datasets** that exceed RAM
- **Managed cloud scaling** without ops overhead
- **Teams that prioritize developer velocity**

## The Breaking Points

I wanted to find where each system starts to struggle:

**Convex** handled up to 500 concurrent users without errors, but latency climbed to 2.3 seconds. Throughput stayed capped at ~234 TPS. Reliable and predictable, with clear scaling limits.

**SpacetimeDB** scaled beautifully to 200 users, peaked around 11,000 TPS, then started showing errors at 1000 users (about 4.7% failure rate). Higher ceiling, but you feel it when you hit the limit.

Interestingly, even with errors at 1000 VUs, SpacetimeDB's average latency (122ms) was still better than Convex at 200 VUs (937ms).

## Understanding the 1000x Claim

So where does the 1000x number come from? I think SpacetimeDB is comparing against cloud-hosted databases with network round-trips (20-50ms), connection pooling overhead, and disk I/O. Against that baseline, sub-millisecond responses could theoretically hit 1000x in specific microbenchmarks.

In my local test (no network latency), **47x** is the honest number. And honestly? That's still remarkable.

## Resource Usage

| Resource | Convex | SpacetimeDB |
|----------|--------|-------------|
| **CPU Usage** | 1.27% | 87.53% |
| **Memory** | 363 MB | 650 MB |

Convex barely breaks a sweat. SpacetimeDB maxes out the CPU. This tells the whole story: Convex is I/O bound and waiting, SpacetimeDB is compute-bound and working hard.

## Try It Yourself

Want to run your own tests? Everything is open source:

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

All code, configs, and raw results are in the repo.

## Final Thoughts

SpacetimeDB is genuinely impressive. The 47x speedup I measured isn't marketing fluff—it's real performance that changes what's possible. Sub-2ms database operations open up new categories of applications.

Is it 1000x faster? Not in my tests. But 47x with 2ms latency? That's still a game-changer for the right use cases.

For game developers building real-time multiplayer, this might be exactly what you've been waiting for. For everyone else, it's a fascinating example of what happens when you reimagine database architecture from scratch.

I'm excited to see how SpacetimeDB evolves. The foundation is solid, and the performance is real.

---

*Have you tried SpacetimeDB or Convex? I'd love to hear about your experience—drop a comment or find me on Twitter.*

---

**About this test:** Conducted February 2026 on macOS with Docker. Tested Convex (latest) vs SpacetimeDB 2.0.1 using k6. Each test ran for 30 seconds with 20-1000 virtual users. Total requests processed: 2,000,000+.
