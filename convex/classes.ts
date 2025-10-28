import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random 4-digit class code
function generateClassCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generate a random 4-digit PIN
function generatePIN(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export const createClass = mutation({
  args: {
    name: v.string(),
    phase1Duration: v.number(), // in seconds
  },
  handler: async (ctx, args) => {
    const code = generateClassCode();
    const pin = generatePIN();

    const classId = await ctx.db.insert("classes", {
      code,
      pin,
      name: args.name,
      phase1Active: false,
      phase1Duration: args.phase1Duration,
      createdAt: Date.now(),
    });

    return { classId, code, pin };
  },
});

export const getClass = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("classes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
  },
});

export const getClassById = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.classId);
  },
});

export const startPhase1 = mutation({
  args: {
    classId: v.id("classes"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) throw new Error("Class not found");
    if (classDoc.pin !== args.pin) throw new Error("Invalid PIN");

    await ctx.db.patch(args.classId, {
      phase1Active: true,
      phase1StartedAt: Date.now(),
    });
  },
});

export const stopPhase1 = mutation({
  args: {
    classId: v.id("classes"),
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const classDoc = await ctx.db.get(args.classId);
    if (!classDoc) throw new Error("Class not found");
    if (classDoc.pin !== args.pin) throw new Error("Invalid PIN");

    await ctx.db.patch(args.classId, {
      phase1Active: false,
    });
  },
});

export const getClassStats = query({
  args: { classId: v.id("classes") },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const pairs = await ctx.db
      .query("pairs")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    const activePairs = pairs.filter((p) => !p.completedAt);
    const completedPairs = pairs.filter((p) => p.completedAt);

    return {
      totalStudents: students.length,
      activePairs: activePairs.length,
      completedPairs: completedPairs.length,
    };
  },
});
