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
