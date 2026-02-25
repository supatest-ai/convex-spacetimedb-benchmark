/**
 * Simple k6 Benchmark Script for Convex and SpacetimeDB
 *
 * This script uses only k6 built-in functions with no external dependencies.
 * It tests HTTP endpoints directly for both databases.
 *
 * Usage:
 *   # Test Convex (default)
 *   k6 run simple-benchmark.js
 *
 *   # Test SpacetimeDB
 *   k6 run -e DB_TYPE=spacetimedb simple-benchmark.js
 *
 *   # Custom settings
 *   k6 run -e DB_TYPE=convex -e VUS=10 -e DURATION=30s simple-benchmark.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'k6/crypto';

// ============================================================================
// Custom Metrics
// ============================================================================

const counterIncrements = new Counter('counter_increments_total');
const counterErrors = new Counter('counter_errors_total');
const counterLatency = new Trend('counter_latency_ms');

const messagesCreated = new Counter('messages_created_total');
const messageErrors = new Counter('message_errors_total');
const messageLatency = new Trend('message_latency_ms');

const successRate = new Rate('success_rate');

// ============================================================================
// Configuration
// ============================================================================

// Database type: 'convex' or 'spacetimedb'
const DB_TYPE = __ENV.DB_TYPE || 'convex';

// Convex configuration
const CONVEX_BASE_URL = __ENV.CONVEX_URL || 'http://localhost:3211';

// SpacetimeDB configuration
const SPACETIME_BASE_URL = __ENV.SPACETIME_URL || 'http://localhost:3000';
const SPACETIME_IDENTITY = __ENV.SPACETIME_IDENTITY || 'c200c938456103fe6da2f0f296a761ce478be28208b2c7ca46ed3df1aced3da7';
const SPACETIME_DATABASE = __ENV.SPACETIME_DATABASE || 'benchmark';

// Test configuration
const VUS = parseInt(__ENV.VUS || '10');
const DURATION = __ENV.DURATION || '1m';

// ============================================================================
// k6 Options
// ============================================================================

export const options = {
    vus: VUS,
    duration: DURATION,
    thresholds: {
        'success_rate': ['rate>0.95'],
        'counter_latency_ms': ['p(95)<500', 'p(99)<1000'],
        'message_latency_ms': ['p(95)<1000', 'p(99)<2000'],
    },
    tags: {
        database: DB_TYPE,
        test: 'simple-benchmark',
    },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a random string of specified length
 */
function randomString(length) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset[randomIntBetween(0, charset.length - 1)];
    }
    return result;
}

/**
 * Generate a random UUID-like string
 */
function randomUUID() {
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            uuid += '-';
        } else if (i === 14) {
            uuid += '4';
        } else if (i === 19) {
            uuid += hex[randomIntBetween(8, 11)];
        } else {
            uuid += hex[randomIntBetween(0, 15)];
        }
    }
    return uuid;
}

/**
 * Get the base URL based on database type
 */
function getBaseUrl() {
    if (DB_TYPE === 'spacetimedb') {
        return SPACETIME_BASE_URL;
    }
    return CONVEX_BASE_URL;
}

// ============================================================================
// Convex API Functions
// ============================================================================

/**
 * Increment a counter in Convex
 */
function convexIncrementCounter() {
    const url = `${CONVEX_BASE_URL}/api/increment`;
    const counterName = `counter_${randomIntBetween(1, 100)}`;

    const payload = JSON.stringify({
        name: counterName,
        amount: 1,
    });

    const startTime = Date.now();
    const response = http.post(url, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const duration = Date.now() - startTime;

    counterLatency.add(duration);

    const success = check(response, {
        'counter increment status is 200': (r) => r.status === 200,
        'counter increment response is valid': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body !== null;
            } catch (e) {
                return false;
            }
        },
    });

    if (success) {
        counterIncrements.add(1);
        successRate.add(true);
    } else {
        counterErrors.add(1);
        successRate.add(false);
        console.error(`Convex counter increment failed: ${response.status} - ${response.body}`);
    }

    return success;
}

/**
 * Create a message in Convex
 */
function convexCreateMessage() {
    const url = `${CONVEX_BASE_URL}/api/message`;

    const payload = JSON.stringify({
        content: `Message ${randomString(50)}`,
        sender: `user_${randomString(8)}`,
        channel: `channel_${randomIntBetween(1, 10)}`,
    });

    const startTime = Date.now();
    const response = http.post(url, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const duration = Date.now() - startTime;

    messageLatency.add(duration);

    const success = check(response, {
        'message creation status is 200': (r) => r.status === 200,
        'message creation response is valid': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body !== null;
            } catch (e) {
                return false;
            }
        },
    });

    if (success) {
        messagesCreated.add(1);
        successRate.add(true);
    } else {
        messageErrors.add(1);
        successRate.add(false);
        console.error(`Convex message creation failed: ${response.status} - ${response.body}`);
    }

    return success;
}

// ============================================================================
// SpacetimeDB API Functions
// ============================================================================

/**
 * Increment a counter in SpacetimeDB via HTTP API
 */
function spacetimeIncrementCounter() {
    const url = `${SPACETIME_BASE_URL}/v1/database/${SPACETIME_IDENTITY}/call/increment_counter`;
    const counterName = `counter_${randomIntBetween(1, 100)}`;

    // SpacetimeDB expects args as a JSON array
    const payload = JSON.stringify([counterName, 1]);

    const startTime = Date.now();
    const response = http.post(url, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const duration = Date.now() - startTime;

    counterLatency.add(duration);

    const success = check(response, {
        'counter increment status is 200': (r) => r.status === 200,
        'counter increment response is valid': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body !== null;
            } catch (e) {
                return false;
            }
        },
    });

    if (success) {
        counterIncrements.add(1);
        successRate.add(true);
    } else {
        counterErrors.add(1);
        successRate.add(false);
        console.error(`SpacetimeDB counter increment failed: ${response.status} - ${response.body}`);
    }

    return success;
}

/**
 * Create a message in SpacetimeDB via HTTP API
 */
function spacetimeCreateMessage() {
    const url = `${SPACETIME_BASE_URL}/v1/database/${SPACETIME_IDENTITY}/call/create_message`;

    const sender = `user_${randomString(8)}`;
    const content = `Message ${randomString(50)}`;
    const channel = `channel_${randomIntBetween(1, 10)}`;

    // SpacetimeDB expects args as a JSON array: [sender, content, channel]
    const payload = JSON.stringify([sender, content, channel]);

    const startTime = Date.now();
    const response = http.post(url, payload, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const duration = Date.now() - startTime;

    messageLatency.add(duration);

    const success = check(response, {
        'message creation status is 200': (r) => r.status === 200,
        'message creation response is valid': (r) => {
            try {
                const body = JSON.parse(r.body);
                return body !== null;
            } catch (e) {
                return false;
            }
        },
    });

    if (success) {
        messagesCreated.add(1);
        successRate.add(true);
    } else {
        messageErrors.add(1);
        successRate.add(false);
        console.error(`SpacetimeDB message creation failed: ${response.status} - ${response.body}`);
    }

    return success;
}

// ============================================================================
// Scenario Functions
// ============================================================================

/**
 * Scenario 1: Counter Increments
 */
function counterScenario() {
    group('Counter Increments', () => {
        if (DB_TYPE === 'spacetimedb') {
            spacetimeIncrementCounter();
        } else {
            convexIncrementCounter();
        }
    });
}

/**
 * Scenario 2: Message Creation
 */
function messageScenario() {
    group('Message Creation', () => {
        if (DB_TYPE === 'spacetimedb') {
            spacetimeCreateMessage();
        } else {
            convexCreateMessage();
        }
    });
}

/**
 * Scenario 3: Mixed Operations
 */
function mixedScenario() {
    group('Mixed Operations', () => {
        const isCounter = Math.random() < 0.5;

        if (isCounter) {
            if (DB_TYPE === 'spacetimedb') {
                spacetimeIncrementCounter();
            } else {
                convexIncrementCounter();
            }
        } else {
            if (DB_TYPE === 'spacetimedb') {
                spacetimeCreateMessage();
            } else {
                convexCreateMessage();
            }
        }
    });
}

// ============================================================================
// k6 Lifecycle Hooks
// ============================================================================

/**
 * Setup function - runs once before all VUs start
 */
export function setup() {
    console.log('=== Simple Benchmark Setup ===');
    console.log(`Database Type: ${DB_TYPE}`);
    console.log(`Base URL: ${getBaseUrl()}`);
    console.log(`VUs: ${VUS}`);
    console.log(`Duration: ${DURATION}`);

    if (DB_TYPE === 'spacetimedb') {
        console.log(`Identity: ${SPACETIME_IDENTITY}`);
        console.log(`Database: ${SPACETIME_DATABASE}`);
    }

    // Health check
    const healthUrl = DB_TYPE === 'spacetimedb'
        ? `${SPACETIME_BASE_URL}/v1/database/${SPACETIME_IDENTITY}/schema`
        : `${CONVEX_BASE_URL}/health`;

    const healthCheck = http.get(healthUrl);
    console.log(`Health check status: ${healthCheck.status}`);

    return {
        dbType: DB_TYPE,
        startTime: Date.now(),
    };
}

/**
 * Default function - runs for each VU iteration
 */
export default function (data) {
    // Rotate through scenarios randomly
    const scenario = randomIntBetween(1, 3);

    switch (scenario) {
        case 1:
            counterScenario();
            break;
        case 2:
            messageScenario();
            break;
        case 3:
            mixedScenario();
            break;
    }

    // Small delay between requests to prevent overwhelming the system
    sleep(randomIntBetween(10, 100) / 1000);
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
    const duration = Date.now() - data.startTime;
    console.log('\n=== Benchmark Complete ===');
    console.log(`Database: ${data.dbType}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
}

/**
 * Custom summary handler
 */
export function handleSummary(data) {
    const report = {
        metadata: {
            database: DB_TYPE,
            timestamp: new Date().toISOString(),
            vus: VUS,
            duration: DURATION,
        },
        scenarios: {
            counterIncrements: {
                total: data.metrics.counter_increments_total?.values?.count || 0,
                errors: data.metrics.counter_errors_total?.values?.count || 0,
                avgLatency: data.metrics.counter_latency_ms?.values?.avg || 0,
                p95Latency: data.metrics.counter_latency_ms?.values['p(95)'] || 0,
            },
            messageCreations: {
                total: data.metrics.messages_created_total?.values?.count || 0,
                errors: data.metrics.message_errors_total?.values?.count || 0,
                avgLatency: data.metrics.message_latency_ms?.values?.avg || 0,
                p95Latency: data.metrics.message_latency_ms?.values['p(95)'] || 0,
            },
        },
        overall: {
            totalRequests: data.metrics.http_reqs?.values?.count || 0,
            failedRequests: data.metrics.http_req_failed?.values?.count || 0,
            avgLatency: data.metrics.http_req_duration?.values?.avg || 0,
            p95Latency: data.metrics.http_req_duration?.values['p(95)'] || 0,
            p99Latency: data.metrics.http_req_duration?.values['p(99)'] || 0,
            successRate: data.metrics.success_rate?.values?.rate || 0,
        },
    };

    // Calculate error rates
    report.scenarios.counterIncrements.errorRate = report.scenarios.counterIncrements.total > 0
        ? (report.scenarios.counterIncrements.errors / report.scenarios.counterIncrements.total * 100).toFixed(2)
        : 0;
    report.scenarios.messageCreations.errorRate = report.scenarios.messageCreations.total > 0
        ? (report.scenarios.messageCreations.errors / report.scenarios.messageCreations.total * 100).toFixed(2)
        : 0;

    console.log('\n=== Benchmark Summary ===');
    console.log(JSON.stringify(report, null, 2));

    return {
        'stdout': JSON.stringify(report, null, 2),
    };
}
