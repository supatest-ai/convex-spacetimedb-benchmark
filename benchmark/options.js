/**
 * k6 Load Test Configuration Options
 * Defines various load profiles and common settings for database benchmarks
 */

// ============================================================================
// Common Configuration
// ============================================================================

/**
 * Common thresholds applied to all test configurations
 */
export const commonThresholds = {
    // Error rate should be less than 1%
    'error_rate': ['rate<0.01'],

    // Overall latency thresholds
    'latency_ms': ['p(95)<500', 'p(99)<1000', 'avg<200'],

    // Operation-specific latency thresholds
    'read_latency_ms': ['p(95)<300', 'p(99)<600'],
    'write_latency_ms': ['p(95)<400', 'p(99)<800'],
    'delete_latency_ms': ['p(95)<300', 'p(99)<600'],
    'batch_latency_ms': ['p(95)<1000', 'p(99)<2000'],

    // Success rate should be above 99%
    'transaction_success_rate': ['rate>0.99'],
};

/**
 * Common options shared across all test configurations
 */
export const commonOptions = {
    // Discard response bodies to reduce memory usage
    discardResponseBodies: true,

    // Summary trend stats to report
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],

    // System tags to include in metrics
    systemTags: ['status', 'method', 'url', 'name', 'check', 'error', 'error_code', 'scenario', 'group'],

    // Maximum HTTP redirects to follow
    maxRedirects: 10,

    // User agent string
    userAgent: 'k6-database-benchmark/1.0',
};

// ============================================================================
// Load Stage Definitions
// ============================================================================

/**
 * Standard load stage durations
 */
export const stageDurations = {
    quick: {
        rampUp: '10s',
        steadyState: '30s',
        rampDown: '10s',
    },
    standard: {
        rampUp: '30s',
        steadyState: '5m',
        rampDown: '30s',
    },
    extended: {
        rampUp: '1m',
        steadyState: '10m',
        rampDown: '1m',
    },
    soak: {
        rampUp: '2m',
        steadyState: '30m',
        rampDown: '2m',
    },
    stress: {
        rampUp: '5m',
        steadyState: '10m',
        rampDown: '5m',
    },
};

// ============================================================================
// TPS-Based Load Profiles
// ============================================================================

/**
 * Generate stages for a target TPS profile
 * @param {number} targetVUs - Target number of virtual users
 * @param {Object} durations - Stage durations configuration
 * @returns {Array} k6 stages array
 */
function generateStages(targetVUs, durations) {
    return [
        { duration: durations.rampUp, target: targetVUs },
        { duration: durations.steadyState, target: targetVUs },
        { duration: durations.rampDown, target: 0 },
    ];
}

/**
 * 100 TPS load profile (Light load)
 * Good for: Smoke tests, baseline measurements
 */
export const tps100 = {
    ...commonOptions,
    stages: generateStages(10, stageDurations.standard),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<100', 'p(99)<200', 'avg<50'],
    },
    tags: { tps: '100', profile: 'light' },
};

/**
 * 200 TPS load profile (Low load)
 * Good for: Development testing, small deployments
 */
export const tps200 = {
    ...commonOptions,
    stages: generateStages(20, stageDurations.standard),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<150', 'p(99)<300', 'avg<75'],
    },
    tags: { tps: '200', profile: 'low' },
};

/**
 * 500 TPS load profile (Medium load)
 * Good for: Production-like testing, medium deployments
 */
export const tps500 = {
    ...commonOptions,
    stages: generateStages(50, stageDurations.standard),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<200', 'p(99)<400', 'avg<100'],
    },
    tags: { tps: '500', profile: 'medium' },
};

/**
 * 1000 TPS load profile (High load)
 * Good for: High-traffic production testing, large deployments
 */
export const tps1000 = {
    ...commonOptions,
    stages: generateStages(100, stageDurations.standard),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<300', 'p(99)<600', 'avg<150'],
    },
    tags: { tps: '1000', profile: 'high' },
};

/**
 * 2000 TPS load profile (Very high load)
 * Good for: Stress testing, enterprise deployments
 */
export const tps2000 = {
    ...commonOptions,
    stages: generateStages(200, stageDurations.extended),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<400', 'p(99)<800', 'avg<200'],
    },
    tags: { tps: '2000', profile: 'very-high' },
};

/**
 * 5000 TPS load profile (Extreme load)
 * Good for: Maximum capacity testing, large-scale systems
 */
export const tps5000 = {
    ...commonOptions,
    stages: generateStages(500, stageDurations.extended),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<500', 'p(99)<1000', 'avg<250'],
        'error_rate': ['rate<0.05'], // Allow slightly higher error rate at extreme load
    },
    tags: { tps: '5000', profile: 'extreme' },
};

// ============================================================================
// Scenario-Based Load Profiles
// ============================================================================

/**
 * Smoke test configuration
 * Quick test to verify the system works
 */
export const smokeTest = {
    ...commonOptions,
    vus: 1,
    iterations: 10,
    thresholds: {
        'latency_ms': ['p(95)<100'],
        'error_rate': ['rate==0'],
    },
    tags: { profile: 'smoke' },
};

/**
 * Spike test configuration
 * Sudden increase in load to test system resilience
 */
export const spikeTest = {
    ...commonOptions,
    stages: [
        { duration: '10s', target: 10 },   // Baseline
        { duration: '5s', target: 200 },   // Sudden spike
        { duration: '2m', target: 200 },   // Hold spike
        { duration: '5s', target: 10 },    // Drop back
        { duration: '1m', target: 10 },    // Recovery
        { duration: '10s', target: 0 },    // Cool down
    ],
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<1000', 'p(99)<2000'], // Relaxed during spike
    },
    tags: { profile: 'spike' },
};

/**
 * Ramp-up test configuration
 * Gradually increasing load to find breaking point
 */
export const rampUpTest = {
    ...commonOptions,
    stages: [
        { duration: '2m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 300 },
        { duration: '2m', target: 400 },
        { duration: '2m', target: 500 },
        { duration: '2m', target: 0 },
    ],
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<1000'], // Relaxed as we push limits
    },
    tags: { profile: 'ramp-up' },
};

/**
 * Soak test configuration
 * Extended duration test for stability and memory leak detection
 */
export const soakTest = {
    ...commonOptions,
    stages: generateStages(50, stageDurations.soak),
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<200', 'p(99)<400'],
    },
    tags: { profile: 'soak' },
};

/**
 * Stress test configuration
 * Push system beyond normal capacity
 */
export const stressTest = {
    ...commonOptions,
    stages: [
        { duration: '5m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 400 },
        { duration: '5m', target: 600 },
        { duration: '5m', target: 800 },
        { duration: '5m', target: 1000 },
        { duration: '5m', target: 0 },
    ],
    thresholds: {
        'latency_ms': ['p(95)<2000'], // Very relaxed, we're looking for breaking point
        'error_rate': ['rate<0.10'],   // Allow up to 10% errors during stress
    },
    tags: { profile: 'stress' },
};

// ============================================================================
// Combined Scenarios
// ============================================================================

/**
 * Mixed workload scenario
 * Simulates realistic mixed read/write traffic
 */
export const mixedWorkload = {
    ...commonOptions,
    scenarios: {
        reads: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: generateStages(30, stageDurations.standard),
            exec: 'readScenario',
            tags: { operation: 'read' },
        },
        writes: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: generateStages(20, stageDurations.standard),
            exec: 'writeScenario',
            tags: { operation: 'write' },
        },
        deletes: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: generateStages(10, stageDurations.standard),
            exec: 'deleteScenario',
            tags: { operation: 'delete' },
        },
    },
    thresholds: {
        ...commonThresholds,
        'http_req_duration{operation:read}': ['p(95)<300'],
        'http_req_duration{operation:write}': ['p(95)<400'],
        'http_req_duration{operation:delete}': ['p(95)<300'],
    },
    tags: { profile: 'mixed' },
};

/**
 * Burst test configuration
 * Periodic bursts of high traffic
 */
export const burstTest = {
    ...commonOptions,
    stages: [
        { duration: '1m', target: 20 },   // Normal load
        { duration: '10s', target: 200 }, // Burst 1
        { duration: '1m', target: 20 },   // Normal
        { duration: '10s', target: 200 }, // Burst 2
        { duration: '1m', target: 20 },   // Normal
        { duration: '10s', target: 200 }, // Burst 3
        { duration: '1m', target: 20 },   // Normal
        { duration: '30s', target: 0 },   // Cool down
    ],
    thresholds: {
        ...commonThresholds,
        'latency_ms': ['p(95)<800', 'p(99)<1500'], // Relaxed during bursts
    },
    tags: { profile: 'burst' },
};

// ============================================================================
// Configuration Presets
// ============================================================================

/**
 * All available load profiles
 */
export const loadProfiles = {
    // TPS-based profiles
    tps100,
    tps200,
    tps500,
    tps1000,
    tps2000,
    tps5000,

    // Scenario-based profiles
    smoke: smokeTest,
    spike: spikeTest,
    rampUp: rampUpTest,
    soak: soakTest,
    stress: stressTest,
    mixed: mixedWorkload,
    burst: burstTest,
};

/**
 * Get a load profile by name
 * @param {string} name - Profile name
 * @returns {Object} Load profile configuration
 */
export function getLoadProfile(name) {
    const profile = loadProfiles[name];
    if (!profile) {
        throw new Error(`Unknown load profile: ${name}. Available profiles: ${Object.keys(loadProfiles).join(', ')}`);
    }
    return profile;
}

/**
 * Create a custom load profile
 * @param {number} targetVUs - Target virtual users
 * @param {string} durationType - Duration type (quick, standard, extended, soak, stress)
 * @param {Object} customThresholds - Additional thresholds
 * @returns {Object} Custom load profile
 */
export function createCustomProfile(targetVUs, durationType = 'standard', customThresholds = {}) {
    const durations = stageDurations[durationType] || stageDurations.standard;
    return {
        ...commonOptions,
        stages: generateStages(targetVUs, durations),
        thresholds: {
            ...commonThresholds,
            ...customThresholds,
        },
        tags: { custom: 'true', targetVUs: String(targetVUs) },
    };
}

// ============================================================================
// Export all configurations
// ============================================================================

export default {
    commonThresholds,
    commonOptions,
    stageDurations,
    loadProfiles,
    getLoadProfile,
    createCustomProfile,

    // Individual profiles
    tps100,
    tps200,
    tps500,
    tps1000,
    tps2000,
    tps5000,
    smokeTest,
    spikeTest,
    rampUpTest,
    soakTest,
    stressTest,
    mixedWorkload,
    burstTest,
};
