#!/bin/bash

set -e

echo "=========================================="
echo "SpacetimeDB Local Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

echo "Starting SpacetimeDB container..."
docker-compose up -d

echo ""
echo "Waiting for SpacetimeDB server to be ready..."
echo "This may take 30-60 seconds..."
echo ""

# Wait for the server to be ready
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/v1/status > /dev/null 2>&1; then
        echo -e "${GREEN}SpacetimeDB is ready!${NC}"
        break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Attempt $RETRY_COUNT/$MAX_RETRIES: Server not ready yet, waiting..."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "Error: Timed out waiting for SpacetimeDB to start."
    echo "Check logs with: docker-compose logs"
    exit 1
fi

echo ""
echo "=========================================="
echo "SpacetimeDB Connection Details"
echo "=========================================="
echo ""
echo -e "${YELLOW}HTTP Endpoint:${NC}  http://localhost:3000"
echo -e "${YELLOW}WebSocket URL:${NC}  ws://localhost:3000/v1/subscribe"
echo ""
echo "=========================================="
echo "Quick Start Commands"
echo "=========================================="
echo ""
echo "# Install SpacetimeDB CLI (if not installed):"
echo "  curl -sSf https://install.spacetimedb.com | sh"
echo ""
echo "# Set the local server as default:"
echo "  spacetime server add local http://localhost:3000"
echo "  spacetime server set-default local"
echo ""
echo "# Create a new identity:"
echo "  spacetime identity new --name local-user --server local"
echo ""
echo "# Publish the benchmark module:"
echo "  cd server && spacetime publish benchmark"
echo ""
echo "# View logs:"
echo "  docker-compose logs -f"
echo ""
echo "# Stop the server:"
echo "  docker-compose down"
echo ""
echo "=========================================="
