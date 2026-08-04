import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  rooms: defineTable({
    code: v.string(), // 3-letter room code (consonants only, no vowels)
    pin: v.string(), // Owner PIN for access
    name: v.string(),
    phase1Active: v.boolean(),
    phase1Rounds: v.number(), // Number of 30-second rounds (default 5)
    currentRound: v.number(), // Current round number (0 = not started, 1+ = active)
    roundStartedAt: v.optional(v.number()), // When current round started
    phase1StartedAt: v.optional(v.number()),
    maxGroupSize: v.number(), // Maximum users per group (default 4)
    nextQuestionIndex: v.optional(v.number()), // Tracks next question position in room's sequence (0-based, defaults to 0)
    pairHistory: v.optional(v.any()), // Map of "playerId1:playerId2" -> count to minimize repeat pairings
    createdAt: v.number(),
    expiresAt: v.number(), // Room expires after 7 days
  })
    .index("by_code", ["code"])
    .index("by_pin", ["pin"])
    .index("by_expires_at", ["expiresAt"]),

  users: defineTable({
    roomId: v.id("rooms"),
    displayName: v.string(), // User's display name for name-matching phase
    avatar: v.string(), // Emoji avatar chosen by user
    code: v.number(), // 2-digit user code (10-99)
    joinedAt: v.number(),
    currentGroupId: v.optional(v.id("groups")),
    status: v.union(
      v.literal("available"),
      v.literal("in_group"),
      v.literal("waiting_for_round")
    ), // User availability state
    isLateJoiner: v.optional(v.boolean()), // True if joined after game started
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_code", ["roomId", "code"])
    .index("by_room_and_status", ["roomId", "status"]),

  groups: defineTable({
    roomId: v.id("rooms"),
    roundIndex: v.number(), // Which round this group was created in (1-based)
    user1Id: v.id("users"),
    user2Id: v.optional(v.id("users")),
    user3Id: v.optional(v.id("users")),
    user4Id: v.optional(v.id("users")),
    memberCount: v.number(), // Current number of members (2-4)
    phase: v.union(
      v.literal("name_matching"), // Name matching phase
      v.literal("wyr") // Would you rather phase
    ),
    // Name matching data
    nameChoicesByPlayer: v.optional(v.any()), // Map of playerId -> Map of avatarId -> [name1, name2, name3]
    nameSelectionsByPlayer: v.optional(v.any()), // Map of playerId -> Map of avatarId -> selectedName
    submittedNameMatching: v.optional(v.array(v.id("users"))), // Players who submitted (awaiting validation)
    completedNameMatching: v.optional(v.array(v.id("users"))), // Players who completed name matching correctly
    incorrectByPlayer: v.optional(v.any()), // Map of playerId -> [incorrectAvatarIds] after validation
    // WYR phase data
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
    createdAt: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_user1", ["user1Id"])
    .index("by_user2", ["user2Id"])
    .index("by_user3", ["user3Id"])
    .index("by_user4", ["user4Id"])
    .index("by_room_and_round", ["roomId", "roundIndex"]),

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

  // Phase 2: Summary Game tables
  games: defineTable({
    roomId: v.id("rooms"),
    status: v.union(
      v.literal("not_started"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
    currentRound: v.number(), // Current slide number (1-based)
    totalRounds: v.number(), // Total number of slides/questions
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    // Slideshow timer state (host-driven)
    stage: v.optional(v.union(
      v.literal("pre_reveal"),  // 6s: showing question only
      v.literal("revealed")     // 6s: showing revealed percentages
    )),
    stageStartedAt: v.optional(v.number()), // When current stage began
    isFinished: v.optional(v.boolean()), // True when slideshow completes
  })
    .index("by_room", ["roomId"])
    .index("by_status", ["status"]),

  gameRounds: defineTable({
    gameId: v.id("games"),
    roundNumber: v.number(), // 1-based round number
    questionId: v.id("questions"), // Original Phase 1 question
    questionText: v.string(), // Generated Phase 2 question text
    correctAnswer: v.string(), // "A" (≥50%) or "B" (<50%)
    actualPercentage: v.number(), // Actual percentage who chose the tracked option
    revealedAt: v.optional(v.number()),
  })
    .index("by_game", ["gameId"])
    .index("by_game_and_round", ["gameId", "roundNumber"]),

  votes: defineTable({
    roundId: v.id("gameRounds"),
    gameId: v.id("games"),
    userId: v.id("users"),
    choice: v.string(), // "A" or "B"
    isCorrect: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_round", ["roundId"])
    .index("by_game", ["gameId"])
    .index("by_user", ["userId"])
    .index("by_game_and_user", ["gameId", "userId"]),

  scores: defineTable({
    gameId: v.id("games"),
    userId: v.id("users"),
    totalCorrect: v.number(),
    totalVotes: v.number(),
    rank: v.optional(v.number()), // Final ranking (1-5 for leaderboard)
  })
    .index("by_game", ["gameId"])
    .index("by_user", ["userId"])
    .index("by_game_and_rank", ["gameId", "rank"]),
});
