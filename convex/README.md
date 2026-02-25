# Convex Local Development Setup

This directory contains a Docker-based local Convex database setup for benchmarking.

## Quick Start

Run the setup script to start all services:

```bash
./setup.sh
```

This will:
- Start the Convex backend and dashboard containers
- Generate an admin key
- Output connection details

## Services

| Service | URL | Description |
|---------|-----|-------------|
| Backend | http://localhost:3210 | Convex backend API |
| Site | http://localhost:3211 | Convex site URL |
| Dashboard | http://localhost:6791 | Web dashboard for data exploration |

## Connection URLs

### HTTP API
```
http://localhost:3210
```

### Admin Key
The admin key is generated during setup and saved to `.env`. To view it:
```bash
cat .env
```

### Environment Variables
```bash
export CONVEX_URL=http://localhost:3210
export CONVEX_ADMIN_KEY=<your-admin-key>
```

## Schema

The `schema.ts` file defines three tables for benchmark testing:

### counters
Simple increment operations (read-modify-write patterns).
- `name`: string (indexed)
- `value`: number
- `lastUpdated`: number (timestamp)

### messages
Write-heavy workload with high-frequency inserts.
- `content`: string
- `sender`: string (indexed)
- `channel`: string (indexed)
- `timestamp`: number (indexed)
- `metadata`: optional object with priority and tags

### events
Time-series-like data for range queries.
- `type`: string (indexed)
- `source`: string (indexed)
- `timestamp`: number (indexed)
- `data`: object with value and unit
- `tags`: optional array of strings

## Dashboard Access

Open http://localhost:6791 in your browser to access the Convex dashboard.

The dashboard allows you to:
- View and query data in all tables
- Run ad-hoc queries
- Monitor real-time updates
- Inspect schema and indexes

## Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove data (WARNING: deletes all data)
docker-compose down -v

# Restart with fresh data
docker-compose down -v && docker-compose up -d
```

## Data Persistence

Data is persisted in a Docker volume named `convex-data`. To reset the database:

```bash
docker-compose down -v
```

## Troubleshooting

### Port Conflicts
If ports 3210, 3211, or 6791 are already in use, modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "<new-port>:3210"
```

### Container Won't Start
Check the logs for errors:
```bash
docker-compose logs convex-backend
docker-compose logs convex-dashboard
```

### Connection Refused
Ensure the backend is healthy before connecting:
```bash
curl http://localhost:3210/version
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Dashboard     │────▶│  Backend API    │◄────│   Your Client   │
│  (port 6791)    │     │  (port 3210)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │  convex-data    │
                        │  (Docker volume)│
                        └─────────────────┘
```
