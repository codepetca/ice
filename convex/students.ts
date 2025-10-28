import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a random 2-digit code (10-99)
function generateStudentCode(): number {
  return Math.floor(10 + Math.random() * 90);
}

export const joinClass = mutation({
  args: {
    classCode: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the class
    const classDoc = await ctx.db
      .query("classes")
      .withIndex("by_code", (q) => q.eq("code", args.classCode))
      .first();

    if (!classDoc) throw new Error("Class not found");

    // Generate a unique code for this student
    let code = generateStudentCode();
    let existingStudent = await ctx.db
      .query("students")
      .withIndex("by_class_and_code", (q) =>
        q.eq("classId", classDoc._id).eq("code", code)
      )
      .first();

    // Keep generating until we find a unique code
    while (existingStudent) {
      code = generateStudentCode();
      existingStudent = await ctx.db
        .query("students")
        .withIndex("by_class_and_code", (q) =>
          q.eq("classId", classDoc._id).eq("code", code)
        )
        .first();
    }

    const studentId = await ctx.db.insert("students", {
      classId: classDoc._id,
      avatar: args.avatar,
      code,
      joinedAt: Date.now(),
    });

    return { studentId, code, classId: classDoc._id };
  },
});

export const getStudent = query({
  args: { studentId: v.id("students") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studentId);
  },
});

export const getStudentByCode = query({
  args: {
    classId: v.id("classes"),
    code: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("students")
      .withIndex("by_class_and_code", (q) =>
        q.eq("classId", args.classId).eq("code", args.code)
      )
      .first();
  },
});

export const getActiveStudents = query({
  args: {
    classId: v.id("classes"),
    excludeStudentId: v.optional(v.id("students")),
  },
  handler: async (ctx, args) => {
    const students = await ctx.db
      .query("students")
      .withIndex("by_class", (q) => q.eq("classId", args.classId))
      .collect();

    // Filter out the current student
    return students
      .filter((s) => s._id !== args.excludeStudentId)
      .map((s) => ({
        id: s._id,
        avatar: s.avatar,
        code: s.code,
      }));
  },
});
