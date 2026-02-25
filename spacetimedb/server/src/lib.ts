// SpacetimeDB Benchmark Module
// This module defines tables and reducers for benchmarking real-time database performance

import {
  spacetime,
  AlgebraicType,
  Identity,
  Timestamp,
} from "@clockworklabs/spacetimedb-sdk";

// ============================================================================
// Table Definitions
// ============================================================================

// Simple counter table for basic read/write benchmarks
@spacetime.table
export class Counters {
  @spacetime.primaryKey
  id: string = "";

  name: string = "";
  value: number = 0;
  updatedAt: Timestamp = 0n;
  updatedBy: Identity = new Identity();
}

// Messages table for pub/sub latency benchmarks
@spacetime.table
export class Messages {
  @spacetime.primaryKey
  id: string = "";

  content: string = "";
  sender: Identity = new Identity();
  sentAt: Timestamp = 0n;
  sequence: number = 0;
}

// Events table for complex query benchmarks
@spacetime.table
export class Events {
  @spacetime.primaryKey
  id: string = "";

  eventType: string = "";
  payload: string = "";
  priority: number = 0;
  createdAt: Timestamp = 0n;
  processed: boolean = false;
}

// Benchmark sessions for tracking test runs
@spacetime.table
export class BenchmarkSessions {
  @spacetime.primaryKey
  id: string = "";

  name: string = "";
  startedAt: Timestamp = 0n;
  endedAt: Timestamp | null = null;
  config: string = "";
  createdBy: Identity = new Identity();
}

// ============================================================================
// Reducers
// ============================================================================

// Counter reducers
@spacetime.reducer
export function incrementCounter(ctx: spacetime.ReducerContext, counterId: string, amount: number): void {
  const counter = Counters.findById(counterId);

  if (counter) {
    counter.value += amount;
    counter.updatedAt = ctx.timestamp;
    counter.updatedBy = ctx.sender;
    Counters.update(counter);
  } else {
    const newCounter = new Counters();
    newCounter.id = counterId;
    newCounter.name = counterId;
    newCounter.value = amount;
    newCounter.updatedAt = ctx.timestamp;
    newCounter.updatedBy = ctx.sender;
    Counters.insert(newCounter);
  }
}

@spacetime.reducer
export function setCounter(ctx: spacetime.ReducerContext, counterId: string, value: number): void {
  const counter = Counters.findById(counterId);

  if (counter) {
    counter.value = value;
    counter.updatedAt = ctx.timestamp;
    counter.updatedBy = ctx.sender;
    Counters.update(counter);
  } else {
    const newCounter = new Counters();
    newCounter.id = counterId;
    newCounter.name = counterId;
    newCounter.value = value;
    newCounter.updatedAt = ctx.timestamp;
    newCounter.updatedBy = ctx.sender;
    Counters.insert(newCounter);
  }
}

@spacetime.reducer
export function deleteCounter(_ctx: spacetime.ReducerContext, counterId: string): void {
  const counter = Counters.findById(counterId);
  if (counter) {
    Counters.delete(counter);
  }
}

// Message reducers
@spacetime.reducer
export function addMessage(ctx: spacetime.ReducerContext, content: string, sequence: number): void {
  const message = new Messages();
  message.id = `${ctx.sender.toHexString()}_${ctx.timestamp}_${sequence}`;
  message.content = content;
  message.sender = ctx.sender;
  message.sentAt = ctx.timestamp;
  message.sequence = sequence;
  Messages.insert(message);
}

@spacetime.reducer
export function deleteMessage(_ctx: spacetime.ReducerContext, messageId: string): void {
  const message = Messages.findById(messageId);
  if (message) {
    Messages.delete(message);
  }
}

@spacetime.reducer
export function clearAllMessages(_ctx: spacetime.ReducerContext): void {
  for (const message of Messages.iter()) {
    Messages.delete(message);
  }
}

// Event reducers
@spacetime.reducer
export function createEvent(
  ctx: spacetime.ReducerContext,
  eventType: string,
  payload: string,
  priority: number
): void {
  const event = new Events();
  event.id = `${ctx.sender.toHexString()}_${ctx.timestamp}`;
  event.eventType = eventType;
  event.payload = payload;
  event.priority = priority;
  event.createdAt = ctx.timestamp;
  event.processed = false;
  Events.insert(event);
}

@spacetime.reducer
export function markEventProcessed(_ctx: spacetime.ReducerContext, eventId: string): void {
  const event = Events.findById(eventId);
  if (event) {
    event.processed = true;
    Events.update(event);
  }
}

@spacetime.reducer
export function deleteEvent(_ctx: spacetime.ReducerContext, eventId: string): void {
  const event = Events.findById(eventId);
  if (event) {
    Events.delete(event);
  }
}

@spacetime.reducer
export function clearProcessedEvents(_ctx: spacetime.ReducerContext): void {
  for (const event of Events.iter()) {
    if (event.processed) {
      Events.delete(event);
    }
  }
}

// Benchmark session reducers
@spacetime.reducer
export function startBenchmarkSession(ctx: spacetime.ReducerContext, name: string, config: string): string {
  const sessionId = `${ctx.sender.toHexString()}_${ctx.timestamp}`;

  const session = new BenchmarkSessions();
  session.id = sessionId;
  session.name = name;
  session.startedAt = ctx.timestamp;
  session.endedAt = null;
  session.config = config;
  session.createdBy = ctx.sender;
  BenchmarkSessions.insert(session);

  return sessionId;
}

@spacetime.reducer
export function endBenchmarkSession(ctx: spacetime.ReducerContext, sessionId: string): void {
  const session = BenchmarkSessions.findById(sessionId);
  if (session && session.createdBy === ctx.sender) {
    session.endedAt = ctx.timestamp;
    BenchmarkSessions.update(session);
  }
}

@spacetime.reducer
export function deleteBenchmarkSession(ctx: spacetime.ReducerContext, sessionId: string): void {
  const session = BenchmarkSessions.findById(sessionId);
  if (session && session.createdBy === ctx.sender) {
    BenchmarkSessions.delete(session);
  }
}

// ============================================================================
// Utility reducers
// ============================================================================

// Batch insert for high-throughput benchmarks
@spacetime.reducer
export function batchCreateEvents(
  ctx: spacetime.ReducerContext,
  count: number,
  eventType: string,
  payloadTemplate: string
): void {
  for (let i = 0; i < count; i++) {
    const event = new Events();
    event.id = `${ctx.sender.toHexString()}_${ctx.timestamp}_${i}`;
    event.eventType = eventType;
    event.payload = `${payloadTemplate}_${i}`;
    event.priority = i % 10;
    event.createdAt = ctx.timestamp;
    event.processed = false;
    Events.insert(event);
  }
}

// Clear all data for cleanup between benchmarks
@spacetime.reducer
export function clearAllData(_ctx: spacetime.ReducerContext): void {
  for (const counter of Counters.iter()) {
    Counters.delete(counter);
  }
  for (const message of Messages.iter()) {
    Messages.delete(message);
  }
  for (const event of Events.iter()) {
    Events.delete(event);
  }
  for (const session of BenchmarkSessions.iter()) {
    BenchmarkSessions.delete(session);
  }
}

// ============================================================================
// Scheduled reducers (for periodic benchmarks)
// ============================================================================

@spacetime.reducer
export function scheduledHeartbeat(ctx: spacetime.ReducerContext): void {
  const event = new Events();
  event.id = `heartbeat_${ctx.timestamp}`;
  event.eventType = "heartbeat";
  event.payload = JSON.stringify({ timestamp: ctx.timestamp.toString() });
  event.priority = 0;
  event.createdAt = ctx.timestamp;
  event.processed = false;
  Events.insert(event);
}

// ============================================================================
// Initialization
// ============================================================================

// Called when the module is published
export function init(): void {
  // Create a default counter
  const defaultCounter = new Counters();
  defaultCounter.id = "default";
  defaultCounter.name = "Default Counter";
  defaultCounter.value = 0;
  defaultCounter.updatedAt = 0n;
  defaultCounter.updatedBy = new Identity();
  Counters.insert(defaultCounter);
}
