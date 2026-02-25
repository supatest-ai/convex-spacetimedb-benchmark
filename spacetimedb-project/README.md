# SpacetimeDB Benchmark Module (Rust)

A Rust-based SpacetimeDB module designed for fair performance comparison with Convex and other realtime databases.

## Project Structure

```
spacetimedb-project/
├── Cargo.toml              # Rust project configuration
├── spacetime.toml          # SpacetimeDB configuration
├── src/
│   └── lib.rs              # Main module with tables and reducers
├── deploy.sh               # Deployment script
└── README.md               # This file
```

## Prerequisites

1. **Rust** (latest stable):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **WebAssembly target**:
   ```bash
   rustup target add wasm32-unknown-unknown
   ```

3. **SpacetimeDB CLI**:
   ```bash
   cargo install spacetimedb-cli
   # or download from https://spacetimedb.com
   ```

4. **Local SpacetimeDB running** on http://127.0.0.1:3000:
   ```bash
   spacetime start
   ```

## Installation

```bash
cd /Users/prasad/realtime-db-bench/spacetimedb-project
```

## Deployment

### Quick Deploy
```bash
./deploy.sh
```

This script will:
1. Check that SpacetimeDB is running
2. Build the Rust module with cargo
3. Build the SpacetimeDB module
4. Publish it as "benchmark" to 127.0.0.1:3000

### Manual Build and Deploy
```bash
# Build the Rust module
cargo build --release --target wasm32-unknown-unknown

# Build with spacetime CLI
spacetime build

# Publish to local SpacetimeDB
spacetime publish benchmark --host 127.0.0.1:3000
```

## Module API

### Tables

#### Counters
```rust
#[table(name = Counters, public)]
pub struct Counter {
    #[primary_key]
    pub name: String,
    pub value: i64,
    pub last_updated: Timestamp,
}
```

#### Messages
```rust
#[table(name = Messages, public)]
pub struct Message {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub sender: String,
    pub content: String,
    pub channel: String,
    pub timestamp: Timestamp,
}
```

#### Events
```rust
#[table(name = Events, public)]
pub struct Event {
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    pub event_type: String,
    pub source: String,
    pub data: String,
    pub timestamp: Timestamp,
}
```

### Reducers (Mutations)

#### increment_counter
Increments a named counter by the specified amount.
```bash
spacetime call benchmark increment_counter '{"name": "page_views", "amount": 1}'
```

#### create_message
Creates a new message in a channel.
```bash
spacetime call benchmark create_message '{"sender": "alice", "content": "Hello!", "channel": "general"}'
```

#### create_event
Creates a new event log entry.
```bash
spacetime call benchmark create_event '{"event_type": "user_login", "source": "web", "data": "{\"user_id\": 123}"}'
```

### Queries

#### get_counter
Returns the current value of a counter.
```bash
spacetime call benchmark get_counter '{"name": "page_views"}'
```

#### get_messages
Returns messages from a channel (newest first).
```bash
spacetime call benchmark get_messages '{"channel": "general", "limit": 10}'
```

## Testing

### Using SpacetimeDB CLI

```bash
# 1. Increment a counter
spacetime call benchmark increment_counter '{"name": "test_counter", "amount": 5}'

# 2. Check the counter value
spacetime call benchmark get_counter '{"name": "test_counter"}'

# 3. Create some messages
spacetime call benchmark create_message '{"sender": "user1", "content": "Hello World!", "channel": "general"}'
spacetime call benchmark create_message '{"sender": "user2", "content": "Hi there!", "channel": "general"}'

# 4. Retrieve messages
spacetime call benchmark get_messages '{"channel": "general", "limit": 10}'

# 5. Create events
spacetime call benchmark create_event '{"event_type": "benchmark_start", "source": "cli", "data": "{\"timestamp\": 1234567890}"}'
```

### Using SQL Queries

You can also query the data directly using SpacetimeDB's SQL interface:

```bash
# List all counters
spacetime sql benchmark "SELECT * FROM Counters"

# List messages in a channel
spacetime sql benchmark "SELECT * FROM Messages WHERE channel = 'general' ORDER BY timestamp DESC LIMIT 10"

# Count events by type
spacetime sql benchmark "SELECT event_type, COUNT(*) FROM Events GROUP BY event_type"
```

## Benchmarking

This module is designed to be benchmarked against Convex with equivalent operations:

| Operation | Convex | SpacetimeDB |
|-----------|--------|-------------|
| Counter increment | `mutation incrementCounter` | `reducer increment_counter` |
| Create message | `mutation createMessage` | `reducer create_message` |
| Create event | `mutation createEvent` | `reducer create_event` |
| Get counter | `query getCounter` | `query get_counter` |
| Get messages | `query getMessages` | `query get_messages` |

## Connection Information

After deployment, the module is accessible at:

- **HTTP API**: `http://127.0.0.1:3000/database/benchmark`
- **WebSocket**: `ws://127.0.0.1:3000/database/benchmark`

## Development

### Making Changes

1. Edit `src/lib.rs`
2. Rebuild: `cargo build --release --target wasm32-unknown-unknown`
3. Redeploy: `./deploy.sh`

### Viewing Logs

```bash
spacetime logs benchmark
```

### Deleting the Module

```bash
spacetime delete benchmark --force
```

## Troubleshooting

### Build Errors

#### Missing WebAssembly target
```bash
rustup target add wasm32-unknown-unknown
```

#### Cargo build fails
- Ensure Rust is properly installed: `rustc --version`
- Check syntax in `src/lib.rs`

### Connection Errors
- Verify SpacetimeDB is running: `spacetime status`
- Check the host/port in `deploy.sh` matches your SpacetimeDB instance

### Module Already Exists
The deploy script handles this automatically, but manually you can:
```bash
spacetime delete benchmark --force
spacetime publish benchmark --host 127.0.0.1:3000
```

## Migration from TypeScript

This module was rewritten from TypeScript to Rust because:
- Rust is the native language for SpacetimeDB modules
- Better WebAssembly compilation support
- More stable API and tooling
- Better performance characteristics

The API remains identical to the original TypeScript version for fair benchmarking.

## License

MIT
