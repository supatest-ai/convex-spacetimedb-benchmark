import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Convex schema for benchmark testing.
 *
 * This schema defines three tables for different workload types:
 * - counters: Simple increment operations (read-modify-write)
 * - messages: Write-heavy workload with high-frequency inserts
 * - events: Time-series-like data for range queries
 */

export default defineSchema({
  /**
   * Counters table for simple increment operations.
   * Used for testing read-modify-write patterns and atomic operations.
   */
  counters: defineTable({
    name: v.string(),
    value: v.number(),
    lastUpdated: v.number(), // timestamp in milliseconds
  })
    .index("by_name", ["name"])
    .index("by_lastUpdated", ["lastUpdated"]),

  /**
   * Messages table for write-heavy workload testing.
   * Simulates a chat or message queue with high-frequency inserts.
   */
  messages: defineTable({
    content: v.string(),
    sender: v.string(),
    channel: v.string(),
    timestamp: v.number(), // timestamp in milliseconds
    metadata: v.optional(v.object({
      priority: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    })),
  })
    .index("by_channel", ["channel"])
    .index("by_timestamp", ["timestamp"])
    .index("by_channel_timestamp", ["channel", "timestamp"])
    .index("by_sender", ["sender"]),

  /**
   * Events table for time-series-like data.
   * Used for testing range queries and time-based aggregations.
   */
  events: defineTable({
    type: v.string(),
    source: v.string(),
    timestamp: v.number(), // timestamp in milliseconds
    data: v.object({
      value: v.number(),
      unit: v.optional(v.string()),
    }),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_type", ["type"])
    .index("by_source", ["source"])
    .index("by_timestamp", ["timestamp"])
    .index("by_type_timestamp", ["type", "timestamp"])
    .index("by_source_timestamp", ["source", "timestamp"]),
});
