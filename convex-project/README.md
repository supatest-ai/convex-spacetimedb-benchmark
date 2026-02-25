# Convex Benchmark Project

This is a Convex project designed for benchmarking real-time database operations. It provides HTTP endpoints for counter increments, message creation, and data retrieval.

## Project Structure

```
convex-project/
├── convex/
│   ├── schema.ts      # Database schema (counters, messages, events)
│   ├── actions.ts     # HTTP actions for business logic
│   ├── queries.ts     # Database queries
│   ├── mutations.ts   # Database mutations
│   └── http.ts        # HTTP route definitions
├── package.json       # Node.js dependencies
├── tsconfig.json      # TypeScript configuration
├── deploy.sh          # Deployment script for local Convex
├── .env               # Environment variables
└── README.md          # This file
```

## Schema

The project uses three tables:

### counters
- `name` (string): Counter identifier
- `value` (number): Current counter value
- `lastUpdated` (number): Timestamp in milliseconds

### messages
- `content` (string): Message content
- `sender` (string): Message sender
- `channel` (string): Channel name
- `timestamp` (number): Timestamp in milliseconds
- `metadata` (optional): Priority and tags

### events
- `type` (string): Event type
- `source` (string): Event source
- `timestamp` (number): Timestamp in milliseconds
- `data` (object): Value and unit
- `tags` (optional): Array of tags

## Installation

```bash
# Install dependencies
npm install
```

## Deployment

### Local Deployment

Make sure you have a local Convex instance running on `http://localhost:3210` and `http://localhost:3211`.

```bash
# Deploy to local Convex
./deploy.sh
```

Or manually:

```bash
# Set environment variables
export CONVEX_ADMIN_KEY=829e0a15ced90e41177fb7efdea27109727d2a8e0ff68ccd68fd9e61b2764b90
export CONVEX_URL=http://localhost:3210

# Deploy
npx convex deploy --url http://localhost:3210 --admin-key $CONVEX_ADMIN_KEY
```

## HTTP API Endpoints

All endpoints are available at `http://localhost:3211`.

### POST /api/increment

Increment a counter by name. Creates the counter if it doesn't exist.

**Request:**
```bash
curl -X POST http://localhost:3211/api/increment \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "test-counter",
    "amount": 1
  }'
```

**Response:**
```json
{
  "success": true,
  "name": "test-counter",
  "value": 1,
  "lastUpdated": 1704067200000
}
```

### POST /api/message

Create a new message.

**Request:**
```bash
curl -X POST http://localhost:3211/api/message \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Hello World",
    "sender": "user1",
    "channel": "general",
    "metadata": {
      "priority": 1,
      "tags": ["important", "announcement"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "id": "k57e...",
  "timestamp": 1704067200000
}
```

### GET /api/counter/:name

Get a counter by name.

**Request:**
```bash
curl http://localhost:3211/api/counter/test-counter
```

**Response (success):**
```json
{
  "success": true,
  "name": "test-counter",
  "value": 5,
  "lastUpdated": 1704067200000
}
```

**Response (not found):**
```json
{
  "success": false,
  "name": "test-counter",
  "error": "Counter not found"
}
```

### GET /api/messages

Get messages with optional filtering.

**Query Parameters:**
- `channel` (optional): Filter by channel name
- `sender` (optional): Filter by sender
- `limit` (optional): Maximum number of messages (default: 100)

**Request:**
```bash
# Get all messages (limited to 100)
curl http://localhost:3211/api/messages

# Get messages by channel
curl 'http://localhost:3211/api/messages?channel=general'

# Get messages by sender with limit
curl 'http://localhost:3211/api/messages?sender=user1&limit=10'
```

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "_id": "k57e...",
      "_creationTime": 1704067200000,
      "content": "Hello World",
      "sender": "user1",
      "channel": "general",
      "timestamp": 1704067200000,
      "metadata": {
        "priority": 1,
        "tags": ["important"]
      }
    }
  ],
  "count": 1
}
```

## Testing

### Quick Test Script

```bash
#!/bin/bash

BASE_URL="http://localhost:3211"

echo "=== Testing Convex HTTP Actions ==="
echo ""

# Test increment counter
echo "1. Incrementing counter..."
curl -s -X POST "$BASE_URL/api/increment" \
  -H 'Content-Type: application/json' \
  -d '{"name": "benchmark-counter", "amount": 5}' | jq .
echo ""

# Test get counter
echo "2. Getting counter..."
curl -s "$BASE_URL/api/counter/benchmark-counter" | jq .
echo ""

# Test create message
echo "3. Creating message..."
curl -s -X POST "$BASE_URL/api/message" \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "Test message",
    "sender": "benchmark",
    "channel": "test",
    "metadata": {"priority": 1, "tags": ["test"]}
  }' | jq .
echo ""

# Test get messages
echo "4. Getting messages..."
curl -s "$BASE_URL/api/messages?channel=test&limit=5" | jq .
echo ""

echo "=== Tests Complete ==="
```

Save this as `test.sh` and run:
```bash
chmod +x test.sh
./test.sh
```

## Performance Testing

For load testing, you can use tools like `wrk` or `ab`:

```bash
# Install wrk (macOS)
brew install wrk

# Test increment endpoint
wrk -t4 -c100 -d30s -s increment.lua http://localhost:3211/api/increment
```

Example `increment.lua`:
```lua
wrk.method = "POST"
wrk.headers["Content-Type"] = "application/json"
wrk.body = '{"name": "load-test-counter", "amount": 1}'
```

## Troubleshooting

### Deployment fails with "Unauthorized"
- Check that `CONVEX_ADMIN_KEY` is set correctly in `.env`
- Verify the local Convex instance is running on port 3210

### HTTP endpoints return 404
- Ensure the deployment completed successfully
- Check that you're using port 3211 for HTTP requests (not 3210)

### Type generation errors
- Run `npx convex codegen` to regenerate types
- Ensure all imports are correct in your files

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CONVEX_ADMIN_KEY` | Admin key for local Convex deployment |
| `CONVEX_URL` | URL for Convex functions (port 3210) |
| `CONVEX_HTTP_URL` | URL for HTTP actions (port 3211) |

## License

MIT
