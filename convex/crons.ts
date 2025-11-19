import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Cleanup expired group requests every 10 seconds
crons.interval(
  "cleanup expired requests",
  { seconds: 10 },
  internal.groups.cleanupExpiredRequests
);

// Enforce round timers every 5 seconds
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
