/**
 * Shared utilities for k6 benchmark tests
 * Provides random data generators, metrics collectors, and helper functions
 */

import { Counter, Rate, Trend } from 'k6/metrics';
import { randomBytes, randomIntBetween } from 'k6/crypto';

// ============================================================================
// Custom Metrics
// ============================================================================

/**
 * Custom metrics for comprehensive performance tracking
 */
export const metrics = {
    // Transaction metrics
    transactions: new Counter('transactions_total'),
    transactionErrors: new Counter('transaction_errors_total'),
    transactionRate: new Rate('transaction_success_rate'),

    // Latency metrics (in milliseconds)
    latency: new Trend('latency_ms'),
    readLatency: new Trend('read_latency_ms'),
    writeLatency: new Trend('write_latency_ms'),
    deleteLatency: new Trend('delete_latency_ms'),
    batchLatency: new Trend('batch_latency_ms'),

    // Throughput metrics
    bytesRead: new Counter('bytes_read_total'),
    bytesWritten: new Counter('bytes_written_total'),
    recordsRead: new Counter('records_read_total'),
    recordsWritten: new Counter('records_written_total'),

    // Error metrics
    errorRate: new Rate('error_rate'),
    timeoutErrors: new Counter('timeout_errors_total'),
    connectionErrors: new Counter('connection_errors_total'),
    validationErrors: new Counter('validation_errors_total'),
};

// ============================================================================
// Random Data Generators
// ============================================================================

/**
 * Generate a random string of specified length
 * @param {number} length - Length of the string to generate
 * @param {string} charset - Character set to use (default: alphanumeric)
 * @returns {string} Random string
 */
export function randomString(length, charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    let result = '';
    const charsetLength = charset.length;
    const bytes = randomBytes(length);
    for (let i = 0; i < length; i++) {
        result += charset[bytes[i] % charsetLength];
    }
    return result;
}

/**
 * Generate a random alphanumeric string
 * @param {number} length - Length of the string
 * @returns {string} Random alphanumeric string
 */
export function randomAlphanumeric(length) {
    return randomString(length, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
}

/**
 * Generate a random numeric string
 * @param {number} length - Length of the string
 * @returns {string} Random numeric string
 */
export function randomNumeric(length) {
    return randomString(length, '0123456789');
}

/**
 * Generate a random UUID-like string
 * @returns {string} UUID-like string
 */
export function randomUUID() {
    const hex = '0123456789abcdef';
    let uuid = '';
    const bytes = randomBytes(16);
    for (let i = 0; i < 16; i++) {
        if (i === 4 || i === 6 || i === 8 || i === 10) {
            uuid += '-';
        }
        if (i === 6) {
            uuid += '4'; // Version 4 UUID
        } else if (i === 8) {
            uuid += hex[(bytes[i] & 0x3) | 0x8]; // Variant
        } else {
            uuid += hex[bytes[i] % 16];
        }
    }
    return uuid;
}

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export function randomInt(min, max) {
    return randomIntBetween(min, max);
}

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} decimals - Number of decimal places
 * @returns {number} Random float
 */
export function randomFloat(min, max, decimals = 2) {
    const value = Math.random() * (max - min) + min;
    return parseFloat(value.toFixed(decimals));
}

/**
 * Generate random bytes as Uint8Array
 * @param {number} length - Number of bytes
 * @returns {Uint8Array} Random bytes
 */
export function randomBinary(length) {
    return randomBytes(length);
}

/**
 * Generate a random boolean
 * @param {number} probability - Probability of true (0-1)
 * @returns {boolean} Random boolean
 */
export function randomBool(probability = 0.5) {
    return Math.random() < probability;
}

/**
 * Pick a random element from an array
 * @param {Array} array - Array to pick from
 * @returns {*} Random element
 */
export function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate a random date between start and end
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} Random date
 */
export function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random ISO timestamp
 * @param {number} daysBack - Maximum days back from now
 * @returns {string} ISO timestamp
 */
export function randomTimestamp(daysBack = 365) {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    return randomDate(past, now).toISOString();
}

/**
 * Generate a random email address
 * @returns {string} Random email
 */
export function randomEmail() {
    const domains = ['example.com', 'test.com', 'demo.org', 'sample.net'];
    const local = randomAlphanumeric(randomIntBetween(5, 15)).toLowerCase();
    const domain = randomChoice(domains);
    return `${local}@${domain}`;
}

/**
 * Generate a random JSON object
 * @param {number} depth - Current recursion depth
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Object} Random JSON object
 */
export function randomJSON(depth = 0, maxDepth = 3) {
    if (depth >= maxDepth) {
        return randomChoice([
            randomAlphanumeric(10),
            randomInt(0, 1000),
            randomBool(),
            null
        ]);
    }

    const type = randomChoice(['object', 'array', 'primitive']);

    switch (type) {
        case 'object': {
            const obj = {};
            const numKeys = randomInt(1, 5);
            for (let i = 0; i < numKeys; i++) {
                obj[randomAlphanumeric(5)] = randomJSON(depth + 1, maxDepth);
            }
            return obj;
        }
        case 'array': {
            const arr = [];
            const numItems = randomInt(1, 5);
            for (let i = 0; i < numItems; i++) {
                arr.push(randomJSON(depth + 1, maxDepth));
            }
            return arr;
        }
        default:
            return randomChoice([
                randomAlphanumeric(10),
                randomInt(0, 1000),
                randomBool(),
                null
            ]);
    }
}

// ============================================================================
// Data Generators for Specific Use Cases
// ============================================================================

/**
 * Generate a random user record
 * @returns {Object} User record
 */
export function generateUser() {
    return {
        id: randomUUID(),
        username: randomAlphanumeric(12),
        email: randomEmail(),
        name: `User ${randomAlphanumeric(8)}`,
        age: randomInt(18, 80),
        createdAt: randomTimestamp(),
        active: randomBool(0.8),
        metadata: randomJSON(0, 2)
    };
}

/**
 * Generate a random sensor reading
 * @returns {Object} Sensor reading
 */
export function generateSensorReading() {
    return {
        sensorId: randomAlphanumeric(16),
        timestamp: new Date().toISOString(),
        temperature: randomFloat(-20, 50, 2),
        humidity: randomFloat(0, 100, 2),
        pressure: randomFloat(980, 1050, 2),
        location: {
            lat: randomFloat(-90, 90, 6),
            lon: randomFloat(-180, 180, 6)
        }
    };
}

/**
 * Generate a random event
 * @returns {Object} Event record
 */
export function generateEvent() {
    const eventTypes = ['click', 'view', 'purchase', 'login', 'logout', 'signup'];
    return {
        eventId: randomUUID(),
        eventType: randomChoice(eventTypes),
        userId: randomAlphanumeric(16),
        timestamp: new Date().toISOString(),
        properties: randomJSON(0, 2),
        sessionId: randomAlphanumeric(32)
    };
}

/**
 * Generate a batch of records
 * @param {number} size - Batch size
 * @param {Function} generator - Generator function
 * @returns {Array} Array of generated records
 */
export function generateBatch(size, generator) {
    const batch = [];
    for (let i = 0; i < size; i++) {
        batch.push(generator());
    }
    return batch;
}

// ============================================================================
// Metrics Collection Helpers
// ============================================================================

/**
 * Record a successful transaction
 * @param {string} operation - Operation type (read, write, delete, batch)
 * @param {number} duration - Duration in milliseconds
 * @param {number} bytesProcessed - Bytes processed (optional)
 * @param {number} recordsProcessed - Records processed (optional)
 */
export function recordSuccess(operation, duration, bytesProcessed = 0, recordsProcessed = 1) {
    metrics.transactions.add(1);
    metrics.transactionRate.add(true);
    metrics.latency.add(duration);

    // Record operation-specific latency
    switch (operation) {
        case 'read':
            metrics.readLatency.add(duration);
            metrics.recordsRead.add(recordsProcessed);
            break;
        case 'write':
            metrics.writeLatency.add(duration);
            metrics.recordsWritten.add(recordsProcessed);
            break;
        case 'delete':
            metrics.deleteLatency.add(duration);
            break;
        case 'batch':
            metrics.batchLatency.add(duration);
            metrics.recordsWritten.add(recordsProcessed);
            break;
    }

    if (bytesProcessed > 0) {
        if (operation === 'read') {
            metrics.bytesRead.add(bytesProcessed);
        } else {
            metrics.bytesWritten.add(bytesProcessed);
        }
    }
}

/**
 * Record a failed transaction
 * @param {string} errorType - Type of error (timeout, connection, validation)
 * @param {string} operation - Operation that failed
 */
export function recordError(errorType, operation) {
    metrics.transactions.add(1);
    metrics.transactionErrors.add(1);
    metrics.transactionRate.add(false);
    metrics.errorRate.add(true);

    switch (errorType) {
        case 'timeout':
            metrics.timeoutErrors.add(1);
            break;
        case 'connection':
            metrics.connectionErrors.add(1);
            break;
        case 'validation':
            metrics.validationErrors.add(1);
            break;
    }
}

/**
 * Create a timer that records duration when stopped
 * @returns {Object} Timer object with start() and stop(operation) methods
 */
export function createTimer() {
    const startTime = Date.now();
    return {
        stop: (operation, bytesProcessed = 0, recordsProcessed = 1) => {
            const duration = Date.now() - startTime;
            recordSuccess(operation, duration, bytesProcessed, recordsProcessed);
            return duration;
        },
        stopWithError: (errorType, operation) => {
            recordError(errorType, operation);
            return Date.now() - startTime;
        }
    };
}

// ============================================================================
// Reporting Helpers
// ============================================================================

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex++;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format duration to human-readable string
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string
 */
export function formatDuration(ms) {
    if (ms < 1000) {
        return `${ms.toFixed(2)} ms`;
    } else if (ms < 60000) {
        return `${(ms / 1000).toFixed(2)} s`;
    } else {
        return `${(ms / 60000).toFixed(2)} min`;
    }
}

/**
 * Calculate TPS (transactions per second) from metrics
 * @param {number} totalTransactions - Total transactions
 * @param {number} durationMs - Duration in milliseconds
 * @returns {number} TPS
 */
export function calculateTPS(totalTransactions, durationMs) {
    return durationMs > 0 ? (totalTransactions / (durationMs / 1000)) : 0;
}

/**
 * Generate a summary report
 * @param {Object} data - Test data from k6
 * @returns {Object} Formatted report
 */
export function generateReport(data) {
    const duration = data.state.testRunDurationMs;
    const metrics_data = data.metrics;

    return {
        summary: {
            duration: formatDuration(duration),
            totalTransactions: metrics_data.transactions_total?.values?.count || 0,
            errorRate: metrics_data.error_rate?.values?.rate || 0,
            avgLatency: metrics_data.latency_ms?.values?.avg || 0,
            p95Latency: metrics_data.latency_ms?.values['p(95)'] || 0,
            p99Latency: metrics_data.latency_ms?.values['p(99)'] || 0,
        },
        throughput: {
            tps: calculateTPS(
                metrics_data.transactions_total?.values?.count || 0,
                duration
            ),
            bytesRead: formatBytes(metrics_data.bytes_read_total?.values?.count || 0),
            bytesWritten: formatBytes(metrics_data.bytes_written_total?.values?.count || 0),
        },
        latency: {
            read: {
                avg: metrics_data.read_latency_ms?.values?.avg || 0,
                p95: metrics_data.read_latency_ms?.values['p(95)'] || 0,
            },
            write: {
                avg: metrics_data.write_latency_ms?.values?.avg || 0,
                p95: metrics_data.write_latency_ms?.values['p(95)'] || 0,
            },
            delete: {
                avg: metrics_data.delete_latency_ms?.values?.avg || 0,
                p95: metrics_data.delete_latency_ms?.values['p(95)'] || 0,
            },
            batch: {
                avg: metrics_data.batch_latency_ms?.values?.avg || 0,
                p95: metrics_data.batch_latency_ms?.values['p(95)'] || 0,
            },
        }
    };
}

/**
 * Log a formatted message with timestamp
 * @param {string} level - Log level (INFO, WARN, ERROR)
 * @param {string} message - Message to log
 */
export function log(level, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Validate response and record metrics
 * @param {Object} response - Response object
 * @param {Array} checks - Array of check functions
 * @param {string} operation - Operation type
 * @returns {boolean} Whether all checks passed
 */
export function validateResponse(response, checks, operation) {
    const timer = createTimer();
    let allPassed = true;

    for (const check of checks) {
        if (!check(response)) {
            allPassed = false;
            break;
        }
    }

    if (allPassed) {
        const bodyLength = response.body ? response.body.length : 0;
        timer.stop(operation, bodyLength);
    } else {
        timer.stopWithError('validation', operation);
    }

    return allPassed;
}

// ============================================================================
// Connection Helpers
// ============================================================================

/**
 * Get connection configuration from environment variables
 * @returns {Object} Connection config
 */
export function getConnectionConfig() {
    return {
        host: __ENV.DB_HOST || 'localhost',
        port: parseInt(__ENV.DB_PORT || '5432'),
        database: __ENV.DB_NAME || 'test',
        username: __ENV.DB_USER || 'test',
        password: __ENV.DB_PASSWORD || 'test',
        ssl: __ENV.DB_SSL === 'true',
        maxConnections: parseInt(__ENV.DB_MAX_CONNECTIONS || '10'),
        connectionTimeout: parseInt(__ENV.DB_CONNECTION_TIMEOUT || '5000'),
    };
}

/**
 * Get test configuration from environment variables
 * @returns {Object} Test config
 */
export function getTestConfig() {
    return {
        // Data generation
        keyPrefix: __ENV.KEY_PREFIX || 'k6-test',
        valueSize: parseInt(__ENV.VALUE_SIZE || '100'),
        batchSize: parseInt(__ENV.BATCH_SIZE || '100'),

        // Test behavior
        readWriteRatio: parseFloat(__ENV.READ_WRITE_RATIO || '0.8'),
        hotKeyRatio: parseFloat(__ENV.HOT_KEY_RATIO || '0.2'),
        hotKeyCount: parseInt(__ENV.HOT_KEY_COUNT || '100'),

        // Duration settings
        rampUpDuration: __ENV.RAMP_UP_DURATION || '30s',
        steadyStateDuration: __ENV.STEADY_STATE_DURATION || '5m',
        rampDownDuration: __ENV.RAMP_DOWN_DURATION || '30s',
    };
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate a key with optional prefix
 * @param {string} prefix - Key prefix
 * @returns {string} Generated key
 */
export function generateKey(prefix = 'k6') {
    return `${prefix}:${randomUUID()}`;
}

/**
 * Generate a hot key (frequently accessed key)
 * @param {number} index - Hot key index
 * @param {string} prefix - Key prefix
 * @returns {string} Hot key
 */
export function generateHotKey(index, prefix = 'k6') {
    return `${prefix}:hot:${index}`;
}

/**
 * Get a key using hot key distribution
 * @param {number} hotKeyCount - Number of hot keys
 * @param {number} hotKeyRatio - Probability of returning a hot key
 * @param {string} prefix - Key prefix
 * @returns {string} Key
 */
export function getDistributedKey(hotKeyCount, hotKeyRatio, prefix = 'k6') {
    if (Math.random() < hotKeyRatio) {
        return generateHotKey(randomInt(0, hotKeyCount - 1), prefix);
    }
    return generateKey(prefix);
}

// ============================================================================
// Export all utilities
// ============================================================================

export default {
    // Metrics
    metrics,

    // Generators
    randomString,
    randomAlphanumeric,
    randomNumeric,
    randomUUID,
    randomInt,
    randomFloat,
    randomBinary,
    randomBool,
    randomChoice,
    randomDate,
    randomTimestamp,
    randomEmail,
    randomJSON,
    generateUser,
    generateSensorReading,
    generateEvent,
    generateBatch,

    // Metrics helpers
    recordSuccess,
    recordError,
    createTimer,

    // Reporting
    formatBytes,
    formatDuration,
    calculateTPS,
    generateReport,
    log,
    validateResponse,

    // Configuration
    getConnectionConfig,
    getTestConfig,

    // Keys
    generateKey,
    generateHotKey,
    getDistributedKey,
};
