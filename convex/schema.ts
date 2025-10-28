import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  classes: defineTable({
    code: v.string(), // 6-digit class code
    pin: v.string(), // Teacher PIN for access
    name: v.string(),
    phase1Active: v.boolean(),
    phase1Duration: v.number(), // in seconds
    phase1StartedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  students: defineTable({
    classId: v.id("classes"),
    avatar: v.string(), // Emoji avatar chosen by student
    code: v.number(), // 2-digit student code (10-99)
    joinedAt: v.number(),
    currentPairId: v.optional(v.id("pairs")),
  })
    .index("by_class", ["classId"])
    .index("by_class_and_code", ["classId", "code"]),

  pairs: defineTable({
    classId: v.id("classes"),
    student1Id: v.id("students"),
    student2Id: v.id("students"),
    student1Code: v.number(),
    student2Code: v.number(),
    pairKey: v.string(), // "min-max" for uniqueness
    questionId: v.id("questions"),
    student1Answer: v.optional(v.number()),
    student2Answer: v.optional(v.number()),
    student1Answered: v.boolean(),
    student2Answered: v.boolean(),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_class", ["classId"])
    .index("by_class_and_pair_key", ["classId", "pairKey"])
    .index("by_student1", ["student1Id"])
    .index("by_student2", ["student2Id"]),

  questions: defineTable({
    text: v.string(),
    category: v.string(),
    unit: v.optional(v.string()),
    rangeMin: v.optional(v.number()),
    rangeMax: v.optional(v.number()),
    followUp: v.string(),
    active: v.boolean(),
  }),

  answers: defineTable({
    classId: v.id("classes"),
    pairId: v.id("pairs"),
    questionId: v.id("questions"),
    studentId: v.id("students"),
    value: v.number(),
    skipped: v.boolean(),
    timestamp: v.number(),
  })
    .index("by_class", ["classId"])
    .index("by_student", ["studentId"])
    .index("by_pair", ["pairId"]),

  pairRequests: defineTable({
    classId: v.id("classes"),
    requesterId: v.id("students"),
    requesterCode: v.number(),
    targetCode: v.number(),
    createdAt: v.number(),
  })
    .index("by_class_and_requester", ["classId", "requesterId"])
    .index("by_class_and_codes", ["classId", "requesterCode", "targetCode"])
    .index("by_class_and_target", ["classId", "targetCode"]),
});
