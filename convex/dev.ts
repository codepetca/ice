import { mutation } from "./_generated/server";

export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear all tables in order (respecting dependencies)
    const tables = ["answers", "groupRequests", "groups", "users", "rooms", "questions"];

    let totalDeleted = 0;

    for (const tableName of tables) {
      const records = await ctx.db.query(tableName as any).collect();
      for (const record of records) {
        await ctx.db.delete(record._id);
        totalDeleted++;
      }
    }

    return {
      message: `Cleared all data from ${tables.length} tables`,
      documentsDeleted: totalDeleted
    };
  },
});

export const clearUserData = mutation({
  args: {},
  handler: async (ctx) => {
    // Clear only user-generated data (keep questions)
    const tables = ["answers", "groupRequests", "groups", "users", "rooms"];

    let totalDeleted = 0;
    const deletedByTable: Record<string, number> = {};

    for (const tableName of tables) {
      const records = await ctx.db.query(tableName as any).collect();
      deletedByTable[tableName] = records.length;
      for (const record of records) {
        await ctx.db.delete(record._id);
        totalDeleted++;
      }
    }

    return {
      message: "Cleared user data (kept questions)",
      documentsDeleted: totalDeleted,
      breakdown: deletedByTable
    };
  },
});

export const fixQuestionText = mutation({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db.query("questions").collect();
    let updated = 0;

    for (const question of questions) {
      if (question.text === "Would you rather...") {
        await ctx.db.patch(question._id, {
          text: "Would you rather"
        });
        updated++;
      }
    }

    return {
      message: `Updated ${updated} questions to remove "..."`,
      totalQuestions: questions.length,
      updated
    };
  },
});
