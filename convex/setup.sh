#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Convex Local Setup ===${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed.${NC}"
    exit 1
fi

# Generate admin key if not provided
if [ -z "$CONVEX_ADMIN_KEY" ]; then
    echo -e "${YELLOW}Generating admin key...${NC}"
    ADMIN_KEY="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p | tr -d '\n')"
    export CONVEX_ADMIN_KEY="$ADMIN_KEY"
    echo -e "${GREEN}Admin key generated.${NC}"
else
    echo -e "${YELLOW}Using provided CONVEX_ADMIN_KEY from environment.${NC}"
    ADMIN_KEY="$CONVEX_ADMIN_KEY"
fi

# Create .env file for persistence
echo "CONVEX_ADMIN_KEY=$ADMIN_KEY" > .env
echo -e "${GREEN}Saved admin key to .env file.${NC}"

echo ""
echo -e "${BLUE}Starting Convex containers...${NC}"
docker-compose up -d

echo ""
echo -e "${YELLOW}Waiting for services to be ready...${NC}"

# Wait for backend to be healthy
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3210/version > /dev/null 2>&1; then
        echo -e "${GREEN}Convex backend is ready!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo -e "${RED}Error: Backend failed to start within expected time.${NC}"
    echo "Check logs with: docker-compose logs"
    exit 1
fi

# Wait a moment for dashboard to be ready
sleep 3

echo ""
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}Convex Local Development Environment is Ready!${NC}"
echo -e "${GREEN}===============================================${NC}"
echo ""
echo -e "${BLUE}Connection Details:${NC}"
echo ""
echo -e "  Backend URL:     ${YELLOW}http://localhost:3210${NC}"
echo -e "  Site URL:        ${YELLOW}http://localhost:3211${NC}"
echo -e "  Dashboard URL:   ${YELLOW}http://localhost:6791${NC}"
echo ""
echo -e "${BLUE}Admin Key:${NC}"
echo -e "  ${YELLOW}$ADMIN_KEY${NC}"
echo ""
echo -e "${BLUE}Environment Variables for Client:${NC}"
echo -e "  ${YELLOW}export CONVEX_URL=http://localhost:3210${NC}"
echo -e "  ${YELLOW}export CONVEX_ADMIN_KEY=$ADMIN_KEY${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "  View logs:       ${YELLOW}docker-compose logs -f${NC}"
echo -e "  Stop services:   ${YELLOW}docker-compose down${NC}"
echo -e "  Stop & remove:   ${YELLOW}docker-compose down -v${NC} (removes data)"
echo ""
echo -e "${GREEN}Setup complete!${NC}"
