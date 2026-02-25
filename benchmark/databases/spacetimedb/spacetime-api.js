/**
 * SpacetimeDB API Client for k6
 * Provides WebSocket and HTTP helpers for SpacetimeDB benchmarking
 *
 * SpacetimeDB Protocol Reference:
 * - WebSocket: ws://host:port/v1/database/{database}/subscribe
 * - HTTP API: http://host:port/v1/database/{database}/call/{reducer}
 */

import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
    metrics,
    recordSuccess,
    recordError,
    createTimer,
    randomUUID,
    randomAlphanumeric,
    randomInt,
    log
} from '../../utils.js';

// ============================================================================
// SpacetimeDB-Specific Metrics
// ============================================================================

export const spacetimeMetrics = {
    // WebSocket metrics
    wsConnections: new Counter('spacetime_ws_connections_total'),
    wsConnectionErrors: new Counter('spacetime_ws_connection_errors_total'),
    wsMessagesSent: new Counter('spacetime_ws_messages_sent_total'),
    wsMessagesReceived: new Counter('spacetime_ws_messages_received_total'),
    wsLatency: new Trend('spacetime_ws_latency_ms'),

    // Reducer metrics
    reducerCalls: new Counter('spacetime_reducer_calls_total'),
    reducerErrors: new Counter('spacetime_reducer_errors_total'),
    reducerLatency: new Trend('spacetime_reducer_latency_ms'),

    // Table metrics
    tableInserts: new Counter('spacetime_table_inserts_total'),
    tableUpdates: new Counter('spacetime_table_updates_total'),
    tableDeletes: new Counter('spacetime_table_deletes_total'),

    // Subscription metrics
    subscriptionLatency: new Trend('spacetime_subscription_latency_ms'),
    subscriptionErrors: new Counter('spacetime_subscription_errors_total'),

    // Connection quality
    connectionDrops: new Counter('spacetime_connection_drops_total'),
    reconnectAttempts: new Counter('spacetime_reconnect_attempts_total'),
};

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get SpacetimeDB configuration from environment variables
 * @returns {Object} Configuration object
 */
export function getConfig() {
    return {
        // Connection settings
        host: __ENV.SPACETIME_HOST || 'localhost',
        port: parseInt(__ENV.SPACETIME_PORT || '3000'),
        database: __ENV.SPACETIME_DATABASE || 'benchmark',
        identity: __ENV.SPACETIME_IDENTITY || '',
        token: __ENV.SPACETIME_TOKEN || '',

        // Protocol settings
        useSSL: __ENV.SPACETIME_SSL === 'true',
        wsPath: __ENV.SPACETIME_WS_PATH || '/v1/database/{database}/subscribe',
        httpPath: __ENV.SPACETIME_HTTP_PATH || '/v1/database/{database}/call',

        // Timeouts
        connectionTimeout: parseInt(__ENV.SPACETIME_CONN_TIMEOUT || '10000'),
        requestTimeout: parseInt(__ENV.SPACETIME_REQ_TIMEOUT || '30000'),
        wsPingInterval: parseInt(__ENV.SPACETIME_PING_INTERVAL || '30000'),

        // Retry settings
        maxRetries: parseInt(__ENV.SPACETIME_MAX_RETRIES || '3'),
        retryDelay: parseInt(__ENV.SPACETIME_RETRY_DELAY || '1000'),

        // Test data
        moduleName: __ENV.SPACETIME_MODULE || 'benchmark_module',
    };
}

/**
 * Build WebSocket URL for SpacetimeDB
 * @param {Object} config - Configuration object
 * @returns {string} WebSocket URL
 */
export function buildWsUrl(config) {
    const protocol = config.useSSL ? 'wss' : 'ws';
    const path = config.wsPath.replace('{database}', config.database);
    let url = `${protocol}://${config.host}:${config.port}${path}`;

    // Add authentication if provided
    const params = [];
    if (config.identity) {
        params.push(`identity=${encodeURIComponent(config.identity)}`);
    }
    if (config.token) {
        params.push(`token=${encodeURIComponent(config.token)}`);
    }

    if (params.length > 0) {
        url += `?${params.join('&')}`;
    }

    return url;
}

/**
 * Build HTTP URL for SpacetimeDB reducer calls
 * @param {Object} config - Configuration object
 * @param {string} reducer - Reducer name
 * @returns {string} HTTP URL
 */
export function buildHttpUrl(config, reducer) {
    const protocol = config.useSSL ? 'https' : 'http';
    const path = config.httpPath.replace('{database}', config.database);
    return `${protocol}://${config.host}:${config.port}${path}/${reducer}`;
}

// ============================================================================
// WebSocket Connection Management
// ============================================================================

/**
 * SpacetimeDB WebSocket connection state
 */
export const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    SUBSCRIBING: 'subscribing',
    SUBSCRIBED: 'subscribed',
    ERROR: 'error',
    CLOSING: 'closing',
};

/**
 * Create a new SpacetimeDB WebSocket connection
 * @param {Object} config - Configuration object
 * @returns {Object} Connection object with state and methods
 */
export function createConnection(config = null) {
    const cfg = config || getConfig();
    const url = buildWsUrl(cfg);

    return {
        config: cfg,
        url: url,
        socket: null,
        state: ConnectionState.DISCONNECTED,
        messageId: 0,
        pendingMessages: new Map(),
        subscriptions: new Map(),
        messageQueue: [],
        reconnectCount: 0,
        lastPing: 0,
        receivedMessages: [],

        /**
         * Connect to SpacetimeDB WebSocket
         * @returns {boolean} Success status
         */
        connect() {
            const timer = createTimer();
            this.state = ConnectionState.CONNECTING;

            try {
                const res = ws.connect(url, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'k6-spacetimedb-benchmark/1.0',
                    },
                }, (socket) => {
                    this.socket = socket;
                    this.state = ConnectionState.CONNECTED;
                    this.lastPing = Date.now();
                    spacetimeMetrics.wsConnections.add(1);

                    // Set up message handler
                    socket.on('message', (msg) => {
                        this._handleMessage(msg);
                    });

                    // Set up close handler
                    socket.on('close', () => {
                        this.state = ConnectionState.DISCONNECTED;
                        spacetimeMetrics.connectionDrops.add(1);
                    });

                    // Set up error handler
                    socket.on('error', (e) => {
                        this.state = ConnectionState.ERROR;
                        spacetimeMetrics.wsConnectionErrors.add(1);
                        console.error(`WebSocket error: ${e}`);
                    });

                    // Set up ping interval
                    if (cfg.wsPingInterval > 0) {
                        socket.setInterval(() => {
                            if (this.state === ConnectionState.CONNECTED ||
                                this.state === ConnectionState.SUBSCRIBED) {
                                this._sendPing();
                            }
                        }, cfg.wsPingInterval);
                    }
                });

                if (res.error) {
                    throw new Error(res.error);
                }

                const duration = timer.stop('connection', 0, 0);
                spacetimeMetrics.wsLatency.add(duration);

                return check(res, {
                    'WebSocket connection established': (r) => r && r.status === 101,
                });
            } catch (e) {
                this.state = ConnectionState.ERROR;
                timer.stopWithError('connection', 'connection');
                spacetimeMetrics.wsConnectionErrors.add(1);
                console.error(`Failed to connect: ${e.message}`);
                return false;
            }
        },

        /**
         * Handle incoming WebSocket message
         * @param {string} msg - Raw message data
         * @private
         */
        _handleMessage(msg) {
            spacetimeMetrics.wsMessagesReceived.add(1);
            this.receivedMessages.push(msg);

            try {
                const data = JSON.parse(msg);

                // Handle different message types
                if (data.type === 'subscription_update') {
                    this._handleSubscriptionUpdate(data);
                } else if (data.type === 'transaction_update') {
                    this._handleTransactionUpdate(data);
                } else if (data.type === 'identity_token') {
                    this._handleIdentityToken(data);
                } else if (data.type === 'pong') {
                    this.lastPing = Date.now();
                }

                // Resolve pending message promises
                if (data.request_id && this.pendingMessages.has(data.request_id)) {
                    const resolver = this.pendingMessages.get(data.request_id);
                    resolver(data);
                    this.pendingMessages.delete(data.request_id);
                }
            } catch (e) {
                // Binary message or parse error - just store it
            }
        },

        /**
         * Handle subscription update
         * @param {Object} data - Subscription update data
         * @private
         */
        _handleSubscriptionUpdate(data) {
            if (data.inserts) {
                spacetimeMetrics.tableInserts.add(data.inserts.length);
            }
            if (data.updates) {
                spacetimeMetrics.tableUpdates.add(data.updates.length);
            }
            if (data.deletes) {
                spacetimeMetrics.tableDeletes.add(data.deletes.length);
            }
        },

        /**
         * Handle transaction update
         * @param {Object} data - Transaction update data
         * @private
         */
        _handleTransactionUpdate(data) {
            if (data.status === 'committed') {
                spacetimeMetrics.reducerCalls.add(1);
            } else if (data.status === 'failed') {
                spacetimeMetrics.reducerErrors.add(1);
            }
        },

        /**
         * Handle identity token
         * @param {Object} data - Identity token data
         * @private
         */
        _handleIdentityToken(data) {
            if (data.identity) {
                this.identity = data.identity;
            }
            if (data.token) {
                this.token = data.token;
            }
        },

        /**
         * Send ping message
         * @private
         */
        _sendPing() {
            this._sendMessage({ type: 'ping', timestamp: Date.now() });
        },

        /**
         * Send message via WebSocket
         * @param {Object} data - Message data
         * @returns {boolean} Success status
         * @private
         */
        _sendMessage(data) {
            if (!this.socket || this.state === ConnectionState.DISCONNECTED) {
                return false;
            }

            try {
                const msg = JSON.stringify(data);
                this.socket.send(msg);
                spacetimeMetrics.wsMessagesSent.add(1);
                return true;
            } catch (e) {
                console.error(`Failed to send message: ${e.message}`);
                return false;
            }
        },

        /**
         * Subscribe to a query
         * @param {string} query - SQL query to subscribe to
         * @returns {Object} Subscription result
         */
        subscribe(query) {
            const timer = createTimer();
            this.state = ConnectionState.SUBSCRIBING;

            const requestId = `sub_${++this.messageId}_${randomAlphanumeric(8)}`;

            const success = this._sendMessage({
                type: 'subscribe',
                request_id: requestId,
                query: query,
            });

            if (!success) {
                timer.stopWithError('connection', 'subscription');
                spacetimeMetrics.subscriptionErrors.add(1);
                return { success: false, error: 'Failed to send subscription' };
            }

            // Wait for subscription confirmation (simplified)
            sleep(0.1);

            this.state = ConnectionState.SUBSCRIBED;
            this.subscriptions.set(requestId, { query, timestamp: Date.now() });

            const duration = timer.stop('subscription', 0, 0);
            spacetimeMetrics.subscriptionLatency.add(duration);

            return { success: true, subscriptionId: requestId };
        },

        /**
         * Call a reducer via WebSocket
         * @param {string} reducer - Reducer name
         * @param {Array} args - Reducer arguments
         * @returns {Object} Call result
         */
        callReducer(reducer, args = []) {
            const timer = createTimer();

            const requestId = `call_${++this.messageId}_${randomAlphanumeric(8)}`;

            const success = this._sendMessage({
                type: 'call',
                request_id: requestId,
                reducer: reducer,
                args: args,
            });

            if (!success) {
                timer.stopWithError('connection', 'reducer');
                spacetimeMetrics.reducerErrors.add(1);
                return { success: false, error: 'Failed to send reducer call' };
            }

            // Wait for response (simplified - in production, use proper async handling)
            sleep(0.05);

            const duration = timer.stop('reducer', 0, 0);
            spacetimeMetrics.reducerLatency.add(duration);

            return { success: true, requestId: requestId };
        },

        /**
         * Close the WebSocket connection
         */
        close() {
            this.state = ConnectionState.CLOSING;
            if (this.socket) {
                this.socket.close();
            }
            this.state = ConnectionState.DISCONNECTED;
        },

        /**
         * Check if connection is healthy
         * @returns {boolean} Health status
         */
        isHealthy() {
            return this.state === ConnectionState.CONNECTED ||
                   this.state === ConnectionState.SUBSCRIBED;
        },
    };
}

// ============================================================================
// HTTP API Methods
// ============================================================================

/**
 * Call a reducer via HTTP API
 * @param {string} reducer - Reducer name
 * @param {Array} args - Reducer arguments
 * @param {Object} config - Configuration object
 * @returns {Object} HTTP response
 */
export function callReducerHttp(reducer, args = [], config = null) {
    const cfg = config || getConfig();
    const url = buildHttpUrl(cfg, reducer);
    const timer = createTimer();

    const payload = JSON.stringify({ args: args });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'k6-spacetimedb-benchmark/1.0',
        },
        timeout: cfg.requestTimeout,
    };

    if (cfg.token) {
        params.headers['Authorization'] = `Bearer ${cfg.token}`;
    }

    let response;
    let retries = 0;

    while (retries <= cfg.maxRetries) {
        response = http.post(url, payload, params);

        if (response.status === 200 || response.status === 201) {
            const duration = timer.stop('write', payload.length, 1);
            spacetimeMetrics.reducerLatency.add(duration);
            spacetimeMetrics.reducerCalls.add(1);

            check(response, {
                'Reducer call successful': (r) => r.status === 200 || r.status === 201,
                'Reducer response valid': (r) => {
                    try {
                        const body = JSON.parse(r.body);
                        return body !== null;
                    } catch (e) {
                        return false;
                    }
                },
            });

            return {
                success: true,
                status: response.status,
                body: response.body,
                duration: duration,
            };
        }

        if (response.status >= 500) {
            // Server error - retry
            retries++;
            if (retries <= cfg.maxRetries) {
                sleep(cfg.retryDelay / 1000);
                spacetimeMetrics.reconnectAttempts.add(1);
            }
        } else {
            // Client error - don't retry
            break;
        }
    }

    timer.stopWithError('validation', 'reducer');
    spacetimeMetrics.reducerErrors.add(1);

    check(response, {
        'Reducer call failed': (r) => false,
    });

    return {
        success: false,
        status: response.status,
        body: response.body,
        error: `HTTP ${response.status}`,
    };
}

/**
 * Query data via HTTP API
 * @param {string} query - SQL query
 * @param {Object} config - Configuration object
 * @returns {Object} HTTP response
 */
export function queryHttp(query, config = null) {
    const cfg = config || getConfig();
    const protocol = cfg.useSSL ? 'https' : 'http';
    const url = `${protocol}://${cfg.host}:${cfg.port}/v1/database/${cfg.database}/sql`;
    const timer = createTimer();

    const payload = JSON.stringify({ query: query });

    const params = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'k6-spacetimedb-benchmark/1.0',
        },
        timeout: cfg.requestTimeout,
    };

    if (cfg.token) {
        params.headers['Authorization'] = `Bearer ${cfg.token}`;
    }

    const response = http.post(url, payload, params);

    if (response.status === 200) {
        const bodyLength = response.body ? response.body.length : 0;
        const duration = timer.stop('read', bodyLength, 1);
        spacetimeMetrics.wsLatency.add(duration);

        check(response, {
            'Query successful': (r) => r.status === 200,
            'Query response valid': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return Array.isArray(body) || typeof body === 'object';
                } catch (e) {
                    return false;
                }
            },
        });

        return {
            success: true,
            status: response.status,
            body: response.body,
            duration: duration,
        };
    }

    timer.stopWithError('validation', 'query');

    check(response, {
        'Query failed': (r) => false,
    });

    return {
        success: false,
        status: response.status,
        body: response.body,
        error: `HTTP ${response.status}`,
    };
}

/**
 * Get database schema via HTTP API
 * @param {Object} config - Configuration object
 * @returns {Object} Schema response
 */
export function getSchema(config = null) {
    const cfg = config || getConfig();
    const protocol = cfg.useSSL ? 'https' : 'http';
    const url = `${protocol}://${cfg.host}:${cfg.port}/v1/database/${cfg.database}/schema`;

    const params = {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'k6-spacetimedb-benchmark/1.0',
        },
        timeout: cfg.requestTimeout,
    };

    if (cfg.token) {
        params.headers['Authorization'] = `Bearer ${cfg.token}`;
    }

    const response = http.get(url, params);

    check(response, {
        'Schema fetch successful': (r) => r.status === 200,
    });

    return {
        success: response.status === 200,
        status: response.status,
        body: response.body,
    };
}

// ============================================================================
// High-Level Operations
// ============================================================================

/**
 * Increment a counter via reducer
 * @param {string} counterId - Counter identifier
 * @param {number} amount - Amount to increment
 * @param {boolean} useWebSocket - Use WebSocket instead of HTTP
 * @param {Object} connection - WebSocket connection (if using WebSocket)
 * @param {Object} config - Configuration object
 * @returns {Object} Operation result
 */
export function incrementCounter(counterId, amount = 1, useWebSocket = false, connection = null, config = null) {
    const args = [counterId, amount];

    if (useWebSocket && connection) {
        return connection.callReducer('increment', args);
    }

    return callReducerHttp('increment', args, config);
}

/**
 * Create a message
 * @param {string} content - Message content
 * @param {string} sender - Sender identifier
 * @param {boolean} useWebSocket - Use WebSocket instead of HTTP
 * @param {Object} connection - WebSocket connection (if using WebSocket)
 * @param {Object} config - Configuration object
 * @returns {Object} Operation result
 */
export function createMessage(content, sender, useWebSocket = false, connection = null, config = null) {
    const messageId = randomUUID();
    const timestamp = new Date().toISOString();
    const args = [messageId, sender, content, timestamp];

    if (useWebSocket && connection) {
        return connection.callReducer('create_message', args);
    }

    return callReducerHttp('create_message', args, config);
}

/**
 * Read messages from the database
 * @param {number} limit - Maximum number of messages to read
 * @param {Object} config - Configuration object
 * @returns {Object} Query result
 */
export function readMessages(limit = 100, config = null) {
    const query = `SELECT * FROM messages ORDER BY timestamp DESC LIMIT ${limit}`;
    return queryHttp(query, config);
}

/**
 * Read counter value
 * @param {string} counterId - Counter identifier
 * @param {Object} config - Configuration object
 * @returns {Object} Query result
 */
export function readCounter(counterId, config = null) {
    const query = `SELECT * FROM counters WHERE id = '${counterId}'`;
    return queryHttp(query, config);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Execute batch operations
 * @param {Array} operations - Array of operation objects
 * @param {Object} config - Configuration object
 * @returns {Object} Batch results
 */
export function executeBatch(operations, config = null) {
    const timer = createTimer();
    const results = [];

    for (const op of operations) {
        let result;

        switch (op.type) {
            case 'increment':
                result = incrementCounter(op.counterId, op.amount, false, null, config);
                break;
            case 'message':
                result = createMessage(op.content, op.sender, false, null, config);
                break;
            case 'query':
                result = queryHttp(op.query, config);
                break;
            default:
                result = { success: false, error: 'Unknown operation type' };
        }

        results.push(result);

        // Small delay between operations to avoid overwhelming the server
        if (operations.length > 10) {
            sleep(0.001);
        }
    }

    const successCount = results.filter(r => r.success).length;
    const duration = timer.stop('batch', 0, operations.length);

    return {
        success: successCount === operations.length,
        total: operations.length,
        successful: successCount,
        failed: operations.length - successCount,
        duration: duration,
        results: results,
    };
}

// ============================================================================
// Connection Pool Management
// ============================================================================

/**
 * Simple connection pool for WebSocket connections
 * @param {number} size - Pool size
 * @param {Object} config - Configuration object
 * @returns {Object} Connection pool
 */
export function createConnectionPool(size = 5, config = null) {
    const connections = [];
    let currentIndex = 0;

    return {
        connections: connections,

        /**
         * Initialize the connection pool
         * @returns {boolean} Success status
         */
        init() {
            for (let i = 0; i < size; i++) {
                const conn = createConnection(config);
                if (conn.connect()) {
                    connections.push(conn);
                } else {
                    console.warn(`Failed to create connection ${i + 1}/${size}`);
                }
            }

            return connections.length > 0;
        },

        /**
         * Get a connection from the pool (round-robin)
         * @returns {Object} Connection object
         */
        getConnection() {
            if (connections.length === 0) {
                return null;
            }

            const conn = connections[currentIndex];
            currentIndex = (currentIndex + 1) % connections.length;
            return conn;
        },

        /**
         * Get a healthy connection from the pool
         * @returns {Object} Healthy connection or null
         */
        getHealthyConnection() {
            for (let i = 0; i < connections.length; i++) {
                const conn = this.getConnection();
                if (conn && conn.isHealthy()) {
                    return conn;
                }
            }
            return null;
        },

        /**
         * Close all connections in the pool
         */
        closeAll() {
            for (const conn of connections) {
                conn.close();
            }
            connections.length = 0;
        },

        /**
         * Get pool statistics
         * @returns {Object} Pool stats
         */
        getStats() {
            const healthy = connections.filter(c => c.isHealthy()).length;
            return {
                total: connections.length,
                healthy: healthy,
                unhealthy: connections.length - healthy,
            };
        },
    };
}

// ============================================================================
// Export all utilities
// ============================================================================

export default {
    // Configuration
    getConfig,
    buildWsUrl,
    buildHttpUrl,

    // Connection management
    ConnectionState,
    createConnection,
    createConnectionPool,

    // HTTP API
    callReducerHttp,
    queryHttp,
    getSchema,

    // High-level operations
    incrementCounter,
    createMessage,
    readMessages,
    readCounter,

    // Batch operations
    executeBatch,

    // Metrics
    spacetimeMetrics,
};
