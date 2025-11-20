import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Enforce round timers every 5 seconds
// - Checks all active rooms with phase1Active = true
// - If round timer expired (30s), advances to next round
// - Dissolves groups and calls assignGroupsForRound()
crons.interval(
  "enforce round timers",
  { seconds: 5 },
  internal.rooms.enforceRoundTimers
);

// Cleanup expired rooms daily at 3 AM
crons.daily(
  "cleanup expired rooms",
  { hourUTC: 3, minuteUTC: 0 },
  internal.rooms.cleanupExpiredRooms
);

export default crons;
