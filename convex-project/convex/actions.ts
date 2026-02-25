import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

/**
 * HTTP Actions for Convex Benchmark
 *
 * These actions provide HTTP endpoints for:
 * - incrementCounter: POST /api/increment
 * - createMessage: POST /api/message
 * - getCounter: GET /api/counter/:name
 * - getMessages: GET /api/messages
 */

/**
 * POST /api/increment
 * Increment a counter by name, creating it if it doesn't exist.
 *
 * Request body: { name: string, amount?: number }
 * Response: { success: true, name: string, value: number, lastUpdated: number }
 */
export const incrementCounter = action({
  args: {
    name: v.string(),
    amount: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    name: v.string(),
    value: v.number(),
    lastUpdated: v.number(),
  }),
  handler: async (ctx, args) => {
    const amount = args.amount ?? 1;
    const now = Date.now();

    try {
      // Try to find existing counter
      const existing = await ctx.runQuery(api.queries.getCounterByName, {
        name: args.name,
      });

      if (existing) {
        // Update existing counter
        const updated = await ctx.runMutation(api.mutations.updateCounter, {
          id: existing._id,
          amount: amount,
          lastUpdated: now,
        });
        return {
          success: true,
          name: args.name,
          value: updated.value,
          lastUpdated: updated.lastUpdated,
        };
      } else {
        // Create new counter
        const created = await ctx.runMutation(api.mutations.createCounter, {
          name: args.name,
          value: amount,
          lastUpdated: now,
        });
        return {
          success: true,
          name: args.name,
          value: created.value,
          lastUpdated: created.lastUpdated,
        };
      }
    } catch (error) {
      throw new Error(`Failed to increment counter: ${error}`);
    }
  },
});

/**
 * POST /api/message
 * Create a new message.
 *
 * Request body: { content: string, sender: string, channel: string, metadata?: object }
 * Response: { success: true, id: string, timestamp: number }
 */
export const createMessage = action({
  args: {
    content: v.string(),
    sender: v.string(),
    channel: v.string(),
    metadata: v.optional(v.object({
      priority: v.optional(v.number()),
      tags: v.optional(v.array(v.string())),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    id: v.string(),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();

    try {
      const id = await ctx.runMutation(api.mutations.insertMessage, {
        content: args.content,
        sender: args.sender,
        channel: args.channel,
        timestamp: now,
        metadata: args.metadata,
      });

      return {
        success: true,
        id: id,
        timestamp: now,
      };
    } catch (error) {
      throw new Error(`Failed to create message: ${error}`);
    }
  },
});

/**
 * GET /api/counter/:name
 * Get a counter by name.
 *
 * Response: { success: true, name: string, value: number, lastUpdated: number }
 * Or: { success: false, error: string } if not found
 */
export const getCounter = action({
  args: {
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    name: v.string(),
    value: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      const counter = await ctx.runQuery(api.queries.getCounterByName, {
        name: args.name,
      });

      if (!counter) {
        return {
          success: false,
          name: args.name,
          error: "Counter not found",
        };
      }

      return {
        success: true,
        name: args.name,
        value: counter.value,
        lastUpdated: counter.lastUpdated,
      };
    } catch (error) {
      return {
        success: false,
        name: args.name,
        error: `Failed to get counter: ${error}`,
      };
    }
  },
});

/**
 * GET /api/messages
 * Get messages with optional filtering.
 *
 * Query params: channel?: string, sender?: string, limit?: number
 * Response: { success: true, messages: array }
 */
export const getMessages = action({
  args: {
    channel: v.optional(v.string()),
    sender: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    messages: v.array(v.any()),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    try {
      const limit = args.limit ?? 100;

      let messages;
      if (args.channel) {
        messages = await ctx.runQuery(api.queries.getMessagesByChannel, {
          channel: args.channel,
          limit: limit,
        });
      } else if (args.sender) {
        messages = await ctx.runQuery(api.queries.getMessagesBySender, {
          sender: args.sender,
          limit: limit,
        });
      } else {
        messages = await ctx.runQuery(api.queries.getAllMessages, {
          limit: limit,
        });
      }

      return {
        success: true,
        messages: messages,
        count: messages.length,
      };
    } catch (error) {
      throw new Error(`Failed to get messages: ${error}`);
    }
  },
});
