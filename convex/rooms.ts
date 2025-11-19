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
    phase1Rounds: v.number(), // number of 30-second rounds
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
      phase1Rounds: args.phase1Rounds,
      currentRound: 0, // 0 = not started
      maxGroupSize: args.maxGroupSize || 4,
      nextQuestionIndex: 0,
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

    const now = Date.now();
    await ctx.db.patch(args.roomId, {
      phase1Active: true,
      phase1StartedAt: now,
      currentRound: 1, // Start at round 1
      roundStartedAt: now,
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

    // Immediately stop Phase 1 (no winding down period)
    await ctx.db.patch(args.roomId, {
      phase1Active: false,
      currentRound: 0,
      roundStartedAt: undefined,
    });

    // Auto-generate game after Phase 1 ends
    try {
      await ctx.scheduler.runAfter(0, internal.games.generateGameInternal, {
        roomId: args.roomId,
      });
    } catch (error) {
      console.error("Failed to auto-generate game:", error);
    }
  },
});

// Advance to next round (called by cron timer every 30 seconds)
export const advanceRound = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) return; // Room deleted
    if (!room.phase1Active) return; // Phase 1 not active

    const nextRound = room.currentRound + 1;

    // Check if we've exceeded the total rounds
    if (nextRound > room.phase1Rounds) {
      // End Phase 1
      await ctx.db.patch(args.roomId, {
        phase1Active: false,
        currentRound: 0,
        roundStartedAt: undefined,
      });

      // Auto-generate game after Phase 1 ends
      try {
        await ctx.scheduler.runAfter(0, internal.games.generateGameInternal, {
          roomId: args.roomId,
        });
      } catch (error) {
        console.error("Failed to auto-generate game:", error);
      }
      return;
    }

    // Dissolve all groups in this room
    const groups = await ctx.db
      .query("groups")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    for (const group of groups) {
      // Reset all members to available status
      const memberIds = [
        group.user1Id,
        group.user2Id,
        group.user3Id,
        group.user4Id,
      ].filter(Boolean);

      for (const memberId of memberIds) {
        await ctx.db.patch(memberId as any, {
          status: "available",
          currentGroupId: undefined,
        });
      }

      // Delete the group
      await ctx.db.delete(group._id);
    }

    // Cancel all pending requests
    const requests = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_requester", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();

    for (const request of requests) {
      await ctx.db.patch(request._id, { status: "expired" });

      // Reset requester and target statuses
      const requester = await ctx.db.get(request.requesterId);
      const target = await ctx.db.get(request.targetId);

      if (requester && requester.status === "pending_sent") {
        await ctx.db.patch(request.requesterId, { status: "available" });
      }
      if (target && target.status === "pending_received") {
        await ctx.db.patch(request.targetId, { status: "available" });
      }
    }

    // Advance to next round
    await ctx.db.patch(args.roomId, {
      currentRound: nextRound,
      roundStartedAt: Date.now(),
    });
  },
});

// Adjust Phase 1 rounds (add or subtract rounds)
export const adjustPhase1Rounds = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
    adjustment: v.number(), // positive to add, negative to subtract
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    // Calculate new round count
    let newRounds = room.phase1Rounds + args.adjustment;

    // Enforce constraints: min 1 round (30s), max 40 rounds (20 min)
    newRounds = Math.max(1, Math.min(40, newRounds));

    await ctx.db.patch(args.roomId, {
      phase1Rounds: newRounds,
    });
  },
});

// No longer needed - stopPhase1 now handles everything directly

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

    // Reset room state for new session
    await ctx.db.patch(args.roomId, {
      phase1Rounds: 10, // Reset to 10 rounds (5 minutes)
      currentRound: 0,
      roundStartedAt: undefined,
      phase1StartedAt: undefined,
      phase1Active: false,
    });
  },
});

// Close room and remove all users
export const closeRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.pin) throw new Error("Invalid PIN");

    // Mark all users as removed by deleting them
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();
    
    for (const user of users) {
      await ctx.db.delete(user._id);
    }

    // Mark game as completed if it exists
    const game = await ctx.db
      .query("games")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .first();
    
    if (game && game.status === "in_progress") {
      await ctx.db.patch(game._id, {
        status: "completed",
        completedAt: Date.now(),
      });
    }

    // Delete the room itself
    await ctx.db.delete(args.roomId);
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

// Enforce round timers - check all active rooms and advance rounds as needed
export const enforceRoundTimers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ROUND_DURATION = 30000; // 30 seconds in milliseconds

    // Find all rooms with active Phase 1
    const activeRooms = await ctx.db
      .query("rooms")
      .filter((q) => q.eq(q.field("phase1Active"), true))
      .collect();

    for (const room of activeRooms) {
      // Check if round timer has expired
      if (room.roundStartedAt && now >= room.roundStartedAt + ROUND_DURATION) {
        // Advance to next round
        await ctx.scheduler.runAfter(0, internal.rooms.advanceRound, {
          roomId: room._id,
        });
      }
    }
  },
});
