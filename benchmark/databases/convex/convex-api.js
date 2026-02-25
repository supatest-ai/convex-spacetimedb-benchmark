/**
 * Convex HTTP API Helper Functions
 * Provides utilities for interacting with Convex HTTP Actions
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { randomString, randomInt, randomUUID, randomJSON } from '../../utils.js';

// ============================================================================
// Convex-Specific Metrics
// ============================================================================

export const convexMetrics = {
    // HTTP-specific metrics
    httpErrors: new Counter('convex_http_errors_total'),
    authErrors: new Counter('convex_auth_errors_total'),
    rateLimitHits: new Counter('convex_rate_limit_hits_total'),

    // Action-specific metrics
    actionDuration: new Trend('convex_action_duration_ms'),
    mutationLatency: new Trend('convex_mutation_latency_ms'),
    queryLatency: new Trend('convex_query_latency_ms'),

    // Success rates by action type
    mutationSuccessRate: new Rate('convex_mutation_success_rate'),
    querySuccessRate: new Rate('convex_query_success_rate'),
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get Convex configuration from environment variables
 * @returns {Object} Convex configuration
 */
export function getConvexConfig() {
    const host = __ENV.CONVEX_HOST || 'localhost';
    const port = __ENV.CONVEX_PORT || '3210';
    const adminPort = __ENV.CONVEX_ADMIN_PORT || '3211';

    return {
        // Connection settings
        host,
        port: parseInt(port),
        adminPort: parseInt(adminPort),
        baseUrl: `http://${host}:${port}`,
        adminUrl: `http://${host}:${adminPort}`,

        // Authentication
        adminKey: __ENV.CONVEX_ADMIN_KEY || 'test-admin-key',
        siteUrl: __ENV.CONVEX_SITE_URL || '',

        // Action paths (customize based on your Convex deployment)
        actions: {
            incrementCounter: __ENV.CONVEX_ACTION_INCREMENT || 'counter/increment',
            getCounter: __ENV.CONVEX_ACTION_GET_COUNTER || 'counter/get',
            createMessage: __ENV.CONVEX_ACTION_CREATE_MESSAGE || 'messages/create',
            getMessages: __ENV.CONVEX_ACTION_GET_MESSAGES || 'messages/list',
            mixedOperation: __ENV.CONVEX_ACTION_MIXED || 'benchmark/mixed',
        },

        // Retry configuration
        maxRetries: parseInt(__ENV.CONVEX_MAX_RETRIES || '3'),
        retryDelay: parseInt(__ENV.CONVEX_RETRY_DELAY_MS || '100'),

        // Request timeouts
        timeout: __ENV.CONVEX_TIMEOUT || '30s',

        // Test data configuration
        counterName: __ENV.CONVEX_COUNTER_NAME || 'benchmark-counter',
        messageSize: parseInt(__ENV.CONVEX_MESSAGE_SIZE || '1000'),
    };
}

// ============================================================================
// HTTP Request Helpers
// ============================================================================

/**
 * Default headers for Convex HTTP requests
 * @param {Object} config - Convex configuration
 * @returns {Object} Headers object
 */
function getDefaultHeaders(config) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'k6-convex-benchmark/1.0',
    };

    if (config.adminKey) {
        headers['Authorization'] = `Bearer ${config.adminKey}`;
    }

    if (config.siteUrl) {
        headers['Origin'] = config.siteUrl;
    }

    return headers;
}

/**
 * Make an HTTP request to Convex with retry logic
 * @param {string} method - HTTP method
 * @param {string} url - Full URL
 * @param {Object} body - Request body
 * @param {Object} config - Convex configuration
 * @param {Object} params - Additional k6 http params
 * @returns {Object} HTTP response
 */
export function convexRequest(method, url, body = null, config = null, params = {}) {
    const cfg = config || getConvexConfig();
    const headers = getDefaultHeaders(cfg);

    const requestParams = {
        headers: { ...headers, ...params.headers },
        timeout: cfg.timeout,
        ...params,
    };

    let lastError = null;
    let response = null;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
        const startTime = Date.now();

        try {
            if (method === 'GET') {
                response = http.get(url, requestParams);
            } else if (method === 'POST') {
                const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
                response = http.post(url, bodyString, requestParams);
            } else if (method === 'PUT') {
                const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
                response = http.put(url, bodyString, requestParams);
            } else if (method === 'DELETE') {
                response = http.del(url, null, requestParams);
            } else if (method === 'PATCH') {
                const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
                response = http.patch(url, bodyString, requestParams);
            }

            // Check for rate limiting
            if (response.status === 429) {
                convexMetrics.rateLimitHits.add(1);
                if (attempt < cfg.maxRetries) {
                    const retryAfter = parseInt(response.headers['Retry-After'] || '1');
                    sleep(retryAfter);
                    continue;
                }
            }

            // Check for auth errors
            if (response.status === 401 || response.status === 403) {
                convexMetrics.authErrors.add(1);
            }

            // Record latency for successful requests
            if (response.status < 400) {
                const duration = Date.now() - startTime;
                convexMetrics.actionDuration.add(duration);
            }

            return response;

        } catch (error) {
            lastError = error;
            if (attempt < cfg.maxRetries) {
                sleep(cfg.retryDelay / 1000);
            }
        }
    }

    // All retries exhausted
    convexMetrics.httpErrors.add(1);

    // Return a mock response object for failed requests
    return {
        status: 0,
        statusText: lastError ? lastError.message : 'Request failed after retries',
        body: null,
        error: lastError,
        error_code: lastError ? lastError.name : 'UnknownError',
        request: { url, method },
        timings: { duration: 0 },
    };
}

/**
 * Call a Convex HTTP action
 * @param {string} actionPath - Action path (e.g., 'counter/increment')
 * @param {Object} args - Action arguments
 * @param {Object} config - Convex configuration
 * @param {Object} params - Additional k6 http params
 * @returns {Object} HTTP response
 */
export function callConvexAction(actionPath, args = {}, config = null, params = {}) {
    const cfg = config || getConvexConfig();

    // Convex HTTP actions are typically at /api/actions/<actionPath>
    const url = `${cfg.baseUrl}/api/actions/${actionPath}`;

    return convexRequest('POST', url, args, cfg, params);
}

/**
 * Call a Convex query (read-only)
 * @param {string} actionPath - Query action path
 * @param {Object} args - Query arguments
 * @param {Object} config - Convex configuration
 * @param {Object} params - Additional k6 http params
 * @returns {Object} HTTP response
 */
export function callConvexQuery(actionPath, args = {}, config = null, params = {}) {
    const cfg = config || getConvexConfig();

    // Convex queries can be GET requests with query params or POST with body
    const url = `${cfg.baseUrl}/api/actions/${actionPath}`;

    const startTime = Date.now();
    const response = convexRequest('POST', url, args, cfg, params);
    const duration = Date.now() - startTime;

    // Record query-specific metrics
    if (response.status < 400) {
        convexMetrics.queryLatency.add(duration);
        convexMetrics.querySuccessRate.add(true);
    } else {
        convexMetrics.querySuccessRate.add(false);
    }

    return response;
}

/**
 * Call a Convex mutation (write operation)
 * @param {string} actionPath - Mutation action path
 * @param {Object} args - Mutation arguments
 * @param {Object} config - Convex configuration
 * @param {Object} params - Additional k6 http params
 * @returns {Object} HTTP response
 */
export function callConvexMutation(actionPath, args = {}, config = null, params = {}) {
    const cfg = config || getConvexConfig();

    const url = `${cfg.baseUrl}/api/actions/${actionPath}`;

    const startTime = Date.now();
    const response = convexRequest('POST', url, args, cfg, params);
    const duration = Date.now() - startTime;

    // Record mutation-specific metrics
    if (response.status < 400) {
        convexMetrics.mutationLatency.add(duration);
        convexMetrics.mutationSuccessRate.add(true);
    } else {
        convexMetrics.mutationSuccessRate.add(false);
    }

    return response;
}

// ============================================================================
// Response Validation
// ============================================================================

/**
 * Validate a Convex response
 * @param {Object} response - HTTP response object
 * @param {Array} additionalChecks - Additional check functions
 * @returns {boolean} Whether all checks passed
 */
export function validateConvexResponse(response, additionalChecks = []) {
    const checks = {
        'status is success': (r) => r.status >= 200 && r.status < 300,
        'response has body': (r) => r.body !== null && r.body !== undefined,
        'response is valid JSON': (r) => {
            try {
                JSON.parse(r.body);
                return true;
            } catch (e) {
                return false;
            }
        },
    };

    // Add additional checks
    for (const [name, fn] of Object.entries(additionalChecks)) {
        checks[name] = fn;
    }

    return check(response, checks);
}

/**
 * Parse Convex response body safely
 * @param {Object} response - HTTP response object
 * @returns {Object|null} Parsed JSON or null
 */
export function parseConvexResponse(response) {
    if (!response.body) {
        return null;
    }

    try {
        return JSON.parse(response.body);
    } catch (e) {
        return null;
    }
}

/**
 * Check if response indicates a Convex error
 * @param {Object} response - HTTP response object
 * @returns {boolean} True if response contains Convex error
 */
export function isConvexError(response) {
    if (response.status >= 400) {
        return true;
    }

    const body = parseConvexResponse(response);
    if (body && (body.error || body.success === false)) {
        return true;
    }

    return false;
}

// ============================================================================
// Test Data Generators
// ============================================================================

/**
 * Generate a random message payload
 * @param {number} size - Approximate size in bytes
 * @returns {Object} Message object
 */
export function generateMessage(size = 1000) {
    const targetLength = Math.floor(size / 2); // Rough estimate for JSON

    const message = {
        id: randomUUID(),
        content: randomString(Math.min(targetLength, 5000)),
        author: randomString(16),
        timestamp: new Date().toISOString(),
        metadata: randomJSON(0, 2),
        tags: Array.from({ length: randomInt(1, 5) }, () => randomString(8)),
    };

    // Add padding to reach approximate size
    const currentSize = JSON.stringify(message).length;
    if (currentSize < size) {
        message.padding = randomString(size - currentSize);
    }

    return message;
}

/**
 * Generate counter increment arguments
 * @param {string} counterName - Name of the counter
 * @param {number} amount - Amount to increment
 * @returns {Object} Counter arguments
 */
export function generateCounterArgs(counterName, amount = 1) {
    return {
        name: counterName,
        amount: amount,
        timestamp: new Date().toISOString(),
        clientId: randomUUID(),
    };
}

/**
 * Generate mixed operation arguments
 * @param {string} operationType - Type of operation
 * @returns {Object} Operation arguments
 */
export function generateMixedOperationArgs(operationType = 'random') {
    const types = ['read', 'write', 'update', 'delete'];
    const type = operationType === 'random' ? types[randomInt(0, types.length - 1)] : operationType;

    return {
        operation: type,
        id: randomUUID(),
        data: type !== 'read' && type !== 'delete' ? generateMessage(500) : null,
        timestamp: new Date().toISOString(),
    };
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check if Convex is reachable
 * @param {Object} config - Convex configuration
 * @returns {boolean} True if Convex is healthy
 */
export function checkConvexHealth(config = null) {
    const cfg = config || getConvexConfig();

    try {
        // Try the admin health endpoint first
        const adminResponse = http.get(`${cfg.adminUrl}/health`, {
            timeout: '5s',
        });

        if (adminResponse.status === 200) {
            return true;
        }
    } catch (e) {
        // Admin endpoint might not be available, try main endpoint
    }

    try {
        // Try a simple GET to the base URL
        const response = http.get(cfg.baseUrl, {
            timeout: '5s',
        });

        return response.status < 500;
    } catch (e) {
        return false;
    }
}

/**
 * Wait for Convex to become available
 * @param {Object} config - Convex configuration
 * @param {number} maxWaitSeconds - Maximum time to wait
 * @returns {boolean} True if Convex became available
 */
export function waitForConvex(config = null, maxWaitSeconds = 30) {
    const cfg = config || getConvexConfig();

    console.log(`Waiting for Convex at ${cfg.baseUrl}...`);

    for (let i = 0; i < maxWaitSeconds; i++) {
        if (checkConvexHealth(cfg)) {
            console.log('Convex is ready!');
            return true;
        }
        sleep(1);
    }

    console.error(`Convex did not become available within ${maxWaitSeconds} seconds`);
    return false;
}

// ============================================================================
// Export all utilities
// ============================================================================

export default {
    // Metrics
    convexMetrics,

    // Configuration
    getConvexConfig,

    // HTTP helpers
    convexRequest,
    callConvexAction,
    callConvexQuery,
    callConvexMutation,

    // Validation
    validateConvexResponse,
    parseConvexResponse,
    isConvexError,

    // Data generators
    generateMessage,
    generateCounterArgs,
    generateMixedOperationArgs,

    // Health check
    checkConvexHealth,
    waitForConvex,
};
