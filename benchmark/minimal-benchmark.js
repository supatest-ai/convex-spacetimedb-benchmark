/**
 * Minimal k6 Benchmark for Convex and SpacetimeDB
 */

import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const counterIncrements = new Counter('counter_increments_total');
const messageCreations = new Counter('message_creations_total');
const errors = new Counter('errors_total');
const requestDuration = new Trend('request_duration_ms');

// Configuration
const DB_TYPE = __ENV.DB_TYPE || 'convex';
const VUS = parseInt(__ENV.VUS || '20');
const DURATION = __ENV.DURATION || '30s';

// Database-specific config
const CONFIG = {
    convex: {
        baseUrl: 'http://localhost:3211',
        incrementEndpoint: '/api/increment',
        messageEndpoint: '/api/message',
        incrementBody: (name) => JSON.stringify({ name: `counter_${name}`, amount: 1 }),
        messageBody: (sender, content) => JSON.stringify({
            sender: `user_${sender}`,
            content: content,
            channel: 'benchmark'
        })
    },
    spacetimedb: {
        baseUrl: 'http://localhost:3000',
        identity: 'c200c938456103fe6da2f0f296a761ce478be28208b2c7ca46ed3df1aced3da7',
        incrementEndpoint: () => `/v1/database/${CONFIG.spacetimedb.identity}/call/increment_counter`,
        messageEndpoint: () => `/v1/database/${CONFIG.spacetimedb.identity}/call/create_message`,
        incrementBody: (name) => JSON.stringify([`counter_${name}`, 1]),
        messageBody: (sender, content) => JSON.stringify([`user_${sender}`, content, 'benchmark'])
    }
};

const config = CONFIG[DB_TYPE];

export const options = {
    vus: VUS,
    duration: DURATION,
    thresholds: {
        http_req_duration: ['p(95)<500'],
        errors_total: ['count<100']
    }
};

// Simple random number generator (no external deps)
function simpleRandom(max) {
    return Math.floor(Math.random() * max);
}

// Generate random string
function randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(simpleRandom(chars.length));
    }
    return result;
}

export default function () {
    const name = simpleRandom(1000);
    const sender = simpleRandom(100);
    const content = randomString(50);

    // Counter increment (70% of requests)
    if (simpleRandom(10) < 7) {
        const start = Date.now();
        const endpoint = DB_TYPE === 'spacetimedb'
            ? config.incrementEndpoint()
            : config.incrementEndpoint;

        const res = http.post(
            `${config.baseUrl}${endpoint}`,
            config.incrementBody(name),
            { headers: { 'Content-Type': 'application/json' } }
        );

        const duration = Date.now() - start;
        requestDuration.add(duration);

        const success = check(res, {
            'counter status is 200': (r) => r.status === 200,
        });

        if (success) {
            counterIncrements.add(1);
        } else {
            errors.add(1);
        }
    }
    // Message creation (30% of requests)
    else {
        const start = Date.now();
        const endpoint = DB_TYPE === 'spacetimedb'
            ? config.messageEndpoint()
            : config.messageEndpoint;

        const res = http.post(
            `${config.baseUrl}${endpoint}`,
            config.messageBody(sender, content),
            { headers: { 'Content-Type': 'application/json' } }
        );

        const duration = Date.now() - start;
        requestDuration.add(duration);

        const success = check(res, {
            'message status is 200': (r) => r.status === 200,
        });

        if (success) {
            messageCreations.add(1);
        } else {
            errors.add(1);
        }
    }
}

export function handleSummary(data) {
    const summary = {
        metadata: {
            database: DB_TYPE,
            timestamp: new Date().toISOString(),
            vus: VUS,
            duration: DURATION
        },
        metrics: {
            counterIncrements: data.metrics.counter_increments_total?.values?.count || 0,
            messageCreations: data.metrics.message_creations_total?.values?.count || 0,
            errors: data.metrics.errors_total?.values?.count || 0,
            httpRequests: data.metrics.http_reqs?.values?.count || 0,
            avgRequestDuration: data.metrics.http_req_duration?.values?.avg || 0,
            p95RequestDuration: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
            avgTrendDuration: data.metrics.request_duration_ms?.values?.avg || 0
        }
    };

    console.log('\n=== Benchmark Summary ===');
    console.log(JSON.stringify(summary, null, 2));

    return {
        'stdout': JSON.stringify(summary, null, 2)
    };
}
