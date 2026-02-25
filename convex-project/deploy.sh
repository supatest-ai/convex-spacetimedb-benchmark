#!/bin/bash

# Convex Local Deployment Script
# This script deploys Convex functions to a local Convex instance

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="convex-benchmark-project"
LOCAL_URL="http://localhost:3210"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Convex Local Deployment Script ===${NC}"
echo ""

# Check if .env file exists with admin key
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}Loading environment from $ENV_FILE${NC}"
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo -e "${YELLOW}Warning: .env file not found at $ENV_FILE${NC}"
    echo -e "${YELLOW}Using admin key from convex/.env${NC}"
    # Try to load from the convex directory
    if [ -f "/Users/prasad/realtime-db-bench/convex/.env" ]; then
        export $(grep -v '^#' "/Users/prasad/realtime-db-bench/convex/.env" | xargs)
    fi
fi

# Verify admin key is set
if [ -z "$CONVEX_ADMIN_KEY" ]; then
    echo -e "${RED}Error: CONVEX_ADMIN_KEY is not set${NC}"
    echo "Please set CONVEX_ADMIN_KEY environment variable"
    exit 1
fi

echo -e "${GREEN}Admin key loaded successfully${NC}"
echo ""

# Check if convex CLI is installed
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx is not installed${NC}"
    echo "Please install Node.js and npm"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    cd "$SCRIPT_DIR" && npm install
    echo -e "${GREEN}Dependencies installed${NC}"
    echo ""
fi

# Set environment variables for local deployment
export CONVEX_URL="$LOCAL_URL"

echo -e "${GREEN}Deploying to local Convex at $LOCAL_URL${NC}"
echo ""

# Deploy using convex CLI
cd "$SCRIPT_DIR" && npx convex deploy \
    --url "$LOCAL_URL" \
    --admin-key "$CONVEX_ADMIN_KEY" \
    --verbose

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "HTTP Endpoints available:"
echo "  POST http://localhost:3211/api/increment  - Increment a counter"
echo "  POST http://localhost:3211/api/message    - Create a message"
echo "  GET  http://localhost:3211/api/counter/:name - Get counter value"
echo "  GET  http://localhost:3211/api/messages   - Get messages"
echo ""
echo "Example usage:"
echo "  curl -X POST http://localhost:3211/api/increment \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"name\": \"test-counter\", \"amount\": 1}'"
echo ""
echo "  curl -X POST http://localhost:3211/api/message \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"content\": \"Hello World\", \"sender\": \"user1\", \"channel\": \"general\"}'"
echo ""
echo "  curl http://localhost:3211/api/counter/test-counter"
echo ""
echo "  curl 'http://localhost:3211/api/messages?channel=general&limit=10'"
