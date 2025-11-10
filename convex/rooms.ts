import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Cleanup expired rooms and cascade delete all associated data
export const cleanupExpiredRooms = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all expired rooms
    const expiredRooms = await ctx.db
      .query("rooms")
      .withIndex("by_expires_at")
      .filter((q) => q.lte(q.field("expiresAt"), now))
      .collect();

    for (const room of expiredRooms) {
      // Delete all users in this room
      const users = await ctx.db
        .query("users")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const user of users) {
        await ctx.db.delete(user._id);
      }

      // Delete all groups in this room
      const groups = await ctx.db
        .query("groups")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const group of groups) {
        await ctx.db.delete(group._id);
      }

      // Delete all answers in this room
      const answers = await ctx.db
        .query("answers")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const answer of answers) {
        await ctx.db.delete(answer._id);
      }

      // Delete all group requests in this room
      const requests = await ctx.db
        .query("groupRequests")
        .withIndex("by_room_and_requester", (q) => q.eq("roomId", room._id))
        .collect();
      for (const request of requests) {
        await ctx.db.delete(request._id);
      }

      // Delete Phase 2 data (games, rounds, votes, scores) tied to this room
      const games = await ctx.db
        .query("games")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();

      for (const game of games) {
        const votes = await ctx.db
          .query("votes")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();
        for (const vote of votes) {
          await ctx.db.delete(vote._id);
        }

        const rounds = await ctx.db
          .query("gameRounds")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();
        for (const round of rounds) {
          await ctx.db.delete(round._id);
        }

        const scores = await ctx.db
          .query("scores")
          .withIndex("by_game", (q) => q.eq("gameId", game._id))
          .collect();
        for (const score of scores) {
          await ctx.db.delete(score._id);
        }

        await ctx.db.delete(game._id);
      }

      // Finally, delete the room itself
      await ctx.db.delete(room._id);
    }
  },
});

// Generate a random 4-letter room code
// Excludes vowels (A,E,I,O,U) to prevent inappropriate words
function generateRoomCode(): string {
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += consonants.charAt(Math.floor(Math.random() * consonants.length));
  }
  return code;
}

// Generate a random 4-digit PIN
function generatePIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function generateUniqueRoomCode(ctx: any): Promise<string> {
  while (true) {
    const code = generateRoomCode();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q: any) => q.eq("code", code))
      .first();
    if (!existing) return code;
  }
}

async function generateUniquePIN(ctx: any): Promise<string> {
  while (true) {
    const pin = generatePIN();
    const existing = await ctx.db
      .query("rooms")
      .withIndex("by_pin", (q: any) => q.eq("pin", pin))
      .first();
    if (!existing) return pin;
  }
}

export const createRoom = mutation({
  args: {
    name: v.string(),
    phase1Duration: v.number(), // in seconds
    maxGroupSize: v.optional(v.number()), // optional, defaults to 4
  },
  handler: async (ctx, args) => {
    const code = await generateUniqueRoomCode(ctx);
    const pin = await generateUniquePIN(ctx);
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

    const roomId = await ctx.db.insert("rooms", {
      code,
      pin,
      name: args.name,
      phase1Active: false,
      phase1Duration: args.phase1Duration,
      maxGroupSize: args.maxGroupSize || 4,
      roundNumber: 1, // Start at round 1
      createdAt: now,
      expiresAt: now + fortyEightHours,
    });

    return { roomId, code, pin };
  },
});

export const getRoom = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

export const getRoomById = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId);
  },
});

export const getRoomByPin = query({
  args: { pin: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_pin", (q) => q.eq("pin", args.pin))
      .first();
  },
});

export const startPhase1 = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    await ctx.db.patch(args.roomId, {
      phase1Active: true,
      phase1StartedAt: Date.now(),
    });
  },
});

export const stopPhase1 = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    // Start winding down period (15 seconds to finish)
    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      windingDownStartedAt: now,
    });

    // Schedule full stop after 15 seconds
    await ctx.scheduler.runAfter(15000, internal.rooms.finalizeStop, {
      roomId: args.roomId,
    });
  },
});

// Adjust Phase 1 duration (add or subtract time)
export const adjustPhase1Duration = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
    adjustmentSeconds: v.number(), // positive to add, negative to subtract
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    // Calculate new duration
    let newDuration = room.phase1Duration + args.adjustmentSeconds;

    // Enforce constraints: min 60s (1 min), max 1200s (20 min)
    newDuration = Math.max(60, Math.min(1200, newDuration));

    await ctx.db.patch(args.roomId, {
      phase1Duration: newDuration,
    });
  },
});

// Internal mutation to fully stop Phase 1 after winding down
export const finalizeStop = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roomId, {
      phase1Active: false,
      windingDownStartedAt: undefined,
    });
  },
});

// Reset room to ready state (before Phase 1 was started)
export const resetRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    // Increment round number and reset for new round of data collection
    await ctx.db.patch(args.roomId, {
      roundNumber: room.roundNumber + 1, // Move to next round
      phase1Duration: 600, // Reset to 10 minutes
      phase1StartedAt: undefined,
      phase1Active: false,
      windingDownStartedAt: undefined,
    });
  },
});

export const getRoomStats = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const groups = await ctx.db
      .query("groups")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    const activeGroups = groups.filter((g) => g.status !== "completed");
    const completedGroups = groups.filter((g) => g.status === "completed");

    return {
      totalUsers: users.length,
      activeGroups: activeGroups.length,
      completedGroups: completedGroups.length,
    };
  },
});
