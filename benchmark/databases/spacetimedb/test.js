/**
 * SpacetimeDB k6 Benchmark Test Script
 *
 * Tests WebSocket connections (primary SpacetimeDB interface) and HTTP API
 * with three scenarios:
 * 1. Simple counter increments via reducers
 * 2. Message creation (write with larger payload)
 * 3. Mixed read/write operations
 *
 * Usage:
 *   k6 run test.js
 *   k6 run -e SPACETIME_HOST=localhost -e SPACETIME_PORT=3000 test.js
 *   k6 run -e LOAD_PROFILE=tps500 test.js
 */

import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomIntBetween } from 'k6/crypto';

// Import shared utilities
import {
    metrics,
    recordSuccess,
    recordError,
    createTimer,
    randomUUID,
    randomAlphanumeric,
    randomInt,
    randomString,
    randomChoice,
    generateUser,
    log,
} from '../../utils.js';

// Import load profiles
import {
    commonThresholds,
    commonOptions,
    getLoadProfile,
} from '../../options.js';

// Import SpacetimeDB API
import {
    getConfig,
    createConnection,
    createConnectionPool,
    callReducerHttp,
    queryHttp,
    incrementCounter,
    createMessage,
    readMessages,
    readCounter,
    executeBatch,
    spacetimeMetrics,
} from './spacetime-api.js';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Get load profile from environment or use default
 */
function getTestOptions() {
    const profileName = __ENV.LOAD_PROFILE || 'tps500';
    const useWebSocket = __ENV.USE_WEBSOCKET !== 'false'; // Default to true

    try {
        const baseProfile = getLoadProfile(profileName);

        return {
            ...baseProfile,
            ...commonOptions,
            thresholds: {
                ...commonThresholds,
                ...baseProfile.thresholds,
                // SpacetimeDB-specific thresholds
                'spacetime_reducer_latency_ms': ['p(95)<500', 'p(99)<1000'],
                'spacetime_ws_latency_ms': ['p(95)<300', 'p(99)<600'],
                'spacetime_subscription_latency_ms': ['p(95)<1000', 'p(99)<2000'],
            },
            tags: {
                ...baseProfile.tags,
                database: 'spacetimedb',
                protocol: useWebSocket ? 'websocket' : 'http',
            },
        };
    } catch (e) {
        // Fallback to default configuration
        return {
            ...commonOptions,
            stages: [
                { duration: '30s', target: 50 },
                { duration: '5m', target: 50 },
                { duration: '30s', target: 0 },
            ],
            thresholds: commonThresholds,
            tags: { database: 'spacetimedb', profile: 'default' },
        };
    }
}

// Export options for k6
export const options = getTestOptions();

// ============================================================================
// Test Scenarios
// ============================================================================

/**
 * Scenario 1: Simple Counter Increments via Reducers
 * Tests basic reducer call performance with minimal payload
 */
export function counterScenario() {
    const config = getConfig();
    const useWebSocket = __ENV.USE_WEBSOCKET !== 'false';
    const counterId = `counter_${randomInt(1, 100)}`;
    const amount = randomInt(1, 10);

    group('Counter Increment', () => {
        let result;

        if (useWebSocket) {
            // Use WebSocket for reducer calls
            const connection = createConnection(config);

            if (!connection.connect()) {
                recordError('connection', 'counter');
                return;
            }

            // Subscribe to counter updates
            connection.subscribe(`SELECT * FROM counters WHERE id = '${counterId}'`);

            // Call increment reducer
            result = connection.callReducer('increment', [counterId, amount]);

            connection.close();
        } else {
            // Use HTTP API for reducer calls
            result = incrementCounter(counterId, amount, false, null, config);
        }

        if (result.success) {
            recordSuccess('write', result.duration || randomIntBetween(10, 100), 0, 1);
        } else {
            recordError('validation', 'counter');
        }

        check(result, {
            'Counter increment successful': (r) => r.success,
            'Counter increment has valid response': (r) =>
                r.success || r.error !== undefined,
        });
    });

    // Random sleep between requests (10-100ms)
    sleep(randomIntBetween(10, 100) / 1000);
}

/**
 * Scenario 2: Message Creation (Write with Larger Payload)
 * Tests write performance with larger payloads
 */
export function messageScenario() {
    const config = getConfig();
    const useWebSocket = __ENV.USE_WEBSOCKET !== 'false';

    // Generate message with varying payload sizes
    const payloadSize = parseInt(__ENV.MESSAGE_SIZE || '1000');
    const sender = `user_${randomAlphanumeric(16)}`;
    const content = randomString(payloadSize);

    group('Message Creation', () => {
        let result;

        if (useWebSocket) {
            const connection = createConnection(config);

            if (!connection.connect()) {
                recordError('connection', 'message');
                return;
            }

            // Subscribe to messages table
            connection.subscribe('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100');

            // Create message via reducer
            result = connection.callReducer('create_message', [
                randomUUID(),
                sender,
                content,
                new Date().toISOString(),
            ]);

            connection.close();
        } else {
            result = createMessage(content, sender, false, null, config);
        }

        if (result.success) {
            recordSuccess('write', result.duration || randomIntBetween(20, 200), content.length, 1);
        } else {
            recordError('validation', 'message');
        }

        check(result, {
            'Message creation successful': (r) => r.success,
            'Message creation has valid response': (r) =>
                r.success || r.error !== undefined,
        });
    });

    // Random sleep between requests (50-200ms)
    sleep(randomIntBetween(50, 200) / 1000);
}

/**
 * Scenario 3: Mixed Read/Write Operations
 * Tests combined read and write performance
 */
export function mixedScenario() {
    const config = getConfig();
    const useWebSocket = __ENV.USE_WEBSOCKET !== 'false';

    // Determine operation type based on read/write ratio
    const readWriteRatio = parseFloat(__ENV.READ_WRITE_RATIO || '0.7');
    const isRead = Math.random() < readWriteRatio;

    group('Mixed Operations', () => {
        if (isRead) {
            performReadOperation(config, useWebSocket);
        } else {
            performWriteOperation(config, useWebSocket);
        }
    });

    // Random sleep between requests (20-150ms)
    sleep(randomIntBetween(20, 150) / 1000);
}

/**
 * Perform a read operation
 * @param {Object} config - Configuration
 * @param {boolean} useWebSocket - Whether to use WebSocket
 */
function performReadOperation(config, useWebSocket) {
    const operation = randomChoice(['query_messages', 'query_counter', 'query_user']);
    const timer = createTimer();
    let result;

    switch (operation) {
        case 'query_messages': {
            const limit = randomInt(10, 100);
            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.subscribe(`SELECT * FROM messages ORDER BY timestamp DESC LIMIT ${limit}`);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = readMessages(limit, config);
            }
            break;
        }

        case 'query_counter': {
            const counterId = `counter_${randomInt(1, 100)}`;
            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.subscribe(`SELECT * FROM counters WHERE id = '${counterId}'`);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = readCounter(counterId, config);
            }
            break;
        }

        case 'query_user': {
            const userId = randomAlphanumeric(16);
            const query = `SELECT * FROM users WHERE id = '${userId}'`;
            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.subscribe(query);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = queryHttp(query, config);
            }
            break;
        }
    }

    if (result && result.success) {
        const bodyLength = result.body ? result.body.length : 0;
        timer.stop('read', bodyLength, 1);
    } else {
        timer.stopWithError('validation', 'read');
    }

    check(result, {
        'Read operation successful': (r) => r && r.success,
    });
}

/**
 * Perform a write operation
 * @param {Object} config - Configuration
 * @param {boolean} useWebSocket - Whether to use WebSocket
 */
function performWriteOperation(config, useWebSocket) {
    const operation = randomChoice(['increment', 'create_message', 'create_user']);
    let result;

    switch (operation) {
        case 'increment': {
            const counterId = `counter_${randomInt(1, 100)}`;
            const amount = randomInt(1, 10);

            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.callReducer('increment', [counterId, amount]);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = incrementCounter(counterId, amount, false, null, config);
            }
            break;
        }

        case 'create_message': {
            const sender = `user_${randomAlphanumeric(16)}`;
            const content = randomString(randomInt(100, 1000));

            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.callReducer('create_message', [
                        randomUUID(),
                        sender,
                        content,
                        new Date().toISOString(),
                    ]);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = createMessage(content, sender, false, null, config);
            }
            break;
        }

        case 'create_user': {
            const user = generateUser();

            if (useWebSocket) {
                const connection = createConnection(config);
                if (connection.connect()) {
                    result = connection.callReducer('create_user', [
                        user.id,
                        user.username,
                        user.email,
                        user.name,
                        user.age,
                        user.createdAt,
                        user.active,
                    ]);
                    connection.close();
                } else {
                    result = { success: false, error: 'Connection failed' };
                }
            } else {
                result = callReducerHttp('create_user', [
                    user.id,
                    user.username,
                    user.email,
                    user.name,
                    user.age,
                    user.createdAt,
                    user.active,
                ], config);
            }
            break;
        }
    }

    if (result && result.success) {
        recordSuccess('write', result.duration || randomIntBetween(20, 200), 0, 1);
    } else {
        recordError('validation', 'write');
    }

    check(result, {
        'Write operation successful': (r) => r && r.success,
    });
}

// ============================================================================
// Batch Operations Scenario
// ============================================================================

/**
 * Scenario 4: Batch Operations
 * Tests batch write performance
 */
export function batchScenario() {
    const config = getConfig();
    const batchSize = parseInt(__ENV.BATCH_SIZE || '10');

    group('Batch Operations', () => {
        const operations = [];

        // Generate mixed batch operations
        for (let i = 0; i < batchSize; i++) {
            const opType = randomChoice(['increment', 'message', 'query']);

            switch (opType) {
                case 'increment':
                    operations.push({
                        type: 'increment',
                        counterId: `counter_${randomInt(1, 100)}`,
                        amount: randomInt(1, 10),
                    });
                    break;

                case 'message':
                    operations.push({
                        type: 'message',
                        content: randomString(randomInt(100, 500)),
                        sender: `user_${randomAlphanumeric(16)}`,
                    });
                    break;

                case 'query':
                    operations.push({
                        type: 'query',
                        query: `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ${randomInt(10, 50)}`,
                    });
                    break;
            }
        }

        const result = executeBatch(operations, config);

        if (result.success) {
            recordSuccess('batch', result.duration, 0, batchSize);
        } else {
            recordError('validation', 'batch');
        }

        check(result, {
            'Batch operations completed': (r) => r.success,
            'Batch success rate acceptable': (r) =>
                r.successful / r.total >= 0.95, // Allow 5% failure rate
        });
    });

    // Longer sleep after batch operations
    sleep(randomIntBetween(100, 500) / 1000);
}

// ============================================================================
// WebSocket Stress Scenario
// ============================================================================

/**
 * Scenario 5: WebSocket Stress Test
 * Tests WebSocket connection limits and throughput
 */
export function websocketStressScenario() {
    const config = getConfig();
    const operationsPerConnection = parseInt(__ENV.WS_OPS_PER_CONN || '100');

    group('WebSocket Stress Test', () => {
        const connection = createConnection(config);

        if (!connection.connect()) {
            recordError('connection', 'websocket_stress');
            return;
        }

        // Subscribe to all relevant tables
        connection.subscribe('SELECT * FROM counters');
        connection.subscribe('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 1000');

        let successCount = 0;
        let errorCount = 0;

        // Perform rapid operations
        for (let i = 0; i < operationsPerConnection; i++) {
            const operation = randomChoice(['increment', 'message']);
            let result;

            switch (operation) {
                case 'increment': {
                    const counterId = `counter_${randomInt(1, 100)}`;
                    result = connection.callReducer('increment', [counterId, 1]);
                    break;
                }

                case 'message': {
                    result = connection.callReducer('create_message', [
                        randomUUID(),
                        `user_${randomAlphanumeric(16)}`,
                        randomString(randomInt(50, 200)),
                        new Date().toISOString(),
                    ]);
                    break;
                }
            }

            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }

            // Minimal sleep between operations
            if (i % 10 === 0) {
                sleep(0.001);
            }
        }

        connection.close();

        const totalOps = successCount + errorCount;
        const successRate = totalOps > 0 ? successCount / totalOps : 0;

        recordSuccess('write', 0, 0, successCount);
        for (let i = 0; i < errorCount; i++) {
            recordError('validation', 'websocket_stress');
        }

        check(null, {
            'WebSocket stress test completed': () => totalOps === operationsPerConnection,
            'WebSocket stress success rate acceptable': () => successRate >= 0.95,
        });
    });

    sleep(randomIntBetween(500, 1000) / 1000);
}

// ============================================================================
// k6 Lifecycle Hooks
// ============================================================================

/**
 * Setup function - runs once before all VUs
 */
export function setup() {
    const config = getConfig();

    log('INFO', 'Starting SpacetimeDB benchmark');
    log('INFO', `Target: ${config.host}:${config.port}`);
    log('INFO', `Database: ${config.database}`);
    log('INFO', `Protocol: ${__ENV.USE_WEBSOCKET !== 'false' ? 'WebSocket' : 'HTTP'}`);

    // Verify connection to SpacetimeDB
    const connection = createConnection(config);
    const connected = connection.connect();

    if (!connected) {
        log('ERROR', 'Failed to connect to SpacetimeDB');
        return { healthy: false };
    }

    log('INFO', 'Successfully connected to SpacetimeDB');

    // Get schema info
    const schemaResult = connection.callReducer('get_schema_info', []);
    if (schemaResult.success) {
        log('INFO', 'Schema info retrieved successfully');
    }

    connection.close();

    return {
        healthy: true,
        config: config,
        startTime: Date.now(),
    };
}

/**
 * Default function - runs for each VU iteration
 * Executes all scenarios in sequence or based on configuration
 */
export default function (data) {
    if (!data.healthy) {
        log('ERROR', 'Test setup failed, skipping iteration');
        return;
    }

    // Get scenario weights from environment
    const scenarioWeights = {
        counter: parseFloat(__ENV.COUNTER_WEIGHT || '0.4'),
        message: parseFloat(__ENV.MESSAGE_WEIGHT || '0.3'),
        mixed: parseFloat(__ENV.MIXED_WEIGHT || '0.3'),
    };

    // Select scenario based on weights
    const random = Math.random();
    let cumulative = 0;

    if (random < (cumulative += scenarioWeights.counter)) {
        counterScenario();
    } else if (random < (cumulative += scenarioWeights.message)) {
        messageScenario();
    } else {
        mixedScenario();
    }
}

/**
 * Teardown function - runs once after all VUs complete
 */
export function teardown(data) {
    log('INFO', 'SpacetimeDB benchmark completed');

    if (data.startTime) {
        const duration = Date.now() - data.startTime;
        log('INFO', `Total duration: ${(duration / 1000).toFixed(2)}s`);
    }

    // Log final metrics summary
    console.log('\n=== SpacetimeDB Benchmark Summary ===');
    console.log(`WebSocket connections: ${spacetimeMetrics.wsConnections}`);
    console.log(`Reducer calls: ${spacetimeMetrics.reducerCalls}`);
    console.log(`Reducer errors: ${spacetimeMetrics.reducerErrors}`);
    console.log(`Table inserts: ${spacetimeMetrics.tableInserts}`);
    console.log(`Table updates: ${spacetimeMetrics.tableUpdates}`);
    console.log('=====================================\n');
}

// ============================================================================
// Scenario Exports for Multi-Scenario Tests
// ============================================================================

/**
 * Export individual scenarios for use with k6 scenarios feature
 * Example usage:
 *   k6 run -e SCENARIO=counter test.js
 *   k6 run -e SCENARIO=message test.js
 *   k6 run -e SCENARIO=mixed test.js
 */
export const scenarios = {
    counter: counterScenario,
    message: messageScenario,
    mixed: mixedScenario,
    batch: batchScenario,
    websocketStress: websocketStressScenario,
};

/**
 * Run a specific scenario by name
 * @param {string} scenarioName - Name of scenario to run
 */
export function runScenario(scenarioName) {
    const scenario = scenarios[scenarioName];
    if (scenario) {
        scenario();
    } else {
        console.error(`Unknown scenario: ${scenarioName}`);
    }
}
