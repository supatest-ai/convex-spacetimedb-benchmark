/**
 * k6 Benchmark Test Script for Convex Database
 *
 * Tests Convex HTTP Actions with three scenarios:
 * 1. Counter increments (write-heavy)
 * 2. Message creation (write with larger payload)
 * 3. Mixed read/write operations
 *
 * Usage:
 *   k6 run test.js
 *   k6 run -e CONVEX_HOST=localhost -e CONVEX_PORT=3210 test.js
 *   k6 run -e LOAD_PROFILE=tps500 test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomInt, randomChoice, randomUUID, randomString } from '../../utils.js';
import { getLoadProfile, commonThresholds } from '../../options.js';
import {
    getConvexConfig,
    callConvexAction,
    callConvexQuery,
    callConvexMutation,
    validateConvexResponse,
    parseConvexResponse,
    isConvexError,
    generateMessage,
    generateCounterArgs,
    generateMixedOperationArgs,
    checkConvexHealth,
    waitForConvex,
    convexMetrics,
} from './convex-api.js';

// ============================================================================
// Custom Metrics
// ============================================================================

const scenarioMetrics = {
    // Counter scenario metrics
    counterIncrements: new Counter('convex_counter_increments_total'),
    counterIncrementErrors: new Counter('convex_counter_increment_errors_total'),
    counterIncrementLatency: new Trend('convex_counter_increment_latency_ms'),

    // Message scenario metrics
    messagesCreated: new Counter('convex_messages_created_total'),
    messageCreationErrors: new Counter('convex_message_creation_errors_total'),
    messageCreationLatency: new Trend('convex_message_creation_latency_ms'),
    messageSize: new Trend('convex_message_size_bytes'),

    // Mixed scenario metrics
    mixedOperations: new Counter('convex_mixed_operations_total'),
    mixedOperationErrors: new Counter('convex_mixed_operation_errors_total'),
    mixedOperationLatency: new Trend('convex_mixed_operation_latency_ms'),

    // Read/Write breakdown
    readOperations: new Counter('convex_read_operations_total'),
    writeOperations: new Counter('convex_write_operations_total'),
    updateOperations: new Counter('convex_update_operations_total'),
    deleteOperations: new Counter('convex_delete_operations_total'),
};

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Get test configuration from environment variables
 */
function getTestOptions() {
    const profileName = __ENV.LOAD_PROFILE || 'tps500';
    const baseProfile = getLoadProfile(profileName);

    // Convex-specific thresholds
    const convexThresholds = {
        ...commonThresholds,
        'convex_counter_increment_latency_ms': ['p(95)<200', 'p(99)<500'],
        'convex_message_creation_latency_ms': ['p(95)<500', 'p(99)<1000'],
        'convex_mixed_operation_latency_ms': ['p(95)<400', 'p(99)<800'],
        'convex_mutation_success_rate': ['rate>0.99'],
        'convex_query_success_rate': ['rate>0.99'],
    };

    return {
        ...baseProfile,
        thresholds: {
            ...baseProfile.thresholds,
            ...convexThresholds,
        },
        tags: {
            ...baseProfile.tags,
            database: 'convex',
            test_type: 'http_actions',
        },
    };
}

// Export options for k6
export const options = getTestOptions();

// ============================================================================
// Setup and Teardown
// ============================================================================

/**
 * Setup function - runs once before all VUs start
 */
export function setup() {
    const config = getConvexConfig();

    console.log('=== Convex k6 Benchmark Setup ===');
    console.log(`Target URL: ${config.baseUrl}`);
    console.log(`Admin URL: ${config.adminUrl}`);
    console.log(`Load Profile: ${__ENV.LOAD_PROFILE || 'tps500'}`);

    // Wait for Convex to be available
    if (!waitForConvex(config, 30)) {
        throw new Error('Convex is not available. Please ensure Convex is running locally.');
    }

    // Verify health
    const isHealthy = checkConvexHealth(config);
    if (!isHealthy) {
        console.warn('Warning: Convex health check returned non-200 status');
    }

    // Initialize test data - create a counter if needed
    const initResponse = callConvexAction(config.actions.incrementCounter, {
        name: config.counterName,
        amount: 0,
        initialize: true,
    }, config);

    if (initResponse.status >= 400) {
        console.log('Note: Counter initialization may have failed or action may not exist yet');
        console.log('Status:', initResponse.status);
        console.log('Body:', initResponse.body);
    }

    return {
        config,
        startTime: Date.now(),
        testRunId: randomUUID(),
    };
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
    const duration = Date.now() - data.startTime;
    console.log('\n=== Convex k6 Benchmark Complete ===');
    console.log(`Test Run ID: ${data.testRunId}`);
    console.log(`Duration: ${(duration / 1000).toFixed(2)}s`);
    console.log(`Target: ${data.config.baseUrl}`);
}

// ============================================================================
// Scenario 1: Counter Increments (Write-Heavy)
// ============================================================================

/**
 * Counter increment scenario - tests simple write operations
 * This scenario focuses on high-frequency small writes
 */
export function counterIncrementScenario() {
    const config = getConvexConfig();
    const startTime = Date.now();

    group('Counter Increment', () => {
        // Generate increment arguments
        const args = generateCounterArgs(config.counterName, 1);

        // Call the increment action
        const response = callConvexMutation(
            config.actions.incrementCounter,
            args,
            config
        );

        const duration = Date.now() - startTime;
        scenarioMetrics.counterIncrementLatency.add(duration);

        // Validate response
        const success = validateConvexResponse(response, {
            'counter incremented successfully': (r) => {
                const body = parseConvexResponse(r);
                return body !== null && (body.value !== undefined || body.success === true);
            },
        });

        if (success) {
            scenarioMetrics.counterIncrements.add(1);
            scenarioMetrics.writeOperations.add(1);
        } else {
            scenarioMetrics.counterIncrementErrors.add(1);

            if (isConvexError(response)) {
                console.error(`Counter increment failed: ${response.status} - ${response.body}`);
            }
        }

        // Small delay to prevent overwhelming the system
        sleep(randomInt(1, 10) / 1000); // 1-10ms
    });
}

// ============================================================================
// Scenario 2: Message Creation (Write with Larger Payload)
// ============================================================================

/**
 * Message creation scenario - tests writes with larger payloads
 * Simulates creating messages/posts with varying sizes
 */
export function messageCreationScenario() {
    const config = getConvexConfig();
    const startTime = Date.now();

    group('Message Creation', () => {
        // Generate message with varying size
        const sizeVariation = randomChoice([500, 1000, 2000, 5000]);
        const message = generateMessage(sizeVariation);
        scenarioMetrics.messageSize.add(JSON.stringify(message).length);

        // Call the create message action
        const response = callConvexMutation(
            config.actions.createMessage,
            { message },
            config
        );

        const duration = Date.now() - startTime;
        scenarioMetrics.messageCreationLatency.add(duration);

        // Validate response
        const success = validateConvexResponse(response, {
            'message created successfully': (r) => {
                const body = parseConvexResponse(r);
                return body !== null && (body.id !== undefined || body.success === true);
            },
        });

        if (success) {
            scenarioMetrics.messagesCreated.add(1);
            scenarioMetrics.writeOperations.add(1);
        } else {
            scenarioMetrics.messageCreationErrors.add(1);

            if (isConvexError(response)) {
                console.error(`Message creation failed: ${response.status} - ${response.body}`);
            }
        }

        // Variable delay based on payload size (larger payloads = longer processing)
        const delayMs = Math.max(5, sizeVariation / 100);
        sleep(delayMs / 1000);
    });
}

// ============================================================================
// Scenario 3: Mixed Read/Write Operations
// ============================================================================

/**
 * Mixed operations scenario - tests combination of reads and writes
 * Simulates realistic workload with both queries and mutations
 */
export function mixedOperationsScenario() {
    const config = getConvexConfig();
    const startTime = Date.now();

    group('Mixed Operations', () => {
        // Determine operation type based on read/write ratio
        const readWriteRatio = parseFloat(__ENV.READ_WRITE_RATIO || '0.7');
        const isRead = Math.random() < readWriteRatio;

        let response;
        let operationType;

        if (isRead) {
            // Perform a read operation
            operationType = 'read';
            const args = {
                limit: randomInt(10, 100),
                offset: randomInt(0, 1000),
            };

            response = callConvexQuery(
                config.actions.getMessages,
                args,
                config
            );

            scenarioMetrics.readOperations.add(1);
        } else {
            // Perform a write operation (create, update, or delete)
            const writeTypes = ['create', 'update', 'delete'];
            operationType = randomChoice(writeTypes);

            let args;
            switch (operationType) {
                case 'create':
                    args = {
                        operation: 'create',
                        message: generateMessage(1000),
                    };
                    break;
                case 'update':
                    args = {
                        operation: 'update',
                        id: randomUUID(),
                        updates: { content: randomString(100) },
                    };
                    break;
                case 'delete':
                    args = {
                        operation: 'delete',
                        id: randomUUID(),
                    };
                    break;
            }

            response = callConvexMutation(
                config.actions.mixedOperation,
                args,
                config
            );

            // Track specific operation types
            switch (operationType) {
                case 'create':
                    scenarioMetrics.writeOperations.add(1);
                    break;
                case 'update':
                    scenarioMetrics.updateOperations.add(1);
                    break;
                case 'delete':
                    scenarioMetrics.deleteOperations.add(1);
                    break;
            }
        }

        const duration = Date.now() - startTime;
        scenarioMetrics.mixedOperationLatency.add(duration);

        // Validate response
        const success = validateConvexResponse(response, {
            'mixed operation successful': (r) => {
                const body = parseConvexResponse(r);
                return body !== null;
            },
        });

        if (success) {
            scenarioMetrics.mixedOperations.add(1);
        } else {
            scenarioMetrics.mixedOperationErrors.add(1);

            if (isConvexError(response)) {
                console.error(`Mixed operation (${operationType}) failed: ${response.status}`);
            }
        }

        // Variable delay to simulate realistic request patterns
        sleep(randomInt(10, 50) / 1000); // 10-50ms
    });
}

// ============================================================================
// Default Export (for simple execution)
// ============================================================================

/**
 * Default function - runs when no scenario is specified
 * Executes all three scenarios in rotation
 */
export default function () {
    const scenarioRotation = randomInt(1, 3);

    switch (scenarioRotation) {
        case 1:
            counterIncrementScenario();
            break;
        case 2:
            messageCreationScenario();
            break;
        case 3:
            mixedOperationsScenario();
            break;
    }
}

// ============================================================================
// Handle Summary
// ============================================================================

/**
 * Custom summary handler for detailed reporting
 */
export function handleSummary(data) {
    const config = getConvexConfig();

    const report = {
        metadata: {
            database: 'Convex',
            target: config.baseUrl,
            timestamp: new Date().toISOString(),
            loadProfile: __ENV.LOAD_PROFILE || 'tps500',
        },
        scenarios: {
            counterIncrements: {
                total: data.metrics.convex_counter_increments_total?.values?.count || 0,
                errors: data.metrics.convex_counter_increment_errors_total?.values?.count || 0,
                avgLatency: data.metrics.convex_counter_increment_latency_ms?.values?.avg || 0,
                p95Latency: data.metrics.convex_counter_increment_latency_ms?.values['p(95)'] || 0,
            },
            messageCreations: {
                total: data.metrics.convex_messages_created_total?.values?.count || 0,
                errors: data.metrics.convex_message_creation_errors_total?.values?.count || 0,
                avgLatency: data.metrics.convex_message_creation_latency_ms?.values?.avg || 0,
                p95Latency: data.metrics.convex_message_creation_latency_ms?.values['p(95)'] || 0,
                avgSize: data.metrics.convex_message_size_bytes?.values?.avg || 0,
            },
            mixedOperations: {
                total: data.metrics.convex_mixed_operations_total?.values?.count || 0,
                errors: data.metrics.convex_mixed_operation_errors_total?.values?.count || 0,
                avgLatency: data.metrics.convex_mixed_operation_latency_ms?.values?.avg || 0,
                p95Latency: data.metrics.convex_mixed_operation_latency_ms?.values['p(95)'] || 0,
                reads: data.metrics.convex_read_operations_total?.values?.count || 0,
                writes: data.metrics.convex_write_operations_total?.values?.count || 0,
                updates: data.metrics.convex_update_operations_total?.values?.count || 0,
                deletes: data.metrics.convex_delete_operations_total?.values?.count || 0,
            },
        },
        overall: {
            totalRequests: data.metrics.http_reqs?.values?.count || 0,
            failedRequests: data.metrics.http_req_failed?.values?.count || 0,
            avgLatency: data.metrics.http_req_duration?.values?.avg || 0,
            p95Latency: data.metrics.http_req_duration?.values['p(95)'] || 0,
            p99Latency: data.metrics.http_req_duration?.values['p(99)'] || 0,
        },
    };

    // Calculate error rates
    report.scenarios.counterIncrements.errorRate = report.scenarios.counterIncrements.total > 0
        ? (report.scenarios.counterIncrements.errors / report.scenarios.counterIncrements.total * 100).toFixed(2)
        : 0;
    report.scenarios.messageCreations.errorRate = report.scenarios.messageCreations.total > 0
        ? (report.scenarios.messageCreations.errors / report.scenarios.messageCreations.total * 100).toFixed(2)
        : 0;
    report.scenarios.mixedOperations.errorRate = report.scenarios.mixedOperations.total > 0
        ? (report.scenarios.mixedOperations.errors / report.scenarios.mixedOperations.total * 100).toFixed(2)
        : 0;

    // Output to console
    console.log('\n=== Convex Benchmark Summary ===');
    console.log(JSON.stringify(report, null, 2));

    // Return standard k6 summary plus custom report
    return {
        'stdout': JSON.stringify(report, null, 2),
    };
}
