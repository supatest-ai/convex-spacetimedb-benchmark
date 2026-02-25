import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * HTTP Router for Convex Benchmark
 *
 * Maps HTTP endpoints to actions:
 * - POST /api/increment -> actions.incrementCounter
 * - POST /api/message -> actions.createMessage
 * - GET /api/counter/:name -> actions.getCounter
 * - GET /api/messages -> actions.getMessages
 */

const http = httpRouter();

/**
 * POST /api/increment
 * Increment a counter by name.
 *
 * Request body: { name: string, amount?: number }
 */
http.route({
  path: "/api/increment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.actions.incrementCounter, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * POST /api/message
 * Create a new message.
 *
 * Request body: { content: string, sender: string, channel: string, metadata?: object }
 */
http.route({
  path: "/api/message",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const result = await ctx.runAction(api.actions.createMessage, body);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * GET /api/counter?name=test
 * Get a counter by name.
 */
http.route({
  path: "/api/counter",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const name = url.searchParams.get("name");

      if (!name) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Missing 'name' query parameter",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const result = await ctx.runAction(api.actions.getCounter, { name });

      if (!result.success) {
        return new Response(JSON.stringify(result), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

/**
 * GET /api/messages
 * Get messages with optional filtering.
 *
 * Query params: channel?: string, sender?: string, limit?: number
 */
http.route({
  path: "/api/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const params = url.searchParams;

      const args: {
        channel?: string;
        sender?: string;
        limit?: number;
      } = {};

      if (params.has("channel")) {
        args.channel = params.get("channel") || undefined;
      }
      if (params.has("sender")) {
        args.sender = params.get("sender") || undefined;
      }
      if (params.has("limit")) {
        const limit = parseInt(params.get("limit") || "100", 10);
        if (!isNaN(limit)) {
          args.limit = limit;
        }
      }

      const result = await ctx.runAction(api.actions.getMessages, args);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

export default http;
