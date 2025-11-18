import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

// Get the number of users currently in a group
function getGroupSize(group: any): number {
  let size = 0;
  if (group.user1Id) size++;
  if (group.user2Id) size++;
  if (group.user3Id) size++;
  if (group.user4Id) size++;
  return size;
}

// Find which user slot someone is in (1-4)
function getUserSlot(group: any, userId: string): number | null {
  if (group.user1Id === userId) return 1;
  if (group.user2Id === userId) return 2;
  if (group.user3Id === userId) return 3;
  if (group.user4Id === userId) return 4;
  return null;
}

// Check if a user is part of a group
function isUserInGroup(group: any, userId: string): boolean {
  return getUserSlot(group, userId) !== null;
}

// Calculate backoff time in milliseconds based on level
function getBackoffTime(level: number): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
  return Math.min(Math.pow(2, level) * 1000, 16000);
}

// Deterministic shuffle based on a seed (date)
function seededShuffle<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  let currentSeed = seed;

  // Simple seeded random number generator (LCG)
  const seededRandom = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };

  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Selects a question for a group using room-based sequential rotation
 *
 * Algorithm:
 * 1. For each member, queries all 4 user slots (user1-4) to find their last 3 groups
 * 2. Collects all question IDs from those recent groups
 * 3. Gets room's unique question sequence (deterministic shuffle seeded by roomId)
 * 4. Starts at room's nextQuestionIndex and searches forward for a question not in recent history
 * 5. If no valid question found in 50 positions, uses next question anyway (hybrid fallback)
 * 6. Increments room's nextQuestionIndex for next group
 * 7. Returns selected question
 *
 * @param ctx - Convex mutation context
 * @param roomId - Room ID for room-based sequence
 * @param memberIds - Array of user IDs in the group
 * @returns Selected question document with text, optionA, optionB, followUp
 * @throws Error if no questions are available in the database
 */
async function selectQuestion(ctx: any, roomId: string, memberIds: string[]): Promise<any> {
  // Get the room to access nextQuestionIndex
  const room = await ctx.db.get(roomId);
  if (!room) {
    throw new Error("Room not found");
  }

  // Get recent questions for all members (last 3 each)
  const recentQuestionIds = new Set<string>();

  for (const memberId of memberIds) {
    // Find groups where this user was in any slot (user1-4)
    // Check all 4 slots and collect the 3 most recent groups
    const allUserGroups: any[] = [];

    // Query each user slot index
    const user1Groups = await ctx.db
      .query("groups")
      .withIndex("by_user1", (q: any) => q.eq("user1Id", memberId))
      .collect();
    allUserGroups.push(...user1Groups);

    const user2Groups = await ctx.db
      .query("groups")
      .withIndex("by_user2", (q: any) => q.eq("user2Id", memberId))
      .collect();
    allUserGroups.push(...user2Groups);

    const user3Groups = await ctx.db
      .query("groups")
      .withIndex("by_user3", (q: any) => q.eq("user3Id", memberId))
      .collect();
    allUserGroups.push(...user3Groups);

    const user4Groups = await ctx.db
      .query("groups")
      .withIndex("by_user4", (q: any) => q.eq("user4Id", memberId))
      .collect();
    allUserGroups.push(...user4Groups);

    // Sort by creation time (most recent first) and take the last 3
    const sortedGroups = allUserGroups
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 3);

    for (const group of sortedGroups) {
      if (group.currentQuestionId) {
        recentQuestionIds.add(group.currentQuestionId);
      }
    }
  }

  // Get all active questions
  const allQuestions = await ctx.db
    .query("questions")
    .filter((q: any) => q.eq(q.field("active"), true))
    .collect();

  if (allQuestions.length === 0) {
    throw new Error("No questions available");
  }

  // Generate room-specific shuffle using roomId as seed
  // Convert roomId string to numeric seed (simple hash)
  let roomSeed = 0;
  for (let i = 0; i < roomId.length; i++) {
    roomSeed = (roomSeed * 31 + roomId.charCodeAt(i)) % 1000000;
  }

  const shuffledQuestions = seededShuffle(allQuestions, roomSeed);
  const totalQuestions = shuffledQuestions.length;

  // Start search from room's current position (default to 0 for old rooms)
  let startIndex = (room.nextQuestionIndex ?? 0) % totalQuestions;
  let selectedQuestion = null;
  let selectedIndex = startIndex;

  // Hybrid filtering: Try to find a question not in recent history
  // Search up to 50 positions forward (with wraparound)
  const maxSearchAttempts = Math.min(50, totalQuestions);

  for (let attempt = 0; attempt < maxSearchAttempts; attempt++) {
    const currentIndex = (startIndex + attempt) % totalQuestions;
    const question: any = shuffledQuestions[currentIndex];

    if (!recentQuestionIds.has(question._id)) {
      // Found a question not in recent history
      selectedQuestion = question;
      selectedIndex = currentIndex;
      break;
    }
  }

  // Fallback: If no valid question found after searching, use the next question anyway
  if (!selectedQuestion) {
    selectedIndex = startIndex;
    selectedQuestion = shuffledQuestions[startIndex];
  }

  // Increment room's question index for next group
  // Move forward from the selected position (not just +1 from current)
  const nextIndex = (selectedIndex + 1) % totalQuestions;
  await ctx.db.patch(roomId, {
    nextQuestionIndex: nextIndex,
  });

  return selectedQuestion;
}

// Cleanup expired group requests and reset user statuses
export const cleanupExpiredRequests = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find all expired pending requests
    const expiredRequests = await ctx.db
      .query("groupRequests")
      .withIndex("by_expires_at")
      .filter((q) => q.lte(q.field("expiresAt"), now))
      .collect();

    // Filter to only pending requests
    const pendingExpired = expiredRequests.filter(
      (r) => r.status === "pending"
    );

    // Mark as expired and reset user statuses
    for (const request of pendingExpired) {
      // Mark request as expired
      await ctx.db.patch(request._id, { status: "expired" });

      // Reset requester status if still pending_sent
      const requester = await ctx.db.get(request.requesterId);
      if (requester && requester.status === "pending_sent") {
        await ctx.db.patch(request.requesterId, { status: "available" });
      }

      // Reset target status if still pending_received
      const target = await ctx.db.get(request.targetId);
      if (target && target.status === "pending_received") {
        await ctx.db.patch(request.targetId, { status: "available" });
      }
    }
  },
});

// Auto-cancel requests when target group becomes full
export const cancelRequestsForFullGroup = internalMutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) return;

    // Get the room to check max group size
    const room = await ctx.db.get(group.roomId);
    if (!room) return;

    const currentSize = getGroupSize(group);
    const maxSize = room.maxGroupSize || 4;

    // If group is full, cancel all pending requests targeting members of this group
    if (currentSize >= maxSize) {
      const memberIds = [
        group.user1Id,
        group.user2Id,
        group.user3Id,
        group.user4Id,
      ].filter(Boolean) as string[];

      for (const memberId of memberIds) {
        // Find all pending requests targeting this member
        const requests = await ctx.db
          .query("groupRequests")
          .withIndex("by_room_and_target", (q) =>
            q.eq("roomId", group.roomId).eq("targetId", memberId as any)
          )
          .filter((q) => q.eq(q.field("status"), "pending"))
          .collect();

        // Cancel them
        for (const request of requests) {
          await ctx.db.patch(request._id, { status: "cancelled" });

          // Reset requester status if still pending_sent
          const requester = await ctx.db.get(request.requesterId);
          if (requester && requester.status === "pending_sent") {
            await ctx.db.patch(request.requesterId, { status: "available" });
          }
        }
      }
    }
  },
});

// Send a group join request
/**
 * Sends a group join request from one user to another
 *
 * Features:
 * - Validates room is active and not winding down
 * - Prevents self-joining and duplicate requests
 * - Implements spam prevention with exponential backoff (1s → 2s → 4s → 8s → 16s)
 * - Enforces 3-second cooldown after canceling a request
 * - Auto-accepts if mutual request exists (both users requested each other)
 * - Checks target group isn't full before allowing request
 * - Updates user statuses and creates pending request with 30-second expiration
 *
 * @param args.userId - ID of user sending the request
 * @param args.targetId - ID of user being requested
 * @returns Success status and request details (or pairing details if auto-accepted)
 * @throws Error for validation failures, spam prevention, or room/user issues
 */
export const sendGroupRequest = mutation({
  args: {
    userId: v.id("users"),
    targetId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const target = await ctx.db.get(args.targetId);
    if (!target) throw new Error("Target user not found");

    // Can't request yourself
    if (user._id === target._id) {
      throw new Error("Cannot join yourself");
    }

    // Check if room is still active
    const room = await ctx.db.get(user.roomId);
    if (!room || !room.phase1Active) {
      throw new Error("Room is not active");
    }

    // Block joining groups during winding down period
    if (room.windingDownStartedAt) {
      throw new Error("Session is ending soon");
    }

    // Block users who have a pending incoming request
    if (user.status === "pending_received") {
      throw new Error("Please respond to your incoming request first");
    }

    // Check spam prevention - exponential backoff
    const now = Date.now();
    const backoffLevel = user.requestBackoffLevel || 0;
    const backoffTime = getBackoffTime(backoffLevel);

    if (user.lastRequestAt && now - user.lastRequestAt < backoffTime) {
      throw new Error("Please wait...");
    }

    // Prevent immediate resend after cancel (3-second cooldown)
    const CANCEL_COOLDOWN = 3000; // 3 seconds
    if (user.lastCancelAt && now - user.lastCancelAt < CANCEL_COOLDOWN) {
      throw new Error("Please wait before sending another request");
    }

    // Check if requester already has a pending outgoing request
    const existingOutgoing = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_requester", (q) =>
        q.eq("roomId", user.roomId).eq("requesterId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (existingOutgoing) {
      throw new Error("You already have a pending request. Please wait or cancel it.");
    }

    // Check if target already has a group
    let targetGroupId = target.currentGroupId;
    if (targetGroupId) {
      const targetGroup = await ctx.db.get(targetGroupId);
      if (targetGroup && targetGroup.status !== "completed") {
        // Check if group is full
        const groupSize = getGroupSize(targetGroup);
        const maxSize = room.maxGroupSize || 4;

        if (groupSize >= maxSize) {
          throw new Error("This group is full");
        }

        // Check if requester is already in this group
        if (isUserInGroup(targetGroup, args.userId)) {
          throw new Error("You're already in this group");
        }
      }
    }

    // Check for mutual request (target has requested requester)
    const mutualRequest = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_requester", (q) =>
        q.eq("roomId", user.roomId).eq("requesterId", args.targetId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    // If mutual request exists and target is requesting us, auto-accept!
    if (mutualRequest && mutualRequest.targetId === args.userId) {
      // Delete both requests
      await ctx.db.patch(mutualRequest._id, { status: "accepted" });

      // Handle the pairing/grouping
      return await handleAcceptRequest(ctx, {
        acceptorId: args.userId,
        requesterId: args.targetId,
        room,
      });
    }

    // Create the request
    const expiresAt = now + 30000; // 30 seconds
    await ctx.db.insert("groupRequests", {
      roomId: user.roomId,
      requesterId: args.userId,
      targetId: args.targetId,
      targetGroupId,
      status: "pending",
      createdAt: now,
      expiresAt,
    });

    // Update requester's spam prevention tracking and status
    await ctx.db.patch(args.userId, {
      status: "pending_sent",
      lastRequestAt: now,
      requestBackoffLevel: backoffLevel + 1,
    });

    // Update target's status to pending_received (only if not already in a group)
    if (target.status === "available") {
      await ctx.db.patch(args.targetId, {
        status: "pending_received",
      });
    }

    return { success: true, waiting: true };
  },
});

// Helper function to handle accepting a request (used by both accept and mutual acceptance)
async function handleAcceptRequest(
  ctx: any,
  args: { acceptorId: string; requesterId: string; room: any }
) {
  const acceptor = await ctx.db.get(args.acceptorId);
  const requester = await ctx.db.get(args.requesterId);

  if (!acceptor || !requester) {
    throw new Error("User not found");
  }

  // Check if acceptor is in a group
  if (acceptor.currentGroupId) {
    const acceptorGroup = await ctx.db.get(acceptor.currentGroupId);
    if (acceptorGroup && acceptorGroup.status !== "completed") {
      // Add requester to acceptor's group
      const groupSize = getGroupSize(acceptorGroup);
      const maxSize = args.room.maxGroupSize || 4;

      if (groupSize >= maxSize) {
        throw new Error("Group is full");
      }

      // Add requester to the group
      const slotNum = groupSize + 1;
      const updateFields: any = {
        [`user${slotNum}Id`]: args.requesterId,
        memberCount: groupSize + 1,
      };

      await ctx.db.patch(acceptor.currentGroupId, updateFields);

      // Update requester's status
      await ctx.db.patch(args.requesterId, {
        currentGroupId: acceptor.currentGroupId,
        status: "in_group",
      });

      // Get all members for response
      const members = await getGroupMembers(ctx, acceptorGroup);

      // Check if group is now full and cancel pending requests
      if (groupSize + 1 >= maxSize) {
        await ctx.scheduler.runAfter(0, internal.groups.cancelRequestsForFullGroup, {
          groupId: acceptor.currentGroupId,
        });
      }

      return {
        success: true,
        joinedGroup: true,
        groupId: acceptor.currentGroupId,
        members,
        question: acceptorGroup.currentQuestionId
          ? await ctx.db.get(acceptorGroup.currentQuestionId)
          : null,
      };
    }
  }

  // Check if requester is in a group
  if (requester.currentGroupId) {
    const requesterGroup = await ctx.db.get(requester.currentGroupId);
    if (requesterGroup && requesterGroup.status !== "completed") {
      // Add acceptor to requester's group
      const groupSize = getGroupSize(requesterGroup);
      const maxSize = args.room.maxGroupSize || 4;

      if (groupSize >= maxSize) {
        throw new Error("Group is full");
      }

      // Add acceptor to the group
      const slotNum = groupSize + 1;
      const updateFields: any = {
        [`user${slotNum}Id`]: args.acceptorId,
        memberCount: groupSize + 1,
      };

      await ctx.db.patch(requester.currentGroupId, updateFields);

      // Update acceptor's status
      await ctx.db.patch(args.acceptorId, {
        currentGroupId: requester.currentGroupId,
        status: "in_group",
      });

      // Get all members for response
      const members = await getGroupMembers(ctx, requesterGroup);

      // Check if group is now full and cancel pending requests
      if (groupSize + 1 >= maxSize) {
        await ctx.scheduler.runAfter(0, internal.groups.cancelRequestsForFullGroup, {
          groupId: requester.currentGroupId,
        });
      }

      return {
        success: true,
        joinedGroup: true,
        groupId: requester.currentGroupId,
        members,
        question: requesterGroup.currentQuestionId
          ? await ctx.db.get(requesterGroup.currentQuestionId)
          : null,
      };
    }
  }

  // Neither has a group, create a new one
  const memberIds = [args.acceptorId, args.requesterId];
  const question = await selectQuestion(ctx, args.room._id, memberIds);

  const groupId = await ctx.db.insert("groups", {
    roomId: args.room._id,
    user1Id: args.acceptorId,
    user2Id: args.requesterId,
    memberCount: 2,
    currentQuestionId: question._id,
    user1Answered: false,
    user2Answered: false,
    status: "active",
    createdAt: Date.now(),
  });

  // Update both users
  await ctx.db.patch(args.acceptorId, {
    currentGroupId: groupId,
    status: "in_group",
  });
  await ctx.db.patch(args.requesterId, {
    currentGroupId: groupId,
    status: "in_group",
  });

  return {
    success: true,
    createdGroup: true,
    groupId,
    members: [
      { id: acceptor._id, avatar: acceptor.avatar, code: acceptor.code },
      { id: requester._id, avatar: requester.avatar, code: requester.code },
    ],
    question: {
      text: question.text,
      optionA: question.optionA,
      optionB: question.optionB,
      followUp: question.followUp,
    },
  };
}

// Get all members of a group
async function getGroupMembers(ctx: any, group: any) {
  const members = [];
  const userIds = [group.user1Id, group.user2Id, group.user3Id, group.user4Id];

  for (const userId of userIds) {
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user) {
        members.push({
          id: user._id,
          avatar: user.avatar,
          code: user.code,
        });
      }
    }
  }

  return members;
}

// Accept a group request
/**
 * Accepts a group join request
 *
 * Logic:
 * - If acceptor has no group and requester has no group: Creates new 2-person group
 * - If acceptor has group and requester doesn't: Adds requester to acceptor's group
 * - If acceptor has no group and requester has group: Adds acceptor to requester's group
 * - Validates group size limits before adding members
 * - Selects a question for new/updated group
 * - Resets spam prevention backoff levels for both users on success
 *
 * @param args.userId - ID of user accepting the request (target)
 * @param args.requestId - ID of the group request being accepted
 * @returns Group details including members and question, or error information
 * @throws Error if request invalid, expired, room inactive, or group full
 */
export const acceptGroupRequest = mutation({
  args: {
    userId: v.id("users"),
    requestId: v.id("groupRequests"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    // Verify this request is for this user
    if (request.targetId !== args.userId) {
      throw new Error("This request is not for you");
    }

    // Check if request is still pending
    if (request.status !== "pending") {
      throw new Error("Request is no longer active");
    }

    // Check if room is still active
    const room = await ctx.db.get(user.roomId);
    if (!room || !room.phase1Active) {
      throw new Error("Room is not active");
    }

    // Mark request as accepted
    await ctx.db.patch(request._id, { status: "accepted" });

    // Handle the group join/creation
    const result = await handleAcceptRequest(ctx, {
      acceptorId: args.userId,
      requesterId: request.requesterId,
      room,
    });

    // Reset backoff level and cancel tracking for requester on successful acceptance
    await ctx.db.patch(request.requesterId, {
      requestBackoffLevel: 0,
      lastCancelAt: undefined,
    });

    return result;
  },
});

// Reject a group request
export const rejectGroupRequest = mutation({
  args: {
    userId: v.id("users"),
    requestId: v.id("groupRequests"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    // Verify this request is for this user
    if (request.targetId !== args.userId) {
      throw new Error("This request is not for you");
    }

    // Mark request as rejected
    await ctx.db.patch(request._id, { status: "rejected" });

    // Reset requester status
    const requester = await ctx.db.get(request.requesterId);
    if (requester && requester.status === "pending_sent") {
      await ctx.db.patch(request.requesterId, { status: "available" });
    }

    // Reset target's status (the user rejecting the request)
    if (user.status === "pending_received") {
      await ctx.db.patch(args.userId, { status: "available" });
    }

    return { success: true };
  },
});

// Cancel your own outgoing request
export const cancelGroupRequest = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return;

    // Find pending outgoing request
    const request = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_requester", (q) =>
        q.eq("roomId", user.roomId).eq("requesterId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .first();

    if (request) {
      await ctx.db.patch(request._id, { status: "cancelled" });

      // Reset target's status if they were pending_received
      const target = await ctx.db.get(request.targetId);
      if (target && target.status === "pending_received") {
        await ctx.db.patch(request.targetId, { status: "available" });
      }
    }

    // Reset user status and track cancel time
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      status: "available",
      lastCancelAt: now,
      // Increase backoff level on cancel to prevent spam (max 4)
      requestBackoffLevel: Math.min((user.requestBackoffLevel || 0) + 1, 4),
    });

    return { success: true };
  },
});

// Get user's outgoing request status
export const getOutgoingRequest = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    // Find most recent outgoing request (pending or recently completed)
    const requests = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_requester", (q) =>
        q.eq("roomId", user.roomId).eq("requesterId", args.userId)
      )
      .order("desc")
      .take(1);

    const request = requests[0];
    if (!request) return null;

    // Only return if it's pending or recently changed (within 5 seconds)
    const now = Date.now();
    const recentlyChanged = now - request.createdAt < 35000; // 35 seconds window

    if (request.status !== "pending" && !recentlyChanged) {
      return null;
    }

    // Get target user info
    const targetUser = await ctx.db.get(request.targetId);
    if (!targetUser) return null;

    return {
      requestId: request._id,
      status: request.status,
      target: {
        id: targetUser._id,
        avatar: targetUser.avatar,
        code: targetUser.code,
      },
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
    };
  },
});

// Get all pending incoming requests for a user (up to group limit)
export const getIncomingRequests = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get room to check max group size
    const room = await ctx.db.get(user.roomId);
    if (!room) return [];

    const maxSize = room.maxGroupSize || 4;

    // Check current group size
    let currentSize = 1; // User themselves
    if (user.currentGroupId) {
      const group = await ctx.db.get(user.currentGroupId);
      if (group && group.status !== "completed") {
        currentSize = getGroupSize(group);
      }
    }

    // Calculate how many more can join
    const remainingSlots = maxSize - currentSize;
    if (remainingSlots <= 0) return [];

    // Get pending incoming requests
    const requests = await ctx.db
      .query("groupRequests")
      .withIndex("by_room_and_target", (q) =>
        q.eq("roomId", user.roomId).eq("targetId", args.userId)
      )
      .filter((q) => q.eq(q.field("status"), "pending"))
      .order("desc")
      .take(remainingSlots);

    // Get requester info for each request
    const requestsWithInfo = [];
    for (const request of requests) {
      const requester = await ctx.db.get(request.requesterId);
      if (requester) {
        requestsWithInfo.push({
          requestId: request._id,
          requester: {
            id: requester._id,
            avatar: requester.avatar,
            code: requester.code,
          },
          createdAt: request.createdAt,
          expiresAt: request.expiresAt,
        });
      }
    }

    return requestsWithInfo;
  },
});

// Get current group info
export const getCurrentGroup = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || !user.currentGroupId) return null;

    const group = await ctx.db.get(user.currentGroupId);
    if (!group) return null;

    const userSlot = getUserSlot(group, args.userId);
    if (!userSlot) return null;

    // Get all group members
    const members = [];
    const userIds = [group.user1Id, group.user2Id, group.user3Id, group.user4Id];

    for (let i = 0; i < userIds.length; i++) {
      const memberId = userIds[i];
      if (memberId) {
        const member = await ctx.db.get(memberId);
        if (member) {
          const answered = group[`user${i + 1}Answered` as keyof typeof group] || false;
          const answer = group[`user${i + 1}Answer` as keyof typeof group] as string | undefined;
          members.push({
            id: member._id,
            avatar: member.avatar,
            code: member.code,
            answered,
            answer,
            isMe: memberId === args.userId,
          });
        }
      }
    }

    const question = group.currentQuestionId
      ? await ctx.db.get(group.currentQuestionId)
      : null;

    const myAnswered = group[`user${userSlot}Answered` as keyof typeof group] || false;
    const allAnswered = members.every((m) => m.answered);

    return {
      groupId: group._id,
      members,
      question: question
        ? {
            text: question.text,
            optionA: question.optionA,
            optionB: question.optionB,
            followUp: question.followUp,
          }
        : null,
      myAnswered,
      allAnswered,
      status: group.status,
      completedAt: group.completedAt,
      createdAt: group.createdAt,
    };
  },
});

// Submit an answer to the group's question
export const submitAnswer = mutation({
  args: {
    userId: v.id("users"),
    groupId: v.id("groups"),
    choice: v.string(), // "A" or "B"
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    const userSlot = getUserSlot(group, args.userId);
    if (!userSlot) {
      throw new Error("Not part of this group");
    }

    // Update the group with the answer
    const updateFields: any = {
      [`user${userSlot}Answer`]: args.choice,
      [`user${userSlot}Answered`]: true,
    };
    await ctx.db.patch(args.groupId, updateFields);

    // Store the answer
    if (group.currentQuestionId) {
      await ctx.db.insert("answers", {
        roomId: group.roomId,
        groupId: args.groupId,
        questionId: group.currentQuestionId,
        userId: args.userId,
        choice: args.choice,
        skipped: false,
        timestamp: Date.now(),
      });
    }
  },
});

// Complete the group session
/**
 * Marks a group as completed and resets all members to available status
 *
 * Actions:
 * - Sets group status to "completed" with timestamp
 * - Clears currentGroupId from all members (user1-4)
 * - Resets all members' status to "available"
 * - Resets spam prevention backoff levels to 0 for all members
 * - Members can immediately join new groups after completion
 *
 * @param args.userId - ID of user completing the group (for validation)
 * @param args.groupId - ID of group to mark as completed
 * @throws Error if group not found
 */
export const completeGroup = mutation({
  args: {
    userId: v.id("users"),
    groupId: v.id("groups"),
  },
  handler: async (ctx, args) => {
    const group = await ctx.db.get(args.groupId);
    if (!group) throw new Error("Group not found");

    await ctx.db.patch(args.groupId, {
      status: "completed",
      completedAt: Date.now(),
    });

    // Clear current group from all members and reset status to available
    const memberIds = [
      group.user1Id,
      group.user2Id,
      group.user3Id,
      group.user4Id,
    ].filter(Boolean);

    for (const memberId of memberIds) {
      await ctx.db.patch(memberId as any, {
        currentGroupId: undefined,
        status: "available",
        requestBackoffLevel: 0, // Reset backoff on completion
      });
    }
  },
});

// Get available users for grouping
export const getAvailableUsers = query({
  args: {
    roomId: v.id("rooms"),
    excludeUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect();

    // Return users with their group status
    const usersWithGroupInfo = [];

    for (const user of users) {
      if (user._id === args.excludeUserId) continue;

      let groupSize = 0;
      let groupId = null;

      if (user.currentGroupId) {
        const group = await ctx.db.get(user.currentGroupId);
        if (group && group.status !== "completed") {
          groupSize = getGroupSize(group);
          groupId = group._id;
        }
      }

      usersWithGroupInfo.push({
        id: user._id,
        avatar: user.avatar,
        code: user.code,
        status: user.status,
        groupSize,
        groupId,
      });
    }

    return usersWithGroupInfo;
  },
});
