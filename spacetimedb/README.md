# SpacetimeDB Local Setup

This directory contains a local SpacetimeDB instance configured for benchmarking real-time database performance.

## Quick Start

1. **Run the setup script:**
   ```bash
   ./setup.sh
   ```

2. **Install the SpacetimeDB CLI (if not already installed):**
   ```bash
   curl -sSf https://install.spacetimedb.com | sh
   ```

3. **Configure the CLI for local server:**
   ```bash
   spacetime server add local http://localhost:3000
   spacetime server set-default local
   ```

4. **Create an identity:**
   ```bash
   spacetime identity new --name local-user --server local
   ```

5. **Publish the benchmark module:**
   ```bash
   cd server
   spacetime publish benchmark
   ```

## Connection Details

| Setting | Value |
|---------|-------|
| HTTP Endpoint | `http://localhost:3000` |
| WebSocket URL | `ws://localhost:3000/v1/subscribe` |
| Default Module | `benchmark` |

## Docker Commands

```bash
# Start the server
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the server
docker-compose down

# Stop and remove data (start fresh)
docker-compose down -v
```

## Benchmark Module Schema

### Tables

| Table | Description |
|-------|-------------|
| `Counters` | Simple counters for read/write benchmarks |
| `Messages` | Messages for pub/sub latency tests |
| `Events` | Events for complex query benchmarks |
| `BenchmarkSessions` | Track benchmark test runs |

### Reducers

#### Counters
- `incrementCounter(counterId: string, amount: number)` - Increment a counter
- `setCounter(counterId: string, value: number)` - Set counter to specific value
- `deleteCounter(counterId: string)` - Delete a counter

#### Messages
- `addMessage(content: string, sequence: number)` - Add a message
- `deleteMessage(messageId: string)` - Delete a message
- `clearAllMessages()` - Delete all messages

#### Events
- `createEvent(eventType: string, payload: string, priority: number)` - Create an event
- `markEventProcessed(eventId: string)` - Mark event as processed
- `deleteEvent(eventId: string)` - Delete an event
- `clearProcessedEvents()` - Delete all processed events
- `batchCreateEvents(count: number, eventType: string, payloadTemplate: string)` - Batch insert events

#### Benchmark Sessions
- `startBenchmarkSession(name: string, config: string)` - Start a new benchmark session
- `endBenchmarkSession(sessionId: string)` - End a benchmark session
- `deleteBenchmarkSession(sessionId: string)` - Delete a session

#### Utilities
- `clearAllData()` - Clear all tables
- `scheduledHeartbeat()` - Scheduled heartbeat event

## CLI Commands Reference

### Server Management
```bash
# List servers
spacetime server list

# Check server status
spacetime server status local
```

### Identity Management
```bash
# List identities
spacetime identity list

# Create new identity
spacetime identity new --name my-identity --server local

# Set default identity
spacetime identity set-default <IDENTITY>
```

### Module Management
```bash
# Build module
spacetime build

# Publish module
spacetime publish benchmark

# Update module
spacetime publish --update benchmark

# Delete module
spacetime delete benchmark
```

### Querying Data
```bash
# List all counters
spacetime sql benchmark "SELECT * FROM Counters"

# List all messages
spacetime sql benchmark "SELECT * FROM Messages"

# List all events
spacetime sql benchmark "SELECT * FROM Events"

# Count records
spacetime sql benchmark "SELECT COUNT(*) FROM Events"
```

### Calling Reducers
```bash
# Increment counter
spacetime call benchmark increment_counter '["counter1", 1]'

# Add message
spacetime call benchmark add_message '["Hello World", 1]'

# Create event
spacetime call benchmark create_event '["test", "{\"data\": 123}", 5]'

# Clear all data
spacetime call benchmark clear_all_data '[]'
```

## Directory Structure

```
spacetimedb/
├── docker-compose.yml    # Docker configuration
├── setup.sh              # Setup script
├── README.md             # This file
└── server/
    ├── package.json      # Node.js dependencies
    ├── spacetime.toml    # Module configuration
    └── src/
        └── lib.ts        # Module source code
```

## Troubleshooting

### Port already in use
If port 3000 is already in use, modify the port mapping in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use port 3001 instead
```

### Permission denied on setup.sh
Make the script executable:
```bash
chmod +x setup.sh
```

### Module publish fails
Ensure you have:
1. Created an identity for the local server
2. Set the local server as default
3. Built the module successfully

### Data persistence
Data is stored in a Docker volume named `spacetimedb_data`. To start fresh:
```bash
docker-compose down -v
docker-compose up -d
```

## Resources

- [SpacetimeDB Documentation](https://spacetimedb.com/docs)
- [SpacetimeDB TypeScript SDK](https://www.npmjs.com/package/@clockworklabs/spacetimedb-sdk)
- [Docker Hub Image](https://hub.docker.com/r/clockworklabs/spacetime)
