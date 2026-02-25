import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Convex Mutations for Benchmark
 *
 * These mutations are used by the actions to modify data.
 */

/**
 * Create a new counter.
 */
export const createCounter = mutation({
  args: {
    name: v.string(),
    value: v.number(),
    lastUpdated: v.number(),
  },
  returns: v.object({
    _id: v.id("counters"),
    name: v.string(),
    value: v.number(),
    lastUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("counters", {
      name: args.name,
      value: args.value,
      lastUpdated: args.lastUpdated,
    });
    return {
      _id: id,
      name: args.name,
      value: args.value,
      lastUpdated: args.lastUpdated,
    };
  },
});

/**
 * Update a counter by ID (increment).
 */
export const updateCounter = mutation({
  args: {
    id: v.id("counters"),
    amount: v.number(),
    lastUpdated: v.number(),
  },
  returns: v.object({
    _id: v.id("counters"),
    value: v.number(),
    lastUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    const counter = await ctx.db.get(args.id);
    if (!counter) {
      throw new Error("Counter not found");
    }

    const newValue = counter.value + args.amount;
    await ctx.db.patch(args.id, {
      value: newValue,
      lastUpdated: args.lastUpdated,
    });

    return {
      _id: args.id,
      value: newValue,
      lastUpdated: args.lastUpdated,
    };
  },
});

/**
 * Insert a new message.
 */
export const insertMessage = mutation({
  args: {
    content: v.string(),
    sender: v.string(),
    channel: v.string(),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      priority: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    })),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      content: args.content,
      sender: args.sender,
      channel: args.channel,
      timestamp: args.timestamp,
      metadata: args.metadata,
    });
    return id;
  },
});

/**
 * Insert a new event.
 */
export const insertEvent = mutation({
  args: {
    type: v.string(),
    source: v.string(),
    timestamp: v.number(),
    data: v.object({
      value: v.number(),
      unit: v.optional(v.string()),
    }),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("events", {
      type: args.type,
      source: args.source,
      timestamp: args.timestamp,
      data: args.data,
      tags: args.tags,
    });
    return id;
  },
});

/**
 * Delete old messages (cleanup operation).
 */
export const deleteOldMessages = mutation({
  args: {
    beforeTimestamp: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.beforeTimestamp))
      .collect();

    let deletedCount = 0;
    for (const message of messages) {
      await ctx.db.delete(message._id);
      deletedCount++;
    }

    return deletedCount;
  },
});

/**
 * Delete old events (cleanup operation).
 */
export const deleteOldEvents = mutation({
  args: {
    beforeTimestamp: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const events = await ctx.db
      .query("events")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", args.beforeTimestamp))
      .collect();

    let deletedCount = 0;
    for (const event of events) {
      await ctx.db.delete(event._id);
      deletedCount++;
    }

    return deletedCount;
  },
});
