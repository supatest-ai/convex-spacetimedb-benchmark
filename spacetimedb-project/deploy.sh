#!/bin/bash

# SpacetimeDB Benchmark Module Deploy Script (Rust)
# This script builds and deploys the Rust-based benchmark module to local SpacetimeDB

set -e

# Configuration
MODULE_NAME="benchmark"
SPACETIME_HOST="127.0.0.1:3000"
SPACETIME_WS="ws://127.0.0.1:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  SpacetimeDB Benchmark Deploy Script  ${NC}"
echo -e "${BLUE}  (Rust-based Module)                  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if spacetime CLI is installed
if ! command -v spacetime &> /dev/null; then
    echo -e "${RED}Error: spacetime CLI not found${NC}"
    echo "Please install SpacetimeDB CLI:"
    echo "  cargo install spacetimedb-cli"
    echo "  or download from https://spacetimedb.com"
    exit 1
fi

echo -e "${GREEN}SpacetimeDB CLI found${NC}"

# Check if cargo is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Cargo not found${NC}"
    echo "Please install Rust:"
    echo "  https://rustup.rs/"
    exit 1
fi

echo -e "${GREEN}Cargo found${NC}"

# Check if local SpacetimeDB is running
echo -e "${YELLOW}Checking if SpacetimeDB is running at ${SPACETIME_HOST}...${NC}"
if ! curl -s "http://${SPACETIME_HOST}/health" > /dev/null 2>&1; then
    echo -e "${RED}Error: SpacetimeDB is not running at ${SPACETIME_HOST}${NC}"
    echo "Please start SpacetimeDB first:"
    echo "  spacetime start"
    exit 1
fi

echo -e "${GREEN}SpacetimeDB is running${NC}"

# Navigate to project directory
cd "$(dirname "$0")"

# Build the module with cargo
echo ""
echo -e "${YELLOW}Building Rust module with cargo...${NC}"
cargo build --release --target wasm32-unknown-unknown

if [ $? -ne 0 ]; then
    echo -e "${RED}Cargo build failed!${NC}"
    echo "Make sure you have the wasm32-unknown-unknown target installed:"
    echo "  rustup target add wasm32-unknown-unknown"
    exit 1
fi

echo -e "${GREEN}Cargo build successful${NC}"

# Build the module with spacetime
echo ""
echo -e "${YELLOW}Building SpacetimeDB module...${NC}"
spacetime build

if [ $? -ne 0 ]; then
    echo -e "${RED}SpacetimeDB build failed!${NC}"
    exit 1
fi

echo -e "${GREEN}SpacetimeDB build successful${NC}"

# Check if module already exists and delete it
echo ""
echo -e "${YELLOW}Checking for existing module '${MODULE_NAME}'...${NC}"
if spacetime list | grep -q "${MODULE_NAME}"; then
    echo -e "${YELLOW}Module '${MODULE_NAME}' exists, deleting...${NC}"
    spacetime delete "${MODULE_NAME}" --force 2>/dev/null || true
fi

# Publish the module
echo ""
echo -e "${YELLOW}Publishing module '${MODULE_NAME}'...${NC}"
spacetime publish "${MODULE_NAME}" --host "${SPACETIME_HOST}"

if [ $? -ne 0 ]; then
    echo -e "${RED}Publish failed!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Module '${MODULE_NAME}' deployed!    ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${BLUE}Connection Details:${NC}"
echo "  HTTP Endpoint: http://${SPACETIME_HOST}/database/${MODULE_NAME}"
echo "  WebSocket:     ${SPACETIME_WS}/database/${MODULE_NAME}"
echo ""

echo -e "${BLUE}Available Reducers:${NC}"
echo "  - increment_counter(name: String, amount: i64)"
echo "  - create_message(sender: String, content: String, channel: String)"
echo "  - create_event(event_type: String, source: String, data: String)"
echo ""

echo -e "${BLUE}Available Queries:${NC}"
echo "  - get_counter(name: String) -> Option<Counter>"
echo "  - get_messages(channel: String, limit: u32) -> Vec<Message>"
echo ""

echo -e "${YELLOW}To test the module:${NC}"
echo "  spacetime call ${MODULE_NAME} increment_counter '{\"name\": \"test\", \"amount\": 1}'"
echo "  spacetime call ${MODULE_NAME} create_message '{\"sender\": \"user1\", \"content\": \"Hello!\", \"channel\": \"general\"}'"
echo "  spacetime call ${MODULE_NAME} get_counter '{\"name\": \"test\"}'"
echo "  spacetime call ${MODULE_NAME} get_messages '{\"channel\": \"general\", \"limit\": 10}'"
echo ""
