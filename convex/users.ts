import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random 2-digit code (10-99)
function generateUserCode(): number {
  return Math.floor(10 + Math.random() * 90);
}

export const joinRoom = mutation({
  args: {
    roomCode: v.string(),
    displayName: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate display name
    if (!args.displayName || args.displayName.trim().length === 0) {
      throw new Error("Display name is required");
    }

    // Find the room
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) throw new Error("Room not found");

    // Check room capacity (max 35 players)
    const existingUsers = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    if (existingUsers.length >= 35) {
      throw new Error("Room is full (max 35 players)");
    }

    // Generate a unique code for this user
    let code = generateUserCode();
    let existingUser = await ctx.db
      .query("users")
      .withIndex("by_room_and_code", (q) =>
        q.eq("roomId", room._id).eq("code", code)
      )
      .first();

    // Keep generating until we find a unique code
    while (existingUser) {
      code = generateUserCode();
      existingUser = await ctx.db
        .query("users")
        .withIndex("by_room_and_code", (q) =>
          q.eq("roomId", room._id).eq("code", code)
        )
        .first();
    }

    // Check if game is active (late joiner)
    const isLateJoiner = room.phase1Active && room.currentRound > 0;

    const userId = await ctx.db.insert("users", {
      roomId: room._id,
      displayName: args.displayName.trim(),
      avatar: args.avatar,
      code,
      joinedAt: Date.now(),
      status: isLateJoiner ? "waiting_for_round" : "available",
      isLateJoiner: isLateJoiner || undefined,
    });

    return { userId, code, roomId: room._id };
  },
});

export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByCode = query({
  args: {
    roomId: v.id("rooms"),
    code: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_room_and_code", (q) =>
        q.eq("roomId", args.roomId).eq("code", args.code)
      )
      .first();
  },
});

export const getActiveUsers = query({
  args: {
    roomId: v.id("rooms"),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Filter out the current user
    return users
      .filter((u) => u._id !== args.excludeUserId)
      .map((u) => ({
        id: u._id,
        avatar: u.avatar,
        code: u.code,
      }));
  },
});

export const getAvailableUsers = query({
  args: {
    roomId: v.id("rooms"),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Only return users who are available or in_group (can join groups)
    // Exclude users who are pending_sent or pending_received
    return users
      .filter((u) =>
        u._id !== args.excludeUserId &&
        (u.status === "available" || u.status === "in_group")
      )
      .map((u) => ({
        id: u._id,
        avatar: u.avatar,
        code: u.code,
        status: u.status,
      }));
  },
});

export const getTakenAvatars = query({
  args: {
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the room
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.roomCode))
      .first();

    if (!room) return [];

    // Get all users in this room
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    // Return just the avatars
    return users.map((u) => u.avatar);
  },
});

export const getRoomUsers = query({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    return users.map((u) => ({
      id: u._id,
      avatar: u.avatar,
      code: u.code,
      joinedAt: u.joinedAt,
    }));
  },
});

export const removeUser = mutation({
  args: {
    userId: v.id("users"),
    roomPin: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Verify room PIN
    const room = await ctx.db.get(user.roomId);
    if (!room) throw new Error("Room not found");
    if (room.pin !== args.roomPin) throw new Error("Invalid PIN");

    // Delete the user
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});

export const validateUserSession = query({
  args: {
    userId: v.id("users"),
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const user = await ctx.db.get(args.userId);
    if (!user) return { valid: false, reason: "user_not_found" };

    // Check if room exists
    const room = await ctx.db.get(user.roomId);
    if (!room) return { valid: false, reason: "room_not_found" };

    // Check if room code matches
    if (room.code !== args.roomCode) {
      return { valid: false, reason: "room_mismatch" };
    }

    // Check if room has expired
    if (room.expiresAt < Date.now()) {
      return { valid: false, reason: "room_expired" };
    }

    // All checks passed
    return {
      valid: true,
      user: {
        userId: user._id,
        roomId: room._id,
        displayName: user.displayName,
        avatar: user.avatar,
        code: user.code,
      },
    };
  },
});

export const rejoinRoom = mutation({
  args: {
    userId: v.id("users"),
    roomCode: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User session expired");

    // Check if room exists
    const room = await ctx.db.get(user.roomId);
    if (!room) throw new Error("Room no longer exists");

    // Check if room code matches
    if (room.code !== args.roomCode) {
      throw new Error("Room code mismatch");
    }

    // Check if room has expired
    if (room.expiresAt < Date.now()) {
      throw new Error("Room has expired");
    }

    // Check if user has an active group to rejoin
    if (user.currentGroupId) {
      const group = await ctx.db.get(user.currentGroupId);

      // If group exists and is in current round, rejoin it
      if (group && group.roundIndex === room.currentRound) {
        // Keep status as is (likely "in_group")
        // User can rejoin their current group
      } else {
        // Group is from previous round or doesn't exist, reset user
        await ctx.db.patch(args.userId, {
          status: room.phase1Active ? "waiting_for_round" : "available",
          currentGroupId: undefined,
        });
      }
    } else {
      // No group to rejoin
      await ctx.db.patch(args.userId, {
        status: room.phase1Active ? "waiting_for_round" : "available",
        currentGroupId: undefined,
      });
    }

    return {
      userId: user._id,
      roomId: room._id,
      code: user.code,
      avatar: user.avatar,
      displayName: user.displayName,
    };
  },
});

export const leaveRoom = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Check if user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Delete the user (groups will be auto-dissolved on round end)
    await ctx.db.delete(args.userId);

    return { success: true };
  },
});
