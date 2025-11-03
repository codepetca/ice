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
