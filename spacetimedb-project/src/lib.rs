//! SpacetimeDB Benchmark Module
//! This module provides the same functionality as the Convex benchmark for fair comparison

use spacetimedb::{table, reducer, Table, Timestamp};

// ============================================================================
// Table Definitions
// ============================================================================

/// Counters table - stores named counter values
/// Equivalent to Convex counters for benchmarking
#[table(name = counter, public)]
pub struct Counter {
    /// Primary key - counter name
    #[primary_key]
    pub name: String,
    /// Current counter value
    pub value: i64,
    /// Last update timestamp
    pub last_updated: Timestamp,
}

/// Messages table - stores chat messages
/// Equivalent to Convex messages for benchmarking
#[table(name = message, public)]
pub struct Message {
    /// Auto-increment primary key
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// Message sender
    pub sender: String,
    /// Message content
    pub content: String,
    /// Channel name
    pub channel: String,
    /// Message timestamp
    pub timestamp: Timestamp,
}

/// Events table - stores event log entries
/// Equivalent to Convex events for benchmarking
#[table(name = event, public)]
pub struct Event {
    /// Auto-increment primary key
    #[primary_key]
    #[auto_inc]
    pub id: u64,
    /// Event type
    pub event_type: String,
    /// Event source
    pub source: String,
    /// Event data (JSON string)
    pub data: String,
    /// Event timestamp
    pub timestamp: Timestamp,
}

// ============================================================================
// Reducers (Mutations)
// ============================================================================

/// Increment a counter by the specified amount
/// Creates the counter if it doesn't exist
#[reducer]
pub fn increment_counter(ctx: &spacetimedb::ReducerContext, name: String, amount: i64) {
    let timestamp = ctx.timestamp;
    let counters = ctx.db.counter();

    // Check if counter exists by trying to find it
    let existing = counters.iter().find(|c| c.name == name);

    if let Some(counter) = existing {
        // Delete old and insert updated (SpacetimeDB pattern for updates)
        let new_value = counter.value + amount;
        counters.delete(counter);
        counters.insert(Counter {
            name,
            value: new_value,
            last_updated: timestamp,
        });
    } else {
        // Create new counter
        counters.insert(Counter {
            name,
            value: amount,
            last_updated: timestamp,
        });
    }
}

/// Create a new message in the specified channel
#[reducer]
pub fn create_message(
    ctx: &spacetimedb::ReducerContext,
    sender: String,
    content: String,
    channel: String,
) {
    let timestamp = ctx.timestamp;

    ctx.db.message().insert(Message {
        id: 0, // Will be auto-generated
        sender,
        content,
        channel,
        timestamp,
    });
}

/// Create a new event log entry
#[reducer]
pub fn create_event(
    ctx: &spacetimedb::ReducerContext,
    event_type: String,
    source: String,
    data: String,
) {
    let timestamp = ctx.timestamp;

    ctx.db.event().insert(Event {
        id: 0, // Will be auto-generated
        event_type,
        source,
        data,
        timestamp,
    });
}

// ============================================================================
// Initialization
// ============================================================================

/// Called when the module is first published/initialized
#[reducer]
pub fn init(_ctx: &spacetimedb::ReducerContext) {
    // Initialize with some default data if needed
    // This runs once when the module is published
}

/// Called when the module is updated to a new version
#[reducer]
pub fn on_module_update(_ctx: &spacetimedb::ReducerContext) {
    // Handle any migration logic here
}
