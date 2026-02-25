import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Convex Queries for Benchmark
 *
 * These queries are used by the actions to fetch data.
 */

/**
 * Get a counter by name.
 */
export const getCounterByName = query({
  args: {
    name: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("counters"),
      _creationTime: v.number(),
      name: v.string(),
      value: v.number(),
      lastUpdated: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
  },
});

/**
 * Get messages by channel.
 */
export const getMessagesByChannel = query({
  args: {
    channel: v.string(),
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_channel", (q) => q.eq("channel", args.channel))
      .order("desc")
      .take(args.limit);
  },
});

/**
 * Get messages by sender.
 */
export const getMessagesBySender = query({
  args: {
    sender: v.string(),
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("sender", args.sender))
      .order("desc")
      .take(args.limit);
  },
});

/**
 * Get all messages (most recent first).
 */
export const getAllMessages = query({
  args: {
    limit: v.number(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit);
  },
});

/**
 * Get events by type.
 */
export const getEventsByType = query({
  args: {
    type: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("events")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get events by time range.
 */
export const getEventsByTimeRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    return await ctx.db
      .query("events")
      .withIndex("by_timestamp", (q) =>
        q.gte("timestamp", args.startTime).lte("timestamp", args.endTime)
      )
      .order("desc")
      .take(limit);
  },
});
