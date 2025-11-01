import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(), // 3-letter room code (consonants only, no vowels)
    pin: v.string(), // Owner PIN for access
    name: v.string(),
    phase1Active: v.boolean(),
    phase1Duration: v.number(), // in seconds
    phase1StartedAt: v.optional(v.number()),
    maxGroupSize: v.number(), // Maximum users per group (default 4)
    createdAt: v.number(),
    expiresAt: v.number(), // Room expires after 7 days
  })
    .index("by_code", ["code"])
    .index("by_expires_at", ["expiresAt"]),

  users: defineTable({
    roomId: v.id("rooms"),
    avatar: v.string(), // Emoji avatar chosen by user
    code: v.number(), // 2-digit user code (10-99)
    joinedAt: v.number(),
    currentGroupId: v.optional(v.id("groups")),
    status: v.union(
      v.literal("available"),
      v.literal("pending_sent"),
      v.literal("pending_received"),
      v.literal("in_group")
    ), // User availability state
    lastRequestAt: v.optional(v.number()), // For spam prevention
    requestBackoffLevel: v.optional(v.number()), // Exponential backoff level (0, 1, 2, 3...)
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_code", ["roomId", "code"])
    .index("by_room_and_status", ["roomId", "status"]),

  groups: defineTable({
    roomId: v.id("rooms"),
    user1Id: v.id("users"),
    user2Id: v.optional(v.id("users")),
    user3Id: v.optional(v.id("users")),
    user4Id: v.optional(v.id("users")),
    memberCount: v.number(), // Current number of members (1-4)
    currentQuestionId: v.optional(v.id("questions")),
    user1Answer: v.optional(v.string()), // "A" or "B"
    user2Answer: v.optional(v.string()), // "A" or "B"
    user3Answer: v.optional(v.string()), // "A" or "B"
    user4Answer: v.optional(v.string()), // "A" or "B"
    user1Answered: v.optional(v.boolean()),
    user2Answered: v.optional(v.boolean()),
    user3Answered: v.optional(v.boolean()),
    user4Answered: v.optional(v.boolean()),
    questionStartedAt: v.optional(v.number()),
    talkingStartedAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"), // Group is active and can accept new members
      v.literal("in_question"), // Currently answering a question
      v.literal("talking"), // In conversation phase
      v.literal("completed") // Session completed
    ),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_user1", ["user1Id"])
    .index("by_room_and_status", ["roomId", "status"]),

  questions: defineTable({
    text: v.string(),
    category: v.string(),
    optionA: v.string(),
    optionB: v.string(),
    followUp: v.string(),
    active: v.boolean(),
  }),

  answers: defineTable({
    roomId: v.id("rooms"),
    groupId: v.id("groups"),
    questionId: v.id("questions"),
    userId: v.id("users"),
    choice: v.string(), // "A" or "B"
    skipped: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user", ["userId"])
    .index("by_group", ["groupId"]),

  groupRequests: defineTable({
    roomId: v.id("rooms"),
    requesterId: v.id("users"),
    targetId: v.id("users"),
    targetGroupId: v.optional(v.id("groups")), // Group the target is in (if any)
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired"),
      v.literal("cancelled")
    ),
    createdAt: v.number(),
    expiresAt: v.number(), // Timestamp when request expires (30s timeout)
  })
    .index("by_room_and_requester", ["roomId", "requesterId"])
    .index("by_room_and_target", ["roomId", "targetId"])
    .index("by_expires_at", ["expiresAt"])
    .index("by_status", ["status"]),
});
